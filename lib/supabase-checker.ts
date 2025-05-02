/**
 * Utility to check Supabase connection and configuration
 */

import { createClient } from "@supabase/supabase-js"

/**
 * Checks if Supabase is properly configured and accessible
 */
export async function checkSupabaseConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if environment variables are set
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      message: "Supabase environment variables are not configured",
      details: {
        url: !!supabaseUrl,
        anonKey: !!supabaseAnonKey,
      },
    }
  }

  try {
    // Try to create a client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Test a simple query
    const start = Date.now()
    const { data, error } = await supabase.from("profiles").select("count", { count: "exact" }).limit(1)
    const latencyMs = Date.now() - start

    if (error) {
      return {
        success: false,
        message: "Failed to query Supabase",
        error: error.message,
        details: {
          code: error.code,
          hint: error.hint,
        },
      }
    }

    return {
      success: true,
      message: "Supabase connection successful",
      latencyMs,
      details: {
        url: supabaseUrl.substring(0, 20) + "...",
      },
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to connect to Supabase",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Checks if the Supabase service role key is properly configured
 * This should only be used in server-side code
 */
export async function checkSupabaseServiceRole() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Check if environment variables are set
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      success: false,
      message: "Supabase service role key is not configured",
      details: {
        url: !!supabaseUrl,
        serviceKey: !!supabaseServiceKey,
      },
    }
  }

  try {
    // Try to create an admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Test a simple admin operation
    const start = Date.now()
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    const latencyMs = Date.now() - start

    if (error) {
      return {
        success: false,
        message: "Failed to use Supabase service role key",
        error: error.message,
        details: {
          code: error.code,
          hint: error.hint,
        },
      }
    }

    return {
      success: true,
      message: "Supabase service role key is valid",
      latencyMs,
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to use Supabase service role key",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Creates a diagnostic report for Supabase configuration
 */
export async function createSupabaseDiagnosticReport() {
  const connectionCheck = await checkSupabaseConnection()

  // Only check service role on server
  let serviceRoleCheck = { success: false, message: "Service role check skipped (client-side)" }
  if (typeof window === "undefined") {
    serviceRoleCheck = await checkSupabaseServiceRole()
  }

  return {
    timestamp: new Date().toISOString(),
    environment: typeof window === "undefined" ? "server" : "client",
    connection: connectionCheck,
    serviceRole: serviceRoleCheck,
    environmentVariables: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY:
        typeof window === "undefined" ? !!process.env.SUPABASE_SERVICE_ROLE_KEY : "not-accessible",
    },
  }
}
