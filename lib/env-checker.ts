// Simple utility to verify environment variables

// Check if all required environment variables are present
export function checkRequiredEnvVars() {
  const requiredVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  }

  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    console.error(`ERROR: Missing environment variables: ${missing.join(", ")}`)
    return false
  }

  return true
}

// Get status of all environment variables
export function getEnvVarsStatus() {
  return {
    supabase: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    openai: {
      apiKey: !!process.env.OPENAI_API_KEY,
    },
    site: {
      url: process.env.NEXT_PUBLIC_SITE_URL,
    },
  }
}
