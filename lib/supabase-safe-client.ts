import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Create a safe Supabase client that won't crash if environment variables are missing
export function createSafeSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if required environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables are missing. Using a stub client.")

    // Return a stub client that won't crash but won't do anything
    return createStubSupabaseClient()
  }

  // Create and return the real Supabase client
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Create a stub Supabase client that won't crash when called
function createStubSupabaseClient() {
  // This is a minimal implementation that won't crash when methods are called
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () =>
        Promise.resolve({ data: { user: null }, error: { message: "Supabase not configured" } }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ data: null, error: { message: "Supabase not configured" } }),
      insert: () => ({ data: null, error: { message: "Supabase not configured" } }),
      update: () => ({ data: null, error: { message: "Supabase not configured" } }),
      delete: () => ({ data: null, error: { message: "Supabase not configured" } }),
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  } as any
}
