/**
 * Security enhancements for VestBlock
 *
 * This file contains utilities to improve application security
 */

import { sanitizeForJson } from "./json-utils"

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input User input to sanitize
 */
export function sanitizeUserInput(input: string): string {
  if (!input) return ""

  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

/**
 * Validates and sanitizes an object against a schema
 * @param data Data to validate
 * @param schema Schema to validate against
 */
export function validateAndSanitize<T>(
  data: any,
  schema: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "object" | "array"
      required?: boolean
      maxLength?: number
      minLength?: number
      pattern?: RegExp
      enum?: any[]
      sanitize?: boolean
    }
  >,
): { valid: boolean; sanitized: Partial<T>; errors: string[] } {
  const errors: string[] = []
  const sanitized: Partial<T> = {}

  // First pass: validate
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key]

    // Check required fields
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Field "${key}" is required`)
      continue
    }

    // Skip validation for undefined optional fields
    if (value === undefined || value === null) {
      continue
    }

    // Type validation
    const actualType = Array.isArray(value) ? "array" : typeof value
    if (actualType !== rules.type) {
      errors.push(`Field "${key}" should be of type ${rules.type}, but got ${actualType}`)
      continue
    }

    // String validations
    if (rules.type === "string") {
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`Field "${key}" exceeds maximum length of ${rules.maxLength}`)
      }

      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(`Field "${key}" is shorter than minimum length of ${rules.minLength}`)
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`Field "${key}" does not match required pattern`)
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`Field "${key}" must be one of: ${rules.enum.join(", ")}`)
    }
  }

  // Second pass: sanitize
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key]

    if (value === undefined || value === null) {
      continue
    }

    if (rules.sanitize) {
      if (rules.type === "string") {
        sanitized[key as keyof T] = sanitizeUserInput(value) as any
      } else if (rules.type === "object" || rules.type === "array") {
        sanitized[key as keyof T] = sanitizeForJson(value) as any
      } else {
        sanitized[key as keyof T] = value
      }
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
  }
}

/**
 * Creates a rate limiter to prevent abuse
 * @param maxRequests Maximum requests allowed
 * @param timeWindow Time window in ms
 */
export function createRateLimiter(maxRequests: number, timeWindow: number) {
  const clients = new Map<string, { count: number; resetTime: number }>()

  return {
    /**
     * Check if a client is rate limited
     * @param clientId Client identifier (e.g., IP address)
     */
    isLimited(clientId: string): boolean {
      const now = Date.now()
      const client = clients.get(clientId)

      // Clean up expired entries
      if (clients.size > 1000) {
        for (const [id, data] of clients.entries()) {
          if (now > data.resetTime) {
            clients.delete(id)
          }
        }
      }

      if (!client) {
        clients.set(clientId, {
          count: 1,
          resetTime: now + timeWindow,
        })
        return false
      }

      if (now > client.resetTime) {
        clients.set(clientId, {
          count: 1,
          resetTime: now + timeWindow,
        })
        return false
      }

      if (client.count >= maxRequests) {
        return true
      }

      client.count++
      return false
    },

    /**
     * Get remaining requests for a client
     * @param clientId Client identifier
     */
    getRemainingRequests(clientId: string): number {
      const now = Date.now()
      const client = clients.get(clientId)

      if (!client || now > client.resetTime) {
        return maxRequests
      }

      return Math.max(0, maxRequests - client.count)
    },

    /**
     * Reset rate limit for a client
     * @param clientId Client identifier
     */
    reset(clientId: string): void {
      clients.delete(clientId)
    },
  }
}
