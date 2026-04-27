import { NextResponse } from "next/server"
import { checkAdminAccess } from "@/lib/auth/admin"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const adminCheck = await checkAdminAccess()

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: adminCheck.user ? 403 : 401 },
      )
    }

    if (process.env.ENABLE_ADMIN_SQL_CONSOLE !== "true") {
      return NextResponse.json(
        { error: "Admin SQL console is disabled." },
        { status: 404 },
      )
    }

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
