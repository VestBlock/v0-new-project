export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getLeadById } from '@/lib/leads/repository'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const data = await getLeadById(id)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead not found.' },
      { status: 500 }
    )
  }
}
