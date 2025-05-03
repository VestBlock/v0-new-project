import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  const startTime = Date.now()
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      api: { status: "ok" },
      database: { status: "unknown" },
      openai: { status: "unknown" },
    },
    environment: {
      openai_api_key: process.env.OPENAI_API_KEY ? "configured" : "missing",
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing",
      supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "missing",
    },
  }

  // Check database connection
  try {
    const { data, error } = await supabase.from("health_checks").select("count").limit(1)
    if (error) {
      healthStatus.services.database = {
        status: "error",
        message: error.message,
      }
      healthStatus.status = "degraded"
    } else {
      healthStatus.services.database = {
        status: "ok",
        latency_ms: Date.now() - startTime,
      }
    }
  } catch (error) {
    healthStatus.services.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown database error",
    }
    healthStatus.status = "degraded"
  }

  // Check OpenAI connection
  try {
    const openaiStartTime = Date.now()
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
            content: "Respond with 'OK' if you receive this message.",
          },
        ],
        max_tokens: 5,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      healthStatus.services.openai = {
        status: "error",
        message: `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`,
      }
      healthStatus.status = "degraded"
    } else {
      healthStatus.services.openai = {
        status: "ok",
        latency_ms: Date.now() - openaiStartTime,
      }
    }
  } catch (error) {
    healthStatus.services.openai = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown OpenAI error",
    }
    healthStatus.status = "degraded"
  }

  // Log health check
  try {
    await supabase.from("health_checks").insert({
      status: healthStatus.status,
      services: healthStatus.services,
      timestamp: healthStatus.timestamp,
    })
  } catch (error) {
    console.error("Failed to log health check:", error)
  }

  return NextResponse.json(healthStatus)
}
