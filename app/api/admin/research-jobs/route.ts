export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { checkAdminAccess } from '@/lib/auth/admin'
import { researchJobRequestSchema } from '@/lib/research/evidence'
import { createResearchJob } from '@/lib/research/repository'

const MAX_REQUEST_BYTES = 16_384

export async function POST(request: Request) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ ok: false, error: adminCheck.user ? 'Admin access required.' : 'Authentication required.' }, { status: adminCheck.user ? 403 : 401 })
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: 'Research job request exceeds the 16 KB limit.' }, { status: 413 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'Research job request must contain valid JSON.' }, { status: 400 })
  }
  const parsed = researchJobRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: 'Research job request did not match the approved contract.',
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })).slice(0, 8),
    }, { status: 400 })
  }

  try {
    const job = await createResearchJob({ request: parsed.data, requestedBy: adminCheck.user?.email || null })
    return NextResponse.json({
      ok: true,
      job,
      execution: 'queued_only',
      note: 'This endpoint creates a reviewable job only. It does not fetch, enrich, enroll, or send.',
    }, { status: job.duplicate ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to queue research job.' }, { status: 409 })
  }
}
