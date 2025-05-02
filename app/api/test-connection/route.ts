import { NextResponse } from "next/server"

export async function GET() {
  try {
    return NextResponse.json(
      {
        success: true,
        message: "API connection successful",
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Test connection error:", error)

    // Ensure we return JSON even on error
    return NextResponse.json(
      {
        success: false,
        error: "API test failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
