export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
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
