import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { LeadSourceRunner } from '@/components/admin/lead-source-runner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

type LeadSourceRow = {
  id: string
  name: string
  source_key: string
  category: string
  source_type: string
  city: string | null
  state: string | null
  last_run_at: string | null
  is_active: boolean
  base_url: string | null
}

const CURRENT_SOURCE_KEY_HINTS = [
  'dealmachine',
  'investor',
  'buyer',
  'lender',
  'builder',
  'developer',
  'reo',
  'landbank',
  'code_violation',
  'accela',
  'property',
  'real_estate',
]

function isCurrentRealEstateSource(source: LeadSourceRow) {
  const haystack = [source.name, source.source_key, source.category, source.source_type].join(' ').toLowerCase()
  return CURRENT_SOURCE_KEY_HINTS.some((hint) => haystack.includes(hint))
}

export default async function LeadSourcesPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const admin = createAdminClient()
  const { data } = await admin
    .from('lead_sources')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const sources = ((data || []) as LeadSourceRow[])
  const currentSources = sources.filter(isCurrentRealEstateSource)
  const retiredSources = sources.filter((source) => !isCurrentRealEstateSource(source))

  const providerReadiness = [
    {
      label: 'DealMachine',
      status: process.env.DEALMACHINE_API_KEY ? 'Configured' : 'Key needed',
      detail: 'Primary seller-side inventory, distress stack harvest, and export-driven outreach.',
      ready: Boolean(process.env.DEALMACHINE_API_KEY),
    },
    {
      label: 'Google Places',
      status: process.env.GOOGLE_PLACES_API_KEY ? 'Configured' : 'Key needed',
      detail: 'Buyer, lender, investor, and builder discovery.',
      ready: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    },
    {
      label: 'Outscraper Maps',
      status: process.env.OUTSCRAPER_API_KEY ? 'Configured' : 'Optional',
      detail: 'Builder and investor directory fallback when Google Places is blocked.',
      ready: Boolean(process.env.OUTSCRAPER_API_KEY),
    },
    {
      label: 'Apify Yelp',
      status: process.env.APIFY_TOKEN ? 'Configured' : 'Optional',
      detail: 'Manual fallback only. No longer scheduled as a daily runtime source.',
      ready: Boolean(process.env.APIFY_TOKEN),
    },
    {
      label: 'Public records',
      status: 'Ready',
      detail: 'Code violations, Accela, municipal records, and land-bank style research.',
      ready: true,
    },
  ]

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Partner acquisition</p>
          <h1 className="text-2xl font-semibold text-white">Source controls</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/investor-partnerships">Investor partnerships</Link>
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

      <div className="grid gap-4 md:grid-cols-5">
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

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Current runtime sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {currentSources.length ? (
              currentSources.map((source) => (
                <div key={source.id} className="rounded border border-slate-800 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{source.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{source.source_key}</div>
                    </div>
                    <Badge variant={source.is_active ? 'default' : 'secondary'}>
                      {source.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {[source.city, source.state].filter(Boolean).join(', ') || 'Multi-market'} · {source.category} · {source.source_type}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Last run: {source.last_run_at ? new Date(source.last_run_at).toLocaleString() : 'Never'}
                  </div>
                  {source.base_url ? (
                    <a className="mt-2 inline-block text-xs text-cyan-300 hover:underline" href={source.base_url} target="_blank" rel="noreferrer">
                      {source.base_url}
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded border border-dashed border-slate-800 p-4 text-slate-400">
                Current partner discovery is now driven by DealMachine plus the buyer, lender, and investor automation tables instead of the old website lead-source registry.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Legacy source archive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded border border-slate-800 px-3 py-2">
              <span>Legacy rows hidden from the live runtime</span>
              <Badge variant="secondary">{retiredSources.length}</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Pre-pivot source lanes stay archived here so they do not crowd the current real-estate operating flow.
            </p>
            {retiredSources.length ? (
              <div className="rounded border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
                Legacy rows are preserved for audit history only. They are no longer part of the daily source mix or command-center runtime.
              </div>
            ) : (
              <div className="text-xs text-slate-500">No legacy source rows found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
