import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { LeadSourceRunner } from '@/components/admin/lead-source-runner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function LeadSourcesPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: sources } = await admin
    .from('lead_sources')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const samEnabled = ['1', 'true', 'yes', 'on'].includes((process.env.LEADS_ENABLE_SAM || '').toLowerCase())
  const samPaused = ['1', 'true', 'yes', 'on'].includes((process.env.SAM_AUTOMATION_PAUSED || '').toLowerCase())
  const providerReadiness = [
    {
      label: 'Wisconsin DFI',
      status: 'Ready',
      detail: 'Public source',
      ready: true,
    },
    {
      label: 'Code Violations',
      status: 'Ready',
      detail: 'Public source',
      ready: true,
    },
    {
      label: 'Google Places',
      status: process.env.GOOGLE_PLACES_API_KEY ? 'Configured' : 'Key needed',
      detail: 'GOOGLE_PLACES_API_KEY',
      ready: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    },
    {
      label: 'Outscraper Maps',
      status: process.env.OUTSCRAPER_API_KEY ? 'Configured' : 'Key needed',
      detail: 'OUTSCRAPER_API_KEY',
      ready: Boolean(process.env.OUTSCRAPER_API_KEY),
    },
    {
      label: 'Apify Yelp',
      status: process.env.APIFY_TOKEN ? 'Configured' : 'Key needed',
      detail: 'APIFY_TOKEN',
      ready: Boolean(process.env.APIFY_TOKEN),
    },
    {
      label: 'SAM.gov',
      status: samPaused ? 'Paused' : samEnabled ? (process.env.SAM_GOV_API_KEY ? 'Configured' : 'Key needed') : 'Paused',
      detail: samPaused ? 'Paused until key is updated' : 'SAM_GOV_API_KEY',
      ready: samEnabled && !samPaused && Boolean(process.env.SAM_GOV_API_KEY),
    },
  ]

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Lead intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Lead sources</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/market-expansion">Market Expansion</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/scrape-runs">Scrape runs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/leads">Back to leads</Link>
          </Button>
        </div>
      </div>

      <LeadSourceRunner />

      <div className="grid gap-4 md:grid-cols-6">
        {providerReadiness.map((item) => (
          <Card key={item.label} className="border-slate-800 bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <Badge variant={item.ready ? 'default' : 'secondary'}>{item.status}</Badge>
              <p>{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {(sources || []).map((source) => (
          <Card key={source.id} className="border-slate-800 bg-slate-950/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">{source.name}</CardTitle>
                <p className="mt-1 text-sm text-slate-400">{source.source_key}</p>
              </div>
              <Badge variant={source.is_active ? 'default' : 'secondary'}>
                {source.is_active ? 'Active' : 'Paused'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <div>Category: {source.category}</div>
              <div>Type: {source.source_type}</div>
              <div>Market: {[source.city, source.state].filter(Boolean).join(', ') || 'Multi-market'}</div>
              <div>Last run: {source.last_run_at ? new Date(source.last_run_at).toLocaleString() : 'Never'}</div>
              {source.base_url ? (
                <a className="text-cyan-300 hover:underline" href={source.base_url} target="_blank" rel="noreferrer">
                  {source.base_url}
                </a>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
