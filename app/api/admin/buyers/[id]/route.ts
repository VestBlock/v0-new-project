export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getBuyerById } from '@/lib/buyers/repository'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const data = await getBuyerById(id)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Buyer not found.' }, { status: 500 })
  }
}
