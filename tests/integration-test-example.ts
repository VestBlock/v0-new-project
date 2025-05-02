/**
 * Integration Test Example for VestBlock
 *
 * This file demonstrates how to write integration tests for VestBlock.
 * In a real implementation, you would use a testing framework like Jest or Vitest.
 */

import { getSupabaseClient, getSupabaseAdmin } from "../lib/api-patterns"
import { callOpenAI } from "../lib/api-patterns"
import { AppError, ErrorType } from "../lib/error-handling"

/**
 * Example integration test for the user registration flow
 */
async function testUserRegistrationFlow() {
  console.log("Starting integration test: User Registration Flow")

  // Test data
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "TestPassword123!",
    fullName: "Test User",
  }

  try {
    // Step 1: Register a new user
    console.log("Step 1: Registering new user")
    const supabase = getSupabaseClient()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          full_name: testUser.fullName,
        },
      },
    })

    if (signUpError) {
      throw new AppError({
        message: `User registration failed: ${signUpError.message}`,
        type: ErrorType.EXTERNAL_API,
        context: { input: { email: testUser.email } },
      })
    }

    console.log("User registered successfully:", signUpData.user?.id)

    // Step 2: Verify profile was created
    console.log("Step 2: Verifying profile creation")
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", signUpData.user?.id)
      .single()

    if (profileError) {
      throw new AppError({
        message: `Profile verification failed: ${profileError.message}`,
        type: ErrorType.DATABASE,
        context: { userId: signUpData.user?.id },
      })
    }

    console.log("Profile created successfully:", profile.id)

    // Step 3: Clean up test data
    console.log("Step 3: Cleaning up test data")
    const admin = getSupabaseAdmin()
    const { error: deleteError } = await admin.auth.admin.deleteUser(signUpData.user?.id || "")

    if (deleteError) {
      console.warn(`Warning: Failed to delete test user: ${deleteError.message}`)
    } else {
      console.log("Test user deleted successfully")
    }

    console.log("Integration test completed successfully!")
    return true
  } catch (error) {
    console.error("Integration test failed:", error)
    return false
  }
}

/**
 * Example integration test for the OpenAI analysis flow
 */
async function testOpenAIAnalysisFlow() {
  console.log("Starting integration test: OpenAI Analysis Flow")

  try {
    // Step 1: Test basic OpenAI connectivity
    console.log("Step 1: Testing OpenAI connectivity")
    const testResponse = await callOpenAI({
      messages: [{ role: "user", content: "Say 'OpenAI integration test successful'" }],
      model: "gpt-3.5-turbo",
      maxTokens: 20,
      temperature: 0,
    })

    console.log("OpenAI connectivity test successful:", testResponse)

    // Step 2: Test credit report analysis with sample data
    console.log("Step 2: Testing credit report analysis")
    const sampleCreditReport = `
      CREDIT REPORT FOR: John Doe
      Report Date: 01/01/2023
      
      ACCOUNTS:
      - Bank of America Credit Card
        Account #: XXXX-XXXX-XXXX-1234
        Status: Current
        Balance: $1,500
        Credit Limit: $5,000
        Payment History: Good
        
      - Chase Auto Loan
        Account #: LOAN12345
        Status: 30 Days Late
        Balance: $12,000
        Original Amount: $20,000
        Payment History: 1 late payment
    `

    const analysisResponse = await callOpenAI({
      messages: [
        {
          role: "system",
          content:
            "You are a credit analysis expert. Analyze the credit report and return a JSON object with findings.",
        },
        { role: "user", content: sampleCreditReport },
      ],
      model: "gpt-4o",
      maxTokens: 500,
      temperature: 0.3,
    })

    console.log("Credit report analysis test successful:", analysisResponse)

    console.log("Integration test completed successfully!")
    return true
  } catch (error) {
    console.error("Integration test failed:", error)
    return false
  }
}

/**
 * Run all integration tests
 *
 * In a real implementation, this would be executed by your test runner.
 */
export async function runIntegrationTests() {
  console.log("=== RUNNING INTEGRATION TESTS ===")

  const results = {
    userRegistration: await testUserRegistrationFlow(),
    openAIAnalysis: await testOpenAIAnalysisFlow(),
  }

  console.log("=== INTEGRATION TEST RESULTS ===")
  console.log(results)

  const allPassed = Object.values(results).every((result) => result === true)
  console.log(`Overall result: ${allPassed ? "PASSED" : "FAILED"}`)

  return allPassed
}
