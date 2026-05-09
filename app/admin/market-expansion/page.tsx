import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarketExpansionConsole } from '@/components/admin/market-expansion-console'
import { LeadSourceRunner } from '@/components/admin/lead-source-runner'
import type { TargetMarketRecord } from '@/lib/leads/types'

export const dynamic = 'force-dynamic'

export default async function MarketExpansionPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: markets }, { data: leads }] = await Promise.all([
    admin.from('target_markets').select('*').order('final_score', { ascending: false }).limit(100),
    admin.from('leads').select('city,state,niche,status,lead_score,delivery_status').limit(2000),
  ])

  const queued = (markets || []).filter((market) => market.status === 'queued')
  const active = (markets || []).filter((market) => market.status === 'active')
  const scraped = (markets || []).filter((market) => market.status === 'scraped')
  const exhausted = (markets || []).filter((market) => market.status === 'exhausted')

  const perCity = new Map<string, number>()
  const perNiche = new Map<string, number>()
  const repliesPerCity = new Map<string, { sent: number; replied: number }>()
  const perCityNiche = new Map<string, Map<string, number>>()
  for (const lead of leads || []) {
    const key = [lead.city, lead.state].filter(Boolean).join(', ')
    if (key) perCity.set(key, (perCity.get(key) || 0) + 1)
    if (lead.niche) perNiche.set(lead.niche, (perNiche.get(lead.niche) || 0) + 1)
    if (key && lead.niche) {
      const nicheCounts = perCityNiche.get(key) || new Map<string, number>()
      nicheCounts.set(lead.niche, (nicheCounts.get(lead.niche) || 0) + 1)
      perCityNiche.set(key, nicheCounts)
    }
    if (key) {
      const current = repliesPerCity.get(key) || { sent: 0, replied: 0 }
      if (lead.delivery_status === 'sent') current.sent += 1
      if (['replied', 'booked'].includes(lead.delivery_status || '') || ['replied', 'interested', 'qualified', 'closed_won'].includes(lead.status || '')) current.replied += 1
      repliesPerCity.set(key, current)
    }
  }

  const topCities = Array.from(perCity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const topNiches = Array.from(perNiche.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const bestReplyCities = Array.from(repliesPerCity.entries())
    .filter(([, stats]) => stats.sent > 0)
    .map(([city, stats]) => ({ city, rate: Math.round((stats.replied / stats.sent) * 100) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6)

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Growth automation</p>
          <h1 className="text-2xl font-semibold text-white">Market Expansion Engine</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/lead-sources">Lead Sources</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/leads">Back to leads</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Active today</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{active.length}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Queued</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{queued.length}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Scraped</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{scraped.length}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Exhausted</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{exhausted.length}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Leads tracked</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{leads?.length || 0}</div></CardContent></Card>
      </div>

      <MarketExpansionConsole initialMarkets={(markets || []) as TargetMarketRecord[]} />

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Source Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadSourceRunner />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Top-performing cities</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {bestReplyCities.length ? bestReplyCities.map((item) => (
              <div key={item.city} className="flex items-center justify-between">
                <span>{item.city}</span>
                <Badge variant="secondary">{item.rate}% reply</Badge>
              </div>
            )) : <div className="text-slate-500">No reply data yet.</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Best-performing niches</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {topNiches.length ? topNiches.map(([niche, count]) => (
              <div key={niche} className="flex items-center justify-between">
                <span>{niche}</span>
                <Badge variant="secondary">{count} leads</Badge>
              </div>
            )) : <div className="text-slate-500">No niche data yet.</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Tomorrow&apos;s likely cities</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {(queued.slice(0, 8)).map((market) => (
              <div key={market.id} className="flex items-center justify-between">
                <span>{market.city}, {market.state}</span>
                <Badge variant="secondary">{market.final_score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Cities by lead volume</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {topCities.length ? topCities.map(([city, count]) => (
              <div key={city} className="flex items-center justify-between">
                <span>{city}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            )) : <div className="text-slate-500">No city volume yet.</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Market queue</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {(markets || []).slice(0, 12).map((market) => (
              <div key={market.id} className="rounded border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-white">{market.city}, {market.state}</div>
                  <Badge variant="secondary">{market.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {market.metro_area || 'Local market'} · score {market.final_score}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  last scrape {market.last_scraped_at ? new Date(market.last_scraped_at).toLocaleDateString() : 'never'} · last run {Number(market.performance_json?.lastLeadCount || 0)} leads
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(market.niche_focus || []).slice(0, 3).map((niche: string) => (
                    <Badge key={niche} variant="outline">{niche}</Badge>
                  ))}
                  {(() => {
                    const cityKey = [market.city, market.state].filter(Boolean).join(', ')
                    const nicheCounts = perCityNiche.get(cityKey)
                    if (!nicheCounts?.size) return null
                    const bestNiche = Array.from(nicheCounts.entries()).sort((a, b) => b[1] - a[1])[0]
                    if (!bestNiche) return null
                    return <Badge variant="secondary">best vertical: {bestNiche[0]}</Badge>
                  })()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
