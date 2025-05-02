import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "./database.types"

// Types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Analysis = Database["public"]["Tables"]["analyses"]["Row"]
export type CreditScore = Database["public"]["Tables"]["credit_scores"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"]
export type DisputeLetter = Database["public"]["Tables"]["dispute_letters"]["Row"]
export type Note = Database["public"]["Tables"]["notes"]["Row"]

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Client-side singleton pattern to prevent multiple instances
let supabaseInstance: ReturnType<typeof createClient> | null = null

// Create a Supabase client for the browser
export const supabase = (() => {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: {
      schema: "public",
    },
    global: {
      fetch: (...args) => {
        // Add custom fetch options here if needed
        return fetch(...args)
      },
    },
  })

  return supabaseInstance
})()

// Create a Supabase client for server components
export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: { path: string; maxAge: number; domain?: string }) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // This can happen in middleware when cookies are already sent
          console.error("Error setting cookie:", error)
        }
      },
      remove(name: string, options: { path: string; domain?: string }) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 })
        } catch (error) {
          console.error("Error removing cookie:", error)
        }
      },
    },
  })
}

// Create a Supabase admin client with service role
export function createAdminSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Connection pool for server-side operations
const connectionPool: { [key: string]: ReturnType<typeof createClient> } = {}

// Get a connection from the pool
export function getSupabaseConnection(key = "default") {
  if (!connectionPool[key]) {
    connectionPool[key] = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    })
  }
  return connectionPool[key]
}

// Clear the connection pool
export function clearConnectionPool() {
  Object.keys(connectionPool).forEach((key) => {
    delete connectionPool[key]
  })
}

// Batch operations helper
export async function batchSupabaseOperations<T>(operations: (() => Promise<T>)[], concurrency = 5): Promise<T[]> {
  const results: T[] = []
  const errors: Error[] = []

  // Process operations in batches
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map((op) => op()))

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        errors.push(result.reason)
        console.error(`Batch operation ${i + index} failed:`, result.reason)
      }
    })
  }

  if (errors.length > 0) {
    console.warn(`${errors.length} out of ${operations.length} batch operations failed`)
  }

  return results
}
