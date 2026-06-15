export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { commandCenterAuthError } from './auth'

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return commandCenterAuthError(adminCheck)
  }

  try {
    const data = await getCommandCenterData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load command center data.' },
      { status: 500 }
    )
  }
}
