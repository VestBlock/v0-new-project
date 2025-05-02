/**
 * Memory optimizations for VestBlock
 *
 * This file contains utilities to improve memory usage
 */

/**
 * Creates a memory-efficient iterator for large arrays
 * @param array Large array to iterate
 * @param chunkSize Size of each chunk
 */
export function* chunkIterator<T>(array: T[], chunkSize = 1000): Generator<T[], void> {
  for (let i = 0; i < array.length; i += chunkSize) {
    yield array.slice(i, i + chunkSize)
  }
}

/**
 * Compresses an object by removing null/undefined values and empty arrays/objects
 * @param obj Object to compress
 */
export function compressObject<T extends object>(obj: T): Partial<T> {
  if (!obj || typeof obj !== "object") return obj

  if (Array.isArray(obj)) {
    const filtered = obj
      .map((item) => compressObject(item as any))
      .filter((item) => {
        if (item === null || item === undefined) return false
        if (Array.isArray(item) && item.length === 0) return false
        if (typeof item === "object" && Object.keys(item).length === 0) return false
        return true
      })

    return filtered.length > 0 ? (filtered as any) : (undefined as any)
  }

  const result: Partial<T> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue

    const compressed = typeof value === "object" ? compressObject(value as any) : value

    if (compressed === undefined) continue
    if (Array.isArray(compressed) && compressed.length === 0) continue
    if (typeof compressed === "object" && !Array.isArray(compressed) && Object.keys(compressed).length === 0) continue

    result[key as keyof T] = compressed as any
  }

  return Object.keys(result).length > 0 ? result : (undefined as any)
}

/**
 * Creates a memory-efficient stream processor for large data
 * @param processFn Function to process each chunk
 * @param chunkSize Size of each chunk
 */
export function createStreamProcessor<T, R>(processFn: (chunk: T[]) => Promise<R[]>, chunkSize = 1000) {
  const buffer: T[] = []
  let processing = false
  const results: R[] = []

  return {
    /**
     * Add items to the processing buffer
     */
    async add(items: T[]): Promise<void> {
      buffer.push(...items)
      await this.flush()
    },

    /**
     * Process all buffered items
     */
    async flush(): Promise<R[]> {
      if (processing || buffer.length === 0) {
        return results
      }

      processing = true

      try {
        while (buffer.length > 0) {
          const chunk = buffer.splice(0, chunkSize)
          const chunkResults = await processFn(chunk)
          results.push(...chunkResults)
        }

        return results
      } finally {
        processing = false
      }
    },

    /**
     * Get all processed results
     */
    getResults(): R[] {
      return results
    },

    /**
     * Clear all buffers and results
     */
    clear(): void {
      buffer.length = 0
      results.length = 0
    },
  }
}

/**
 * Creates a weak reference cache that doesn't prevent garbage collection
 */
export function createWeakCache<K extends object, V>() {
  const cache = new WeakMap<K, V>()

  return {
    get(key: K): V | undefined {
      return cache.get(key)
    },

    set(key: K, value: V): void {
      cache.set(key, value)
    },

    has(key: K): boolean {
      return cache.has(key)
    },

    delete(key: K): boolean {
      return cache.delete(key)
    },
  }
}
