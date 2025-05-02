/**
 * Utility to check if Supabase environment variables are properly configured
 */

export function checkSupabaseEnvVars(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]

  const missingVars = requiredVars.filter((varName) => {
    return !process.env[varName]
  })

  return {
    isValid: missingVars.length === 0,
    missingVars,
  }
}

export function getSupabaseStatus(): string {
  const { isValid, missingVars } = checkSupabaseEnvVars()

  if (isValid) {
    return "Supabase environment variables are properly configured."
  }

  return `Missing Supabase environment variables: ${missingVars.join(", ")}`
}
