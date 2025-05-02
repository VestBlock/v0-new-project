import { NextResponse } from "next/server"
import { initializeWorkers } from "@/lib/worker-init"

// Initialize workers when the API is first accessed
initializeWorkers().catch(console.error)

export async function GET() {
  return NextResponse.json({ status: "ok", message: "API is running" })
}
