export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { reconcileBufferDelivery } from '@/lib/social/bufferPublisher'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const result = await reconcileBufferDelivery()
  return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 207 })
}
