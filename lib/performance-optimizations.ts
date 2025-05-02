/**
 * Performance optimizations for VestBlock
 *
 * This file contains utilities to improve application performance
 */

// Cache for expensive computations
const computationCache = new Map<string, { result: any; timestamp: number }>()
const COMPUTATION_CACHE_TTL = 300000 // 5 minutes

/**
 * Memoizes an expensive function with a time-based cache
 * @param fn Function to memoize
 * @param keyFn Function to generate cache key
 * @param ttl Cache TTL in ms (default: 5 minutes)
 */
export function memoizeWithTTL<T, R>(
  fn: (...args: T[]) => R,
  keyFn: (...args: T[]) => string = (...args) => JSON.stringify(args),
  ttl: number = COMPUTATION_CACHE_TTL,
): (...args: T[]) => R {
  return (...args: T[]): R => {
    const key = keyFn(...args)
    const cached = computationCache.get(key)

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result
    }

    const result = fn(...args)

    // Manage cache size (max 100 items)
    if (computationCache.size >= 100) {
      // Remove oldest entry
      const oldestKey = [...computationCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      computationCache.delete(oldestKey)
    }

    computationCache.set(key, { result, timestamp: Date.now() })
    return result
  }
}

/**
 * Debounces a function to prevent excessive calls
 * @param fn Function to debounce
 * @param delay Delay in ms
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>): void => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Throttles a function to limit call frequency
 * @param fn Function to throttle
 * @param limit Time limit in ms
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>): void => {
    const now = Date.now()

    if (now - lastCall >= limit) {
      lastCall = now
      fn(...args)
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          lastCall = Date.now()
          timeoutId = null
          fn(...args)
        },
        limit - (now - lastCall),
      )
    }
  }
}

/**
 * Batch processes items to avoid UI blocking
 * @param items Items to process
 * @param processFn Function to process each item
 * @param batchSize Number of items per batch
 * @param delay Delay between batches in ms
 */
export async function batchProcess<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  batchSize = 5,
  delay = 0,
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processFn))
    results.push(...batchResults)

    if (delay > 0 && i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return results
}

/**
 * Lazy loads data only when needed
 * @param loadFn Function to load data
 */
export function createLazyLoader<T>(loadFn: () => Promise<T>) {
  let data: T | null = null
  let loading = false
  let loadPromise: Promise<T> | null = null

  return async (): Promise<T> => {
    if (data !== null) {
      return data
    }

    if (loading) {
      return loadPromise!
    }

    loading = true
    loadPromise = loadFn()

    try {
      data = await loadPromise
      return data
    } finally {
      loading = false
    }
  }
}

/**
 * Clears all performance caches
 */
export function clearPerformanceCaches(): void {
  computationCache.clear()
}
