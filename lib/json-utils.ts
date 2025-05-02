/**
 * Comprehensive JSON utilities for robust handling throughout the application
 */

// Constants for optimization
const MAX_CACHE_SIZE = 100
const MAX_JSON_STRING_LENGTH = 10000000 // 10MB limit for safety

// Cache for parsed JSON to improve performance
const jsonParseCache = new Map<string, any>()
let cacheHits = 0
let cacheMisses = 0

/**
 * Safely parse a JSON string with error handling
 * @param text The JSON string to parse
 * @param fallback Optional fallback value if parsing fails
 * @returns The parsed object or fallback value
 */
export function safeJsonParse<T>(text: string, fallback?: T): T | null {
  if (!text || typeof text !== "string") return fallback || null

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error("Error parsing JSON:", error)
    console.error("JSON text (first 100 chars):", text.substring(0, 100))
    return fallback || null
  }
}

/**
 * Safely stringify an object to JSON with error handling
 * @param data The data to stringify
 * @param fallback Optional fallback string if stringification fails
 * @returns JSON string or fallback value
 */
export function safeJsonStringify(data: any, fallback = "{}"): string {
  if (data === undefined || data === null) return fallback

  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error("JSON stringify error:", error)

    // Try to sanitize the data and retry
    try {
      const sanitized = sanitizeForJson(data)
      return JSON.stringify(sanitized)
    } catch (sanitizeError) {
      console.error("Failed to sanitize and stringify JSON:", sanitizeError)
      return fallback
    }
  }
}

/**
 * Extract JSON from a string that might contain non-JSON content
 * (e.g., when AI models return JSON wrapped in markdown code blocks)
 * @param text Text that might contain JSON
 * @returns Extracted JSON object or null
 */
export function extractJsonFromText<T>(text: string): T | null {
  if (!text) return null

  // First try direct parsing (most efficient)
  try {
    return JSON.parse(text) as T
  } catch (error) {
    // Try to extract JSON from markdown code blocks or text
    try {
      // Look for JSON in code blocks
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch && codeBlockMatch[1]) {
        return JSON.parse(codeBlockMatch[1].trim()) as T
      }

      // Look for JSON object pattern
      const jsonObjectMatch = text.match(/(\{[\s\S]*\})/)
      if (jsonObjectMatch && jsonObjectMatch[1]) {
        return JSON.parse(jsonObjectMatch[1]) as T
      }

      // Look for JSON array pattern
      const jsonArrayMatch = text.match(/(\[[\s\S]*\])/)
      if (jsonArrayMatch && jsonArrayMatch[1]) {
        return JSON.parse(jsonArrayMatch[1]) as T
      }

      // Try to fix common JSON syntax errors and retry
      const fixedJson = attemptToFixJsonSyntax(text)
      if (fixedJson) {
        return JSON.parse(fixedJson) as T
      }
    } catch (extractError) {
      console.error("Error parsing extracted JSON:", extractError)
    }

    return null
  }
}

/**
 * Attempts to fix common JSON syntax errors
 * @param text Text with potential JSON syntax errors
 * @returns Fixed JSON string or null if unfixable
 */
function attemptToFixJsonSyntax(text: string): string | null {
  try {
    // Replace single quotes with double quotes (common error)
    let fixed = text.replace(/(\w+):'([^']*)'/g, '"$1":"$2"')

    // Fix missing quotes around property names
    fixed = fixed.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":')

    // Fix trailing commas in objects and arrays
    fixed = fixed.replace(/,\s*(\}|\])/g, "$1")

    // Add missing quotes around string values
    fixed = fixed.replace(/:\s*([^",{[\]}\d][^",{[\]}\s]*)\s*([,}])/g, ':"$1"$2')

    // Try parsing the fixed JSON
    JSON.parse(fixed)
    return fixed
  } catch (error) {
    return null
  }
}

/**
 * Create a standardized API response object
 * @param success Whether the operation was successful
 * @param data The data to include in the response
 * @param error Optional error message
 * @returns Standardized response object
 */
export function createApiResponse<T>(success: boolean, data?: T, error?: string) {
  return {
    success,
    data: data || null,
    error: error || null,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Validate that an object conforms to an expected schema
 * @param obj Object to validate
 * @param requiredKeys Array of required keys
 * @returns Whether the object is valid
 */
export function validateJsonSchema(obj: any, requiredKeys: string[]): boolean {
  if (!obj || typeof obj !== "object") return false
  return requiredKeys.every((key) => key in obj)
}

/**
 * Create a standardized error response for API routes
 * @param message Error message
 * @param status HTTP status code
 * @param details Additional error details
 * @returns Response object with JSON error
 */
export function createErrorResponse(message: string, status = 500, details?: any): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details: sanitizeForJson(details) || null,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  )
}

