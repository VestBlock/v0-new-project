import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { OpenAI } from "openai"

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if the user is Pro
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single()

    if (profileError || !profile || !profile.is_pro) {
      return NextResponse.json({ error: "Pro subscription required" }, { status: 403 })
    }

    // Get the message and analysis ID from the request
    const { message, analysisId } = await request.json()

    // Get the analysis from the database
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single()

    if (error || !analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    // Get the chat history from the database
    const { data: chatHistory, error: chatError } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true })

    if (chatError) {
      console.error("Chat history error:", chatError)
    }

    // Prepare the messages for the OpenAI API
    const messages = [
      {
        role: "system",
        content: `You are a helpful AI credit assistant. You have access to the user's credit analysis and can answer questions about their credit report, explain credit concepts, or provide more details about the recommendations. Here is the analysis data: ${JSON.stringify(analysis.result)}`,
      },
      ...(chatHistory || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: message,
      },
    ]

    // Call the OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      max_tokens: 1000,
    })

    const response = completion.choices[0].message.content

    // Save the user message and AI response to the database
    await supabase.from("chat_messages").insert([
      {
        analysis_id: analysisId,
        role: "user",
        content: message,
        user_id: user.id,
      },
      {
        analysis_id: analysisId,
        role: "assistant",
        content: response,
        user_id: user.id,
      },
    ])

    // Return the AI response
    return NextResponse.json({ response })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
