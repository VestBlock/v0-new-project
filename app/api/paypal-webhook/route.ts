import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The legacy PayPal webhook did not verify provider signatures. Keep the route
 * closed so stale provider configuration cannot mutate payment state. PayPal
 * must be configured to use /api/webhook, which verifies every event.
 */
export async function POST() {
  return NextResponse.json(
    {
      received: false,
      error: 'Legacy webhook retired. Configure PayPal to use /api/webhook.',
    },
    { status: 410 }
  )
}