/**
 * Create a standardized success response for API routes
 * @param data Response data
 * @param status HTTP status code
 * @returns Response object with JSON data
 */
export function createSuccessResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: sanitizeForJson(data),
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  )
}

/**
 * Sanitize an object to ensure it can be safely serialized to JSON
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeForJson(obj: any): any {
  // Handle primitive types and null/undefined
  if (obj === null || obj === undefined) {
    return null
  }

  if (typeof obj !== "object") {
    return obj
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString()
  }

  // Handle Error objects
  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      stack: process.env.NODE_ENV === "development" ? obj.stack : undefined,
    }
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson)
  }

  // Handle regular objects
  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip functions, symbols, and other non-serializable types
    if (typeof value === "function" || typeof value === "symbol") {
      continue
    }

    // Handle circular references
    try {
      // This will throw an error if there's a circular reference
      JSON.stringify(value)

      // If no error, recursively sanitize
      sanitized[key] = sanitizeForJson(value)
    } catch (error) {
      // If circular reference or other JSON error, use a placeholder
      sanitized[key] = "[Circular Reference or Unserializable Value]"
    }
  }

  return sanitized
}

/**
 * Ensure a value is a valid JSON object
 * @param value Value to check
 * @param defaultValue Default value if not a valid object
 * @returns Valid object or default value
 */
export function ensureJsonObject(value: any, defaultValue: object = {}): object {
  if (value === null || value === undefined) {
    return defaultValue
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return defaultValue
  }

  return value
}

/**
 * Ensure a value is a valid JSON array
 * @param value Value to check
 * @param defaultValue Default value if not a valid array
 * @returns Valid array or default value
 */
export function ensureJsonArray(value: any, defaultValue: any[] = []): any[] {
  if (!Array.isArray(value)) {
    return defaultValue
  }

  return value
}

/**
 * Deep clone an object using JSON serialization
 * Performance optimized with type checking
 * @param obj Object to clone
 * @returns Cloned object
 */
export function jsonClone<T>(obj: T): T {
  // Handle primitive types directly
  if (
    obj === null ||
    obj === undefined ||
    typeof obj === "number" ||
    typeof obj === "string" ||
    typeof obj === "boolean"
  ) {
    return obj
  }

  try {
    return JSON.parse(JSON.stringify(obj)) as T
  } catch (error) {
    console.error("Error cloning object:", error)

    // Try with sanitization if regular cloning fails
    try {
      const sanitized = sanitizeForJson(obj)
      return JSON.parse(JSON.stringify(sanitized)) as T
    } catch (sanitizeError) {
      console.error("Error cloning even after sanitization:", sanitizeError)
      return obj
    }
  }
}

/**
 * Memoized JSON parsing for repeated operations on the same string
 * Uses a Map to cache results with LRU-like behavior
 */
export function memoizedJsonParse<T>(text: string, fallback?: T): T | null {
  if (!text) return fallback || null

  // Safety check for extremely large strings
  if (text.length > MAX_JSON_STRING_LENGTH) {
    console.warn(`JSON string exceeds safe limit (${text.length} > ${MAX_JSON_STRING_LENGTH}), skipping cache`)
    return safeJsonParse(text, fallback)
  }

  // Check cache first
  if (jsonParseCache.has(text)) {
    cacheHits++
    return jsonParseCache.get(text) as T
  }

  cacheMisses++

  // Parse and cache result
  try {
    const result = JSON.parse(text) as T

    // Manage cache size with LRU-like behavior
    if (jsonParseCache.size >= MAX_CACHE_SIZE) {
      const firstKey = jsonParseCache.keys().next().value
      jsonParseCache.delete(firstKey)
    }

    jsonParseCache.set(text, result)
    return result
  } catch (error) {
    console.error("JSON parse error:", error)
    return fallback || null
  }
}

/**
 * Get cache statistics
 */
export function getJsonCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
  const total = cacheHits + cacheMisses
  return {
    size: jsonParseCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
  }
}

/**
 * Clear the JSON parse cache
 */
export function clearJsonCache(): void {
  jsonParseCache.clear()
  cacheHits = 0
  cacheMisses = 0
}

/**
 * Compress large JSON objects by removing null/undefined values
 * Useful for storage or transmission of large objects
 */
