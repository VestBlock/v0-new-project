export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { runCommandCenterAutopilot } from '@/lib/admin/autonomousOperatingSystem'
import { commandCenterAuthError } from '../auth'

const autopilotRunSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  dispatch: z.boolean().optional().default(false),
  send: z.boolean().optional().default(false),
})

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return commandCenterAuthError(adminCheck)
  }

  try {
    const data = await getCommandCenterData()
    return NextResponse.json({ success: true, autopilot: data.autopilot })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load command-center autopilot.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return commandCenterAuthError(adminCheck)
  }

  const parsed = autopilotRunSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const data = await getCommandCenterData()
    const result = await runCommandCenterAutopilot(data, parsed.data)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Command-center autopilot failed.' },
      { status: 500 }
    )
  }
}
