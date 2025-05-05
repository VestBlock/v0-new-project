/**
 * Database optimizations for VestBlock
 *
 * This file contains utilities to improve database performance
 */

import { supabase } from "./supabase-client"

/**
 * Batches database operations to reduce round trips
 * @param operations Array of operations to perform
 */
export async function batchDatabaseOperations<T>(
  operations: Array<{
    table: string
    operation: "insert" | "update" | "delete" | "upsert"
    data?: any
    match?: Record<string, any>
    returning?: string
  }>,
): Promise<T[]> {
  // Group operations by table and operation type
  const groupedOps = operations.reduce(
    (groups, op) => {
      const key = `${op.table}:${op.operation}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(op)
      return groups
    },
    {} as Record<string, typeof operations>,
  )

  const results: T[] = []

  // Process each group in parallel
  await Promise.all(
    Object.entries(groupedOps).map(async ([key, ops]) => {
      const [table, operation] = key.split(":")

      if (operation === "insert") {
        const { data, error } = await supabase
          .from(table)
          .insert(ops.map((op) => op.data))
          .select(ops[0].returning || "*")

        if (error) throw error
        results.push(...(data as T[]))
      } else if (operation === "update") {
        // For updates, we need to run them individually
        const updateResults = await Promise.all(
          ops.map(async (op) => {
            const { data, error } = await supabase
              .from(table)
              .update(op.data)
              .match(op.match || {})
              .select(op.returning || "*")

            if (error) throw error
            return data as T[]
          }),
        )

        results.push(...updateResults.flat())
      } else if (operation === "delete") {
        // For deletes, we can use 'in' for batch operations
        const matchKeys = Object.keys(ops[0].match || {})

        if (matchKeys.length === 1) {
          const key = matchKeys[0]
          const values = ops.map((op) => op.match?.[key])

          const { data, error } = await supabase
            .from(table)
            .delete()
            .in(key, values)
            .select(ops[0].returning || "*")

          if (error) throw error
          results.push(...(data as T[]))
        } else {
          // For complex matches, run individually
          const deleteResults = await Promise.all(
            ops.map(async (op) => {
              const { data, error } = await supabase
                .from(table)
                .delete()
                .match(op.match || {})
                .select(op.returning || "*")

              if (error) throw error
              return data as T[]
            }),
          )

          results.push(...deleteResults.flat())
        }
      } else if (operation === "upsert") {
        const { data, error } = await supabase
          .from(table)
          .upsert(ops.map((op) => op.data))
          .select(ops[0].returning || "*")

        if (error) throw error
        results.push(...(data as T[]))
      }
    }),
  )

  return results
}

/**
 * Creates a connection pool for better database performance
 */
export function createConnectionPool() {
  const MAX_CONNECTIONS = 10
  const connections: Array<{
    client: typeof supabase
    inUse: boolean
    lastUsed: number
  }> = []

  // Initialize connections
  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    connections.push({
      client: supabase,
      inUse: false,
      lastUsed: 0,
    })
  }

  return {
    /**
     * Get a database connection from the pool
     */
    async getConnection(): Promise<typeof supabase> {
      // Find an available connection
      const connection = connections.find((conn) => !conn.inUse)

      if (!connection) {
        // If all connections are in use, wait for one to become available
        await new Promise((resolve) => setTimeout(resolve, 100))
        return this.getConnection()
      }

      connection.inUse = true
      return connection.client
    },

    /**
     * Release a connection back to the pool
     * @param client Database client to release
     */
    releaseConnection(client: typeof supabase): void {
      const connection = connections.find((conn) => conn.client === client)

      if (connection) {
        connection.inUse = false
        connection.lastUsed = Date.now()
      }
    },

    /**
     * Execute a database operation with automatic connection management
     * @param operation Function that uses a database connection
     */
    async execute<T>(operation: (client: typeof supabase) => Promise<T>): Promise<T> {
      const client = await this.getConnection()

      try {
        return await operation(client)
      } finally {
        this.releaseConnection(client)
      }
    },
  }
}

/**
 * Optimizes a query by adding appropriate indexes and limits
 * @param query Supabase query builder
 * @param options Query options
 */
export function optimizeQuery<T>(
  query: any,
  options: {
    limit?: number
    offset?: number
    orderBy?: { column: string; ascending?: boolean }
    filters?: Array<{ column: string; operator: string; value: any }>
    select?: string
  } = {},
): any {
  let optimizedQuery = query

  // Apply select
  if (options.select) {
    optimizedQuery = optimizedQuery.select(options.select)
  }

  // Apply filters
  if (options.filters && options.filters.length > 0) {
    for (const filter of options.filters) {
      switch (filter.operator) {
        case "eq":
          optimizedQuery = optimizedQuery.eq(filter.column, filter.value)
          break
        case "neq":
          optimizedQuery = optimizedQuery.neq(filter.column, filter.value)
          break
        case "gt":
          optimizedQuery = optimizedQuery.gt(filter.column, filter.value)
          break
        case "gte":
          optimizedQuery = optimizedQuery.gte(filter.column, filter.value)
          break
        case "lt":
          optimizedQuery = optimizedQuery.lt(filter.column, filter.value)
          break
        case "lte":
          optimizedQuery = optimizedQuery.lte(filter.column, filter.value)
          break
        case "like":
          optimizedQuery = optimizedQuery.like(filter.column, filter.value)
          break
        case "ilike":
          optimizedQuery = optimizedQuery.ilike(filter.column, filter.value)
          break
        case "in":
          optimizedQuery = optimizedQuery.in(filter.column, filter.value)
          break
        case "is":
          optimizedQuery = optimizedQuery.is(filter.column, filter.value)
          break
      }
    }
  }

  // Apply ordering
  if (options.orderBy) {
    optimizedQuery = optimizedQuery.order(options.orderBy.column, { ascending: options.orderBy.ascending !== false })
  }

  // Apply pagination
  if (options.limit !== undefined) {
    optimizedQuery = optimizedQuery.limit(options.limit)
  }

  if (options.offset !== undefined) {
    optimizedQuery = optimizedQuery.offset(options.offset)
  }

  return optimizedQuery
}
