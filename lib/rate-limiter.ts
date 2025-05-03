/**
 * Token Bucket Rate Limiter
 * Implements a token bucket algorithm for rate limiting API requests
 */

export interface RateLimiterOptions {
  tokensPerInterval: number
  interval: "second" | "minute" | "hour"
  maxTokens?: number
}

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private tokensPerInterval: number
  private intervalMs: number
  private maxTokens: number

  constructor(options: RateLimiterOptions) {
    this.tokensPerInterval = options.tokensPerInterval
    this.tokens = options.maxTokens || options.tokensPerInterval
    this.maxTokens = options.maxTokens || options.tokensPerInterval
    this.lastRefill = Date.now()

    // Convert interval to milliseconds
    switch (options.interval) {
      case "second":
        this.intervalMs = 1000
        break
      case "minute":
        this.intervalMs = 60 * 1000
        break
      case "hour":
        this.intervalMs = 60 * 60 * 1000
        break
      default:
        this.intervalMs = 60 * 1000 // Default to minute
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now()
    const elapsedTime = now - this.lastRefill

    if (elapsedTime > 0) {
      // Calculate tokens to add based on elapsed time
      const tokensToAdd = Math.floor((elapsedTime / this.intervalMs) * this.tokensPerInterval)

      if (tokensToAdd > 0) {
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
        this.lastRefill = now
      }
    }
  }

  /**
   * Check if tokens are available without consuming them
   */
  public hasTokens(count = 1): boolean {
    this.refill()
    return this.tokens >= count
  }

  /**
   * Get current token count
   */
  public getTokenCount(): number {
    this.refill()
    return this.tokens
  }

  /**
   * Remove tokens from the bucket
   * Returns a promise that resolves when tokens are available
   */
  public async removeTokens(count = 1): Promise<number> {
    // If we have enough tokens, consume them immediately
    this.refill()

    if (this.tokens >= count) {
      this.tokens -= count
      return this.tokens
    }

    // Otherwise, wait until we have enough tokens
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        this.refill()

        if (this.tokens >= count) {
          clearInterval(checkInterval)
          this.tokens -= count
          resolve(this.tokens)
        }
      }, 100) // Check every 100ms
    })
  }

  /**
   * Reset the rate limiter
   */
  public reset(): void {
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
  }
}
