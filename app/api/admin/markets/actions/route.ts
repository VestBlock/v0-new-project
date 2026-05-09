export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { discoverMarkets } from '@/lib/leads/marketExpansion'
import type { TargetMarketRecord } from '@/lib/leads/types'

export async function POST(request: NextRequest) {
  const { admin, response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const intent = String(body.intent || '').trim()

    if (intent === 'refresh_queue') {
      const summary = await discoverMarkets()
      return NextResponse.json({ success: true, summary })
    }

    if (intent === 'activate_top_queued') {
      const countRaw = Number(body.count)
      const count = Number.isFinite(countRaw) ? Math.min(Math.max(Math.round(countRaw), 1), 12) : 5

      const { data: queuedMarkets, error } = await admin
        .from('target_markets')
        .select('*')
        .eq('status', 'queued')
        .order('final_score', { ascending: false })
        .limit(count)

      if (error) {
        return NextResponse.json({ error: error.message || 'Unable to load queued markets.' }, { status: 500 })
      }

      const ids = (queuedMarkets || []).map((market) => market.id)
      if (!ids.length) {
        return NextResponse.json({ success: true, activated: 0, markets: [] })
      }

      const { data: updated, error: updateError } = await admin
        .from('target_markets')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', ids)
        .select('*')

      if (updateError) {
        return NextResponse.json({ error: updateError.message || 'Unable to activate markets.' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        activated: updated?.length || 0,
        markets: (updated || []) as TargetMarketRecord[],
      })
    }

    if (intent === 'boost_market') {
      const marketId = String(body.marketId || '').trim()
      const amountRaw = Number(body.amount)
      const amount = Number.isFinite(amountRaw) ? Math.min(Math.max(Math.round(amountRaw), 1), 50) : 12

      if (!marketId) {
        return NextResponse.json({ error: 'Market ID is required.' }, { status: 400 })
      }

      const { data: current, error } = await admin
        .from('target_markets')
        .select('*')
        .eq('id', marketId)
        .single()

      if (error || !current) {
        return NextResponse.json({ error: 'Market not found.' }, { status: 404 })
      }

      const { data: updated, error: updateError } = await admin
        .from('target_markets')
        .update({
          final_score: Number(current.final_score || 0) + amount,
          status: 'active',
          updated_at: new Date().toISOString(),
          performance_json: {
            ...(current.performance_json || {}),
            manualBoostAmount: amount,
            manualBoostedAt: new Date().toISOString(),
            manualBoostCount: Number(current.performance_json?.manualBoostCount || 0) + 1,
          },
        })
        .eq('id', marketId)
        .select('*')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message || 'Unable to boost market.' }, { status: 500 })
      }

      return NextResponse.json({ success: true, market: updated as TargetMarketRecord })
    }

    return NextResponse.json({ error: 'Unsupported intent.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to run market action.' },
      { status: 500 }
    )
  }
}
