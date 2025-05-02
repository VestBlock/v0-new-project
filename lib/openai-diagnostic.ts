import { checkOpenAIDirectConnection } from "./openai-direct"
import { checkOpenAIConnectivity } from "./openai-client"

export async function runOpenAIDiagnostic(): Promise<{
  directApiWorking: boolean
  clientApiWorking: boolean
  apiKey: {
    exists: boolean
    prefix?: string
  }
  errors: string[]
  recommendations: string[]
}> {
  const errors: string[] = []
  const recommendations: string[] = []

  // Check if API key exists
  const apiKey = process.env.OPENAI_API_KEY
  const apiKeyExists = !!apiKey
  const apiKeyPrefix = apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}` : undefined

  if (!apiKeyExists) {
    errors.push("OpenAI API key is missing")
    recommendations.push("Add your OpenAI API key to the environment variables")
  }

  // Test direct API connection
  let directApiWorking = false
  try {
    console.log("Testing direct OpenAI API connection...")
    const directResult = await checkOpenAIDirectConnection()
    directApiWorking = directResult.success

    if (!directResult.success) {
      errors.push(`Direct API test failed: ${directResult.message}`)
      recommendations.push("Check your OpenAI API key and account status")
    } else {
      console.log(`Direct API test successful (${directResult.latencyMs}ms)`)
    }
  } catch (error) {
    errors.push(`Direct API test error: ${error.message}`)
    recommendations.push("Check network connectivity and firewall settings")
  }

  // Test client API connection
  let clientApiWorking = false
  try {
    console.log("Testing OpenAI client connection...")
    const clientResult = await checkOpenAIConnectivity()
    clientApiWorking = clientResult.success

    if (!clientResult.success) {
      errors.push(`Client API test failed: ${clientResult.message}`)
    } else {
      console.log(`Client API test successful (${clientResult.latencyMs}ms)`)
    }
  } catch (error) {
    errors.push(`Client API test error: ${error.message}`)
  }

  // Add recommendations based on test results
  if (!directApiWorking && !clientApiWorking) {
    recommendations.push("Both API methods are failing. This suggests an issue with your API key or OpenAI account.")
  } else if (!directApiWorking && clientApiWorking) {
    recommendations.push(
      "The direct API is failing but the client API works. Check the model names in openai-direct.ts.",
    )
  } else if (directApiWorking && !clientApiWorking) {
    recommendations.push(
      "The client API is failing but the direct API works. Check the model names in openai-client.ts.",
    )
  }

  return {
    directApiWorking,
    clientApiWorking,
    apiKey: {
      exists: apiKeyExists,
      prefix: apiKeyPrefix,
    },
    errors,
    recommendations,
  }
}
