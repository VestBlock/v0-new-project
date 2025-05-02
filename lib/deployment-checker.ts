/**
 * Deployment Configuration Checker for VestBlock
 *
 * This utility checks for common deployment configuration issues
 * and provides guidance on how to fix them.
 */

import { createClient } from "@supabase/supabase-js"

// Required environment variables
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SITE_URL",
]

// Optional but recommended environment variables
const RECOMMENDED_ENV_VARS = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]

interface CheckResult {
  name: string
  status: "success" | "warning" | "error"
  message: string
  details?: any
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(): CheckResult[] {
  const results: CheckResult[] = []

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      results.push({
        name: `Environment Variable: ${envVar}`,
        status: "error",
        message: `Required environment variable ${envVar} is not set.`,
      })
    } else {
      results.push({
        name: `Environment Variable: ${envVar}`,
        status: "success",
        message: `Environment variable ${envVar} is set.`,
      })
    }
  }

  // Check recommended environment variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!process.env[envVar]) {
      results.push({
        name: `Environment Variable: ${envVar}`,
        status: "warning",
        message: `Recommended environment variable ${envVar} is not set.`,
      })
    } else {
      results.push({
        name: `Environment Variable: ${envVar}`,
        status: "success",
        message: `Environment variable ${envVar} is set.`,
      })
    }
  }

  return results
}

/**
 * Check Supabase connection
 */
async function checkSupabaseConnection(): Promise<CheckResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        name: "Supabase Connection",
        status: "error",
        message: "Supabase URL or anon key is not set.",
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.from("profiles").select("count").limit(1)

    if (error) {
      return {
        name: "Supabase Connection",
        status: "error",
        message: `Failed to connect to Supabase: ${error.message}`,
        details: error,
      }
    }

    return {
      name: "Supabase Connection",
      status: "success",
      message: "Successfully connected to Supabase.",
    }
  } catch (error) {
    return {
      name: "Supabase Connection",
      status: "error",
      message: `Unexpected error connecting to Supabase: ${error instanceof Error ? error.message : String(error)}`,
      details: error,
    }
  }
}

/**
 * Check OpenAI API key
 */
async function checkOpenAIApiKey(): Promise<CheckResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return {
        name: "OpenAI API Key",
        status: "error",
        message: "OpenAI API key is not set.",
      }
    }

    // Make a simple request to check if the API key works
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return {
        name: "OpenAI API Key",
        status: "error",
        message: `Invalid OpenAI API key: ${error.error?.message || response.statusText}`,
        details: error,
      }
    }

    return {
      name: "OpenAI API Key",
      status: "success",
      message: "OpenAI API key is valid.",
    }
  } catch (error) {
    return {
      name: "OpenAI API Key",
      status: "error",
      message: `Unexpected error checking OpenAI API key: ${error instanceof Error ? error.message : String(error)}`,
      details: error,
    }
  }
}

/**
 * Check Node.js version
 */
function checkNodeVersion(): CheckResult {
  try {
    const nodeVersion = process.version
    const versionNumber = Number(nodeVersion.slice(1).split(".")[0])

    if (versionNumber < 18) {
      return {
        name: "Node.js Version",
        status: "error",
        message: `Node.js version ${nodeVersion} is not supported. Please use Node.js 18.17.0 or later.`,
      }
    }

    if (versionNumber < 20) {
      return {
        name: "Node.js Version",
        status: "warning",
        message: `Node.js version ${nodeVersion} is supported, but Node.js 20.x is recommended for best performance.`,
      }
    }

    return {
      name: "Node.js Version",
      status: "success",
      message: `Node.js version ${nodeVersion} is supported.`,
    }
  } catch (error) {
    return {
      name: "Node.js Version",
      status: "warning",
      message: `Unable to determine Node.js version: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Run all deployment checks
 */
export async function runDeploymentChecks(): Promise<{
  results: CheckResult[]
  summary: {
    success: number
    warning: number
    error: number
    total: number
  }
}> {
  const results: CheckResult[] = [
    ...checkEnvironmentVariables(),
    await checkSupabaseConnection(),
    await checkOpenAIApiKey(),
    checkNodeVersion(),
  ]

  // Calculate summary
  const summary = {
    success: results.filter((r) => r.status === "success").length,
    warning: results.filter((r) => r.status === "warning").length,
    error: results.filter((r) => r.status === "error").length,
    total: results.length,
  }

  return { results, summary }
}

/**
 * Generate deployment recommendations based on check results
 */
export function generateDeploymentRecommendations(results: CheckResult[]): string[] {
  const recommendations: string[] = []

  // Add recommendations based on check results
  for (const result of results) {
    if (result.status === "error") {
      if (result.name.includes("Environment Variable")) {
        const envVar = result.name.split(":")[1].trim()
        recommendations.push(`Set the ${envVar} environment variable in your Vercel project settings.`)
      } else if (result.name === "Supabase Connection") {
        recommendations.push("Verify your Supabase URL and anon key are correct.")
        recommendations.push("Check if your IP is allowed in Supabase's API settings.")
      } else if (result.name === "OpenAI API Key") {
        recommendations.push("Verify your OpenAI API key is correct and has sufficient quota.")
      } else if (result.name === "Node.js Version") {
        recommendations.push("Update your Node.js version to 18.17.0 or later.")
      }
    } else if (result.status === "warning") {
      if (result.name.includes("Environment Variable")) {
        const envVar = result.name.split(":")[1].trim()
        recommendations.push(`Consider setting the ${envVar} environment variable for full functionality.`)
      } else if (result.name === "Node.js Version") {
        recommendations.push("Consider upgrading to Node.js 20.x for better performance.")
      }
    }
  }

  // Add general recommendations
  if (recommendations.length === 0) {
    recommendations.push("All checks passed! Your deployment configuration looks good.")
  } else {
    recommendations.push("After making changes, redeploy your application to apply them.")
  }

  return recommendations
}
