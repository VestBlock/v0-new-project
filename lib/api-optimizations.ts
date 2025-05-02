/**
 * API optimizations for VestBlock
 *
 * This file contains utilities to improve API performance and reliability
 */

import { createRateLimiter } from "./security-enhancements"
import { createErrorResponse } from "./json-utils"

// Create rate limiters for different API endpoints
const ocrRateLimiter = createRateLimiter(10, 60000) // 10 requests per minute
const chatRateLimiter = createRateLimiter(60, 60000) // 60 requests per minute
const analysisRateLimiter = createRateLimiter(30, 60000) // 30 requests per minute

/**
 * Wraps an API handler with common optimizations
 * @param handler API route handler
 * @param options Options for the wrapper
 */
export function optimizedApiHandler(
  handler: (req: Request, context: any) => Promise<Response>,
  options: {
    rateLimiter?: ReturnType<typeof createRateLimiter>
    cacheControl?: string
    timeout?: number
    errorHandler?: (error: Error) => Response
  } = {},
) {
  return async (req: Request, context: any): Promise<Response> => {
    const startTime = performance.now()

    try {
      // Apply rate limiting if configured
      if (options.rateLimiter) {
        const clientIp = req.headers.get("x-forwarded-for") || "unknown"

        if (options.rateLimiter.isLimited(clientIp)) {
          return createErrorResponse("Rate limit exceeded. Please try again later.", 429, {
            retryAfter: "60",
            remaining: 0,
          })
        }
      }

      // Apply timeout if configured
      if (options.timeout) {
        const timeoutPromise = new Promise<Response>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${options.timeout}ms`))
          }, options.timeout)
        })

        const responsePromise = handler(req, context)

        const response = (await Promise.race([responsePromise, timeoutPromise])) as Response

        // Add performance headers
        const endTime = performance.now()
        const headers = new Headers(response.headers)

        headers.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`)

        if (options.cacheControl) {
          headers.set("Cache-Control", options.cacheControl)
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      } else {
        // No timeout
        const response = await handler(req, context)

        // Add performance headers
        const endTime = performance.now()
        const headers = new Headers(response.headers)

        headers.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`)

        if (options.cacheControl) {
          headers.set("Cache-Control", options.cacheControl)
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      }
    } catch (error) {
      console.error("API error:", error)

      if (options.errorHandler) {
        return options.errorHandler(error as Error)
      }

      return createErrorResponse("Internal server error", 500, {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : null) : undefined,
      })
    }
  }
}

/**
 * Creates a cached API handler
 * @param handler API route handler
 * @param getCacheKey Function to generate cache key
 * @param ttl Cache TTL in ms
 */
export function cachedApiHandler(
  handler: (req: Request, context: any) => Promise<Response>,
  getCacheKey: (req: Request) => string,
  ttl = 60000, // 1 minute default
) {
  const cache = new Map<string, { response: Response; timestamp: number }>()

  // Clean up cache periodically
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > ttl) {
        cache.delete(key)
      }
    }
  }, 60000) // Clean up every minute

  return async (req: Request, context: any): Promise<Response> => {
    const cacheKey = getCacheKey(req)

    // Skip cache for non-GET requests
    if (req.method !== "GET") {
      return handler(req, context)
    }

    const cachedEntry = cache.get(cacheKey)

    if (cachedEntry && Date.now() - cachedEntry.timestamp < ttl) {
      // Clone the cached response since responses can only be used once
      const cachedResponse = cachedEntry.response.clone()

      // Add cache header
      const headers = new Headers(cachedResponse.headers)
      headers.set("X-Cache", "HIT")

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      })
    }

    // Get fresh response
    const response = await handler(req, context)

    // Only cache successful responses
    if (response.ok) {
      // Clone the response before caching
      cache.set(cacheKey, {
        response: response.clone(),
        timestamp: Date.now(),
      })
    }

    // Add cache header
    const headers = new Headers(response.headers)
    headers.set("X-Cache", "MISS")

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/**
 * Exports rate limiters for use in API routes
 */
export const rateLimiters = {
  ocr: ocrRateLimiter,
  chat: chatRateLimiter,
  analysis: analysisRateLimiter,
}
