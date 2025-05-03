import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { openai } from "@ai-sdk/openai"
import { generateTextWithRetry } from "@/lib/openai-client"
import { sanitizeForJson } from "@/lib/json-utils"
import { createSuccessResponse, createErrorResponse } from "@/lib/api-patterns"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return createErrorResponse("OpenAI API key is not configured. Please add it to your environment variables.", 500)
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return createErrorResponse("Unauthorized", 401)
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401)
    }

    // Check if user is Pro
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro, role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("Error fetching user profile:", profileError)
      return createErrorResponse("Failed to verify user subscription", 500)
    }

    const isPro = profile?.is_pro || profile?.role === "admin"
    if (!isPro) {
      return createErrorResponse("Pro subscription required", 403)
    }

    // Get request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return createErrorResponse("Invalid JSON in request body", 400)
    }

    const { analysisId, dispute, userInfo } = body

    if (!analysisId || !dispute) {
      return createErrorResponse("Missing required fields", 400)
    }

    // Verify the analysis belongs to the user
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single()

    if (analysisError || !analysis) {
      return createErrorResponse("Analysis not found", 404)
    }

    // Generate the letter using OpenAI
    console.log("Generating dispute letter with OpenAI")

    // Sanitize inputs to prevent JSON issues
    const sanitizedDispute = sanitizeForJson(dispute)
    const sanitizedUserInfo = sanitizeForJson(userInfo || {})

    const prompt = `
Generate a formal dispute letter to send to ${sanitizedDispute.bureau} credit bureau. 
The letter should dispute the following account:

Account Name: ${sanitizedDispute.accountName}
Account Number: ${sanitizedDispute.accountNumber || "Not provided"}
Issue Type: ${sanitizedDispute.issueType}
Recommended Action: ${sanitizedDispute.recommendedAction}

The letter should be from:
Name: ${sanitizedUserInfo.name || "Consumer"}
Address: ${sanitizedUserInfo.address || "123 Main St, Anytown, USA"}
Email: ${sanitizedUserInfo.email || "consumer@example.com"}
Phone: ${sanitizedUserInfo.phone || "555-123-4567"}

The letter should:
1. Be professionally formatted with today's date
2. Include the consumer's information
3. Include the credit bureau's address
4. Reference the specific account being disputed
5. Clearly state the reason for the dispute
6. Request that the item be investigated and removed or corrected
7. Reference rights under the Fair Credit Reporting Act
8. Include a closing with the consumer's signature

Format the letter as plain text that can be copied and pasted.
`

    try {
      const { text } = await generateTextWithRetry({
        model: openai("gpt-4o"),
        prompt,
        temperature: 0.7,
        maxTokens: 1500,
        userId: user.id, // Pass user ID for logging
      })

      // Store the generated letter in the database
      const { error: insertError } = await supabase.from("dispute_letters").insert({
        user_id: user.id,
        analysis_id: analysisId,
        bureau: sanitizedDispute.bureau,
        account_name: sanitizedDispute.accountName,
        account_number: sanitizedDispute.accountNumber || "",
        issue_type: sanitizedDispute.issueType,
        letter_content: text,
      })

      if (insertError) {
        console.error("Error storing dispute letter:", insertError)
        // Continue anyway, just log the error
      }

      return createSuccessResponse({ content: text })
    } catch (error) {
      console.error("Error generating letter with OpenAI:", error)
      return createErrorResponse("Failed to generate letter with OpenAI. Please try again later.", 500, {
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Generate letter error:", error)
    return createErrorResponse("Internal server error", 500, {
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
