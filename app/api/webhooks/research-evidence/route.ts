export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { verifyResearchCallback } from '@/lib/research/callbackSecurity'
import { researchWorkerCallbackSchema } from '@/lib/research/evidence'
import { persistResearchWorkerCallback } from '@/lib/research/repository'

const MAX_CALLBACK_BYTES = 80_000

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to persist research evidence.'
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > MAX_CALLBACK_BYTES) {
    return NextResponse.json({ ok: false, error: 'Research callback exceeds the 80 KB limit.' }, { status: 413 })
  }

  const verification = verifyResearchCallback({
    secret: process.env.RESEARCH_WORKER_CALLBACK_SECRET,
    rawBody,
    timestampHeader: request.headers.get('x-vestblock-timestamp'),
    signatureHeader: request.headers.get('x-vestblock-signature'),
  })
  if (!verification.ok) {
    return NextResponse.json({ ok: false, error: verification.reason }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'Research callback must contain valid JSON.' }, { status: 400 })
  }
  const parsed = researchWorkerCallbackSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: 'Research callback payload did not match the approved contract.',
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })).slice(0, 8),
    }, { status: 400 })
  }

  try {
    const result = await persistResearchWorkerCallback({ callback: parsed.data, rawBody })
    if (!result.accepted) {
      return NextResponse.json({ ok: false, ...result }, { status: result.reason === 'Research job was not found.' ? 404 : 409 })
    }
    return NextResponse.json({ ok: true, ...result }, { status: result.duplicate ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 })
  }
}
