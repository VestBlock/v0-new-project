import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return NextResponse.json({ success: false, error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Test OpenAI connection
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: "Respond with 'OpenAI connection successful' if you receive this message.",
            },
          ],
          max_tokens: 20,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}${
            errorData.error ? ` - ${errorData.error.message || JSON.stringify(errorData.error)}` : ""
          }`,
        )
      }

      const data = await response.json()

      // Log the successful connection
      try {
        await supabase.from("openai_logs").insert({
          user_id: user.id,
          request_id: `connection_check_${Date.now()}`,
          model: "gpt-3.5-turbo",
          prompt_length: 70, // Approximate length of the test prompt
          success: true,
          latency_ms: 0, // We're not measuring latency here
          timestamp: new Date().toISOString(),
        })
      } catch (logError) {
        console.error("Failed to log OpenAI connection check:", logError)
        // Continue anyway
      }

      return NextResponse.json({
        success: true,
        message: "OpenAI connection successful",
        response: data.choices?.[0]?.message?.content || "",
      })
    } catch (error) {
      console.error("OpenAI connection check failed:", error)

      // Log the failed connection
      try {
        await supabase.from("openai_logs").insert({
          user_id: user.id,
          request_id: `connection_check_${Date.now()}`,
          model: "gpt-3.5-turbo",
          prompt_length: 70, // Approximate length of the test prompt
          success: false,
          error_type: "connection",
          error_message: error instanceof Error ? error.message : "Unknown error",
          latency_ms: 0, // We're not measuring latency here
          timestamp: new Date().toISOString(),
        })
      } catch (logError) {
        console.error("Failed to log OpenAI connection check:", logError)
        // Continue anyway
      }

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Error in check-openai API:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
