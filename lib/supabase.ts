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

// Get environment variables (with console logging for debugging)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log("[SUPABASE] Initialization - URL:", supabaseUrl ? "Found" : "Missing")
console.log("[SUPABASE] Initialization - Anon Key:", supabaseAnonKey ? "Found" : "Missing")

// Simple client singleton
let supabaseInstance: ReturnType<typeof createClient> | null = null

// Browser client - with proper error handling
export const supabase = (() => {
  // If environment variables are missing, return a stub client
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[SUPABASE] ERROR: Supabase URL or Anon Key is missing")
    return createStubClient()
  }

  // Return existing instance if available
  if (supabaseInstance) return supabaseInstance

  try {
    console.log("[SUPABASE] Creating new Supabase client instance")
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    console.log("[SUPABASE] Supabase client created successfully")
    return supabaseInstance
  } catch (error) {
    console.error("[SUPABASE] ERROR: Failed to create Supabase client:", error)
    return createStubClient()
  }
})()

// Server client
export function createServerSupabaseClient() {
  // Early return with clear error if env vars are missing
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Cannot create server Supabase client: Missing URL or Anon Key")
  }

  const cookieStore = cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name, options) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })
}

// Admin client
export function createAdminSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Cannot create admin Supabase client: Missing URL or Service Key")
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

// Create a stub client that gracefully handles errors
function createStubClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: new Error("Supabase not initialized") }),
      signOut: async () => ({ error: new Error("Supabase not initialized") }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error("Supabase not initialized") }),
        }),
      }),
    }),
    // Add other stub methods as needed
  } as any
}

// Helper to check if Supabase is properly initialized
export function isSupabaseInitialized() {
  return !!supabaseUrl && !!supabaseAnonKey && !!supabaseInstance
}

// Add this function at the end of the file
export async function testSupabaseConnection() {
  try {
    console.log("[SUPABASE] Testing connection...")
    const { data, error } = await supabase.from("profiles").select("count").limit(1)

    if (error) {
      console.error("[SUPABASE] Connection test failed:", error)
      return { success: false, error }
    }

    console.log("[SUPABASE] Connection test successful")
    return { success: true, data }
  } catch (err) {
    console.error("[SUPABASE] Connection test exception:", err)
    return { success: false, error: err }
  }
}
