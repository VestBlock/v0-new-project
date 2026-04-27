import { NextResponse } from "next/server"

export const maxDuration = 60 // Set to 60s, the maximum for the Hobby plan

export async function GET() {
  return NextResponse.json({ error: "Job ID is required." }, { status: 400 })
}
