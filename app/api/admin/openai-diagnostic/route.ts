import type { NextRequest } from "next/server"
import { runOpenAIDiagnostic } from "@/lib/openai-diagnostic"
import { supabase } from "@/lib/supabase-client"

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userError || !userData || userData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Run the diagnostic
    const diagnosticResult = await runOpenAIDiagnostic()

    return new Response(
      JSON.stringify({
        success: true,
        data: diagnosticResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("OpenAI diagnostic error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
