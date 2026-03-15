// This file should be the version from Step 1.3 that was successful
// It already contains: console.log("[lib/supabase/server.ts STEP 1.3] All cookies in cookieStore:", JSON.stringify(allCookies, null, 2))
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

console.log("[lib/supabase/server.ts STEP 1.3] File loaded. Imports completed.")

export function getSupabaseServerSingleton() {
  console.log("[lib/supabase/server.ts STEP 1.3] getSupabaseServerSingleton called.")
  const cookieStore = cookies()
  console.log("[lib/supabase/server.ts STEP 1.3] cookieStore obtained from next/headers.")
  try {
    const allCookies = cookieStore.getAll()
    console.log("[lib/supabase/server.ts STEP 1.3] All cookies in cookieStore:", JSON.stringify(allCookies, null, 2))
  } catch (e: any) {
    console.error("[lib/supabase/server.ts STEP 1.3] Error getting all cookies:", e.message)
  }
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[lib/supabase/server.ts STEP 1.3] CRITICAL: Supabase URL or Anon Key env var is missing.")
    throw new Error("Supabase URL and Anon Key must be defined.")
  }
  console.log("[lib/supabase/server.ts STEP 1.3] Attempting to call createServerClient...")
  try {
    const client = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            /*ignore*/
          }
        },
        remove: (name: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            /*ignore*/
          }
        },
      },
    })
    console.log("[lib/supabase/server.ts STEP 1.3] createServerClient call successful.")
    return client
  } catch (error: any) {
    console.error(
      "[lib/supabase/server.ts STEP 1.3] CRITICAL ERROR during createServerClient call:",
      error.message,
      error.stack,
    )
    throw error
  }
}
export const createSupabaseServerClientForTest = getSupabaseServerSingleton
export const createClient = getSupabaseServerSingleton
export const getSupabaseServer = getSupabaseServerSingleton