export function compressJson(obj: any): any {
  if (obj === null || obj === undefined) {
    return null
  }

  if (typeof obj !== "object") {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(compressJson).filter((item) => item !== null && item !== undefined)
  }

  const compressed: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const compressedValue = compressJson(value)
    if (compressedValue !== null && compressedValue !== undefined) {
      compressed[key] = compressedValue
    }
  }

  return compressed
}

/**
 * Validate JSON structure against a schema
 * @param data The data to validate
 * @param schema The schema to validate against
 * @returns Validation result with errors if any
 */
export function validateJson(data: any, schema: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Simple schema validation
  for (const [key, schemaValue] of Object.entries(schema)) {
    // Check if required field exists
    if (schemaValue.required && (data[key] === undefined || data[key] === null)) {
      errors.push(`Required field "${key}" is missing`)
      continue
    }

    // Skip validation if field is not present and not required
    if (data[key] === undefined || data[key] === null) {
      continue
    }

    // Type validation
    if (schemaValue.type && typeof data[key] !== schemaValue.type) {
      errors.push(`Field "${key}" should be of type ${schemaValue.type}, but got ${typeof data[key]}`)
    }

    // Array validation
    if (schemaValue.type === "array" && !Array.isArray(data[key])) {
      errors.push(`Field "${key}" should be an array`)
    }

    // Min/max validation for numbers
    if (schemaValue.type === "number") {
      if (schemaValue.min !== undefined && data[key] < schemaValue.min) {
        errors.push(`Field "${key}" should be at least ${schemaValue.min}`)
      }
      if (schemaValue.max !== undefined && data[key] > schemaValue.max) {
        errors.push(`Field "${key}" should be at most ${schemaValue.max}`)
      }
    }

    // Min/max length validation for strings
    if (schemaValue.type === "string") {
      if (schemaValue.minLength !== undefined && data[key].length < schemaValue.minLength) {
        errors.push(`Field "${key}" should have at least ${schemaValue.minLength} characters`)
      }
      if (schemaValue.maxLength !== undefined && data[key].length > schemaValue.maxLength) {
        errors.push(`Field "${key}" should have at most ${schemaValue.maxLength} characters`)
      }
    }

    // Pattern validation for strings
    if (schemaValue.type === "string" && schemaValue.pattern) {
      const regex = new RegExp(schemaValue.pattern)
      if (!regex.test(data[key])) {
        errors.push(`Field "${key}" does not match the required pattern`)
      }
    }

    // Enum validation
    if (schemaValue.enum && !schemaValue.enum.includes(data[key])) {
      errors.push(`Field "${key}" should be one of: ${schemaValue.enum.join(", ")}`)
    }

    // Nested object validation
    if (schemaValue.properties && typeof data[key] === "object" && !Array.isArray(data[key])) {
      const nestedValidation = validateJson(data[key], schemaValue.properties)
      if (!nestedValidation.valid) {
        errors.push(...nestedValidation.errors.map((err) => `${key}.${err}`))
      }
    }

    // Array items validation
    if (schemaValue.items && Array.isArray(data[key])) {
      data[key].forEach((item: any, index: number) => {
        if (typeof schemaValue.items === "object") {
          if (schemaValue.items.type && typeof item !== schemaValue.items.type) {
            errors.push(`Item ${index} in "${key}" should be of type ${schemaValue.items.type}`)
          }

          if (schemaValue.items.properties) {
            const itemValidation = validateJson(item, schemaValue.items.properties)
            if (!itemValidation.valid) {
              errors.push(...itemValidation.errors.map((err) => `${key}[${index}].${err}`))
            }
          }
        }
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Safely parse and validate JSON in one operation
 * @param text JSON string to parse and validate
 * @param schema Schema to validate against
 * @param fallback Fallback value if parsing or validation fails
 * @returns Parsed and validated object or fallback
 */
export function parseAndValidateJson<T>(
  text: string,
  schema: Record<string, any>,
  fallback?: T,
): {
  data: T | null
  valid: boolean
  errors: string[]
} {
  try {
    const parsed = safeJsonParse(text)

    if (!parsed) {
      return { data: fallback || null, valid: false, errors: ["Failed to parse JSON"] }
    }

    const validation = validateJson(parsed, schema)

    return {
      data: validation.valid ? (parsed as T) : fallback || null,
      valid: validation.valid,
      errors: validation.errors,
    }
  } catch (error) {
    return {
      data: fallback || null,
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown error parsing JSON"],
    }
  }
}
