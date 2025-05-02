import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: "Missing Supabase environment variables",
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Simple query to test connection
    const { data, error } = await supabase.from("profiles").select("id").limit(1)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Supabase connection successful",
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to connect to Supabase",
    })
  }
}
