export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerUser } from '@/lib/auth/admin'
import { listCustomerOpportunityMatches } from '@/lib/matching/opportunity-matches'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  try {
    return NextResponse.json({ matches: await listCustomerOpportunityMatches(user.id) }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' },
    })
  } catch (error) {
    console.error('[opportunity-matches] customer list failed', error)
    return NextResponse.json({ error: 'Your opportunity matches are temporarily unavailable.' }, { status: 500 })
  }
}
