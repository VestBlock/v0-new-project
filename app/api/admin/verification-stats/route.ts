import { NextResponse, type NextRequest } from "next/server"
import { getApiVerificationStats } from "@/lib/api-verification-db"

export async function GET(request: NextRequest) {
  // Only allow in development or with admin token
  const isAdmin = request.headers.get("x-admin-token") === process.env.ADMIN_SECRET_KEY
  const isDev = process.env.NODE_ENV === "development"

  if (!isAdmin && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get timeframe from query params or default to 'day'
    const url = new URL(request.url)
    const timeframe = (url.searchParams.get("timeframe") as "day" | "week" | "month") || "day"

    const result = await getApiVerificationStats(timeframe)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ stats: result.stats })
  } catch (error) {
    console.error("Error retrieving verification stats:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
