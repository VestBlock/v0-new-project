import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Raw SQL over HTTP is intentionally unsupported. Database changes must use
 * reviewed, version-controlled migrations instead of an application endpoint.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'The SQL console has been permanently retired. Apply a reviewed migration instead.',
    },
    { status: 410 }
  )
}
