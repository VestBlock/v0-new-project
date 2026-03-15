import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { sql } = await request.json()

    if (!sql) {
      return NextResponse.json({ error: "No SQL provided" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Execute the SQL directly
    const { data, error } = await supabase.rpc("pgclient", { query: sql })

    if (error) {
      console.error("SQL execution error:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: "SQL executed successfully",
    })
  } catch (error) {
    console.error("SQL execution error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error,
      },
      { status: 500 },
    )
  }
}
