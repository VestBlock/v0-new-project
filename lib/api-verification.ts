import { sanitizeForJson } from "./json-utils"

/**
 * Utility functions to verify API responses and detect mock data
 */

// Patterns that might indicate mock data
const MOCK_DATA_PATTERNS = ["sample", "example", "test data", "mock", "dummy", "placeholder", "fake", "demo"]

// Patterns that indicate real OpenAI responses
const OPENAI_RESPONSE_PATTERNS = ["gpt-4", "gpt-3.5", "openai", "model=", "completion_tokens", "prompt_tokens"]

export type VerificationResult = {
  isValid: boolean
  issues: string[]
  mockDataAnalysis: {
    isMockData: boolean
    confidence: number
    reasons: string[]
  }
}

/**
 * Analyzes a response to detect if it might be mock data
 */
export function detectMockData(response: any): {
  isMockData: boolean
  confidence: number
  reasons: string[]
} {
  const result = {
    isMockData: false,
    confidence: 0,
    reasons: [] as string[],
  }

  // Convert to string for analysis
  const responseStr = typeof response === "string" ? response : JSON.stringify(sanitizeForJson(response))

  // Check for mock data patterns
  let mockPatternMatches = 0
  for (const pattern of MOCK_DATA_PATTERNS) {
    if (responseStr.toLowerCase().includes(pattern.toLowerCase())) {
      mockPatternMatches++
      result.reasons.push(`Contains mock data indicator: "${pattern}"`)
    }
  }

  // Check for OpenAI response patterns
  let openaiPatternMatches = 0
  for (const pattern of OPENAI_RESPONSE_PATTERNS) {
    if (responseStr.toLowerCase().includes(pattern.toLowerCase())) {
      openaiPatternMatches++
    }
  }

  // Check for static/repeated content
  if (typeof response === "object" && response !== null) {
    // Look for repeated values in arrays
    const repeatedValues = findRepeatedValues(response)
    if (repeatedValues.length > 0) {
      result.reasons.push(`Contains repeated values: ${repeatedValues.join(", ")}`)
      mockPatternMatches += repeatedValues.length
    }
  }

  // Calculate confidence score
  // Higher score = more likely to be mock data
  const mockScore = mockPatternMatches * 20 // Each mock pattern adds 20%
  const openaiScore = openaiPatternMatches * 15 // Each OpenAI pattern reduces by 15%

  result.confidence = Math.min(100, Math.max(0, mockScore - openaiScore))
  result.isMockData = result.confidence > 50 // Over 50% confidence is considered mock data

  return result
}

/**
 * Find repeated values in an object that might indicate template/mock data
 */
function findRepeatedValues(obj: any, path = ""): string[] {
  const repeatedValues: string[] = []

  if (Array.isArray(obj)) {
    // Check for repeated strings in arrays
    const stringValues = obj.filter((item) => typeof item === "string")
    const valueCounts = new Map<string, number>()

    for (const value of stringValues) {
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1)
    }

    for (const [value, count] of valueCounts.entries()) {
      if (count > 2 && value.length > 10) {
        // Repeated more than twice and not too short
        repeatedValues.push(`${path}[]="${value.substring(0, 20)}..." (${count} times)`)
      }
    }

    // Recursively check array items
    obj.forEach((item, index) => {
      if (typeof item === "object" && item !== null) {
        repeatedValues.push(...findRepeatedValues(item, `${path}[${index}]`))
      }
    })
  } else if (typeof obj === "object" && obj !== null) {
    // Recursively check object properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key]
        if (typeof value === "object" && value !== null) {
          repeatedValues.push(...findRepeatedValues(value, path ? `${path}.${key}` : key))
        }
      }
    }
  }

  return repeatedValues
}

/**
 * Verifies an OpenAI response to ensure it's a real API response
 */
export async function verifyOpenAIResponse(response: any): Promise<VerificationResult> {
  const issues: string[] = []

  // Check for null or undefined response
  if (response === null || response === undefined) {
    issues.push("Response is null or undefined")
    return {
      isValid: false,
      issues,
      mockDataAnalysis: {
        isMockData: true,
        confidence: 100,
        reasons: ["Response is null or undefined"],
      },
    }
  }

  // Check for empty response
  if (
    (typeof response === "string" && response.trim() === "") ||
    (typeof response === "object" && Object.keys(response).length === 0)
  ) {
    issues.push("Response is empty")
    return {
      isValid: false,
      issues,
      mockDataAnalysis: {
        isMockData: true,
        confidence: 100,
        reasons: ["Response is empty"],
      },
    }
  }

  // Check for error responses
  if (typeof response === "object" && response.error) {
    issues.push(`Response contains error: ${response.error}`)
  }

  // Analyze for mock data
  const mockDataAnalysis = detectMockData(response)
  if (mockDataAnalysis.isMockData) {
    issues.push(...mockDataAnalysis.reasons)
  }

  return {
    isValid: issues.length === 0,
    issues,
    mockDataAnalysis,
  }
}
