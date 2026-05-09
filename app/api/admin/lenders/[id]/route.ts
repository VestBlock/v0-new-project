export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getLenderById } from '@/lib/lenders/repository'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const data = await getLenderById(id)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lender not found.' }, { status: 500 })
  }
}
