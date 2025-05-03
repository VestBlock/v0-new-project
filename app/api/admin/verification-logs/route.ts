import { NextResponse, type NextRequest } from "next/server"
import { getRecentApiVerificationLogs } from "@/lib/api-verification-db"

export async function GET(request: NextRequest) {
  // Only allow in development or with admin token
  const isAdmin = request.headers.get("x-admin-token") === process.env.ADMIN_SECRET_KEY
  const isDev = process.env.NODE_ENV === "development"

  if (!isAdmin && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get limit from query params or default to 50
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10)

    const result = await getRecentApiVerificationLogs(limit)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ logs: result.logs })
  } catch (error) {
    console.error("Error retrieving verification logs:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
