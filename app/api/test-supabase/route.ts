import { NextResponse } from "next/server"
import { testSupabaseConnection } from "@/lib/supabase-client"

export async function GET() {
  try {
    const result = await testSupabaseConnection()

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to connect to Supabase",
          error: result.error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Successfully connected to Supabase",
    })
  } catch (error) {
    console.error("Error testing Supabase connection:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Exception while testing Supabase connection",
        error: String(error),
      },
      { status: 500 },
    )
  }
}
