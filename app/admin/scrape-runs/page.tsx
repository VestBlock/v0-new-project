import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

type LegacyScrapeRun = {
  id: string
  source_key: string
  run_type: string
  status: string
  result_count: number
  started_at: string
  completed_at: string | null
  error_message?: string | null
}

type PartnerRun = {
  id: string
  lane: 'buyers' | 'lenders' | 'investors'
  sourceKey: string | null
  runType: string
  status: string
  resultCount: number
  market: string
  startedAt: string
  completedAt: string | null
  note: string | null
}

function formatMarket(requestParams: Record<string, unknown> | null | undefined) {
  const city = typeof requestParams?.city === 'string' ? requestParams.city : ''
  const state = typeof requestParams?.state === 'string' ? requestParams.state : ''
  return [city, state].filter(Boolean).join(', ') || 'Multi-market'
}

function isCooldownNote(value: string | null | undefined) {
  return String(value || '').toLowerCase().includes('cooldown')
}

function topSources(runs: LegacyScrapeRun[]) {
  return Object.entries(
    runs.reduce<Record<string, number>>((acc, run) => {
      acc[run.source_key] = (acc[run.source_key] || 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
}

export default async function ScrapeRunsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: legacyRuns }, { data: buyerRuns }, { data: lenderRuns }, { data: investorRuns }] = await Promise.all([
    admin
      .from('scrape_runs')
      .select('id,source_key,run_type,status,result_count,started_at,completed_at,error_message')
      .order('started_at', { ascending: false })
      .limit(200),
    admin
      .from('buyer_outreach_runs')
      .select('id,source_key,run_type,status,result_count,request_params,error_message,started_at,completed_at')
      .in('run_type', ['daily_discovery', 'discovery'])
      .order('started_at', { ascending: false })
      .limit(120),
    admin
      .from('lender_outreach_runs')
      .select('id,source_key,run_type,status,result_count,request_params,error_message,started_at,completed_at')
      .in('run_type', ['daily_discovery', 'discovery'])
      .order('started_at', { ascending: false })
      .limit(120),
    admin
      .from('investor_automation_runs')
      .select('id,source_key,run_type,status,result_count,request_params,error_message,started_at,finished_at')
      .in('run_type', ['daily_discovery', 'discovery'])
      .order('started_at', { ascending: false })
      .limit(120),
  ])

  const partnerRuns: PartnerRun[] = [
    ...((buyerRuns || []).map((run) => ({
      id: `buyer-${run.id}`,
      lane: 'buyers' as const,
      sourceKey: run.source_key,
      runType: run.run_type,
      status: run.status,
      resultCount: run.result_count,
      market: formatMarket((run.request_params as Record<string, unknown> | null | undefined) || null),
      startedAt: run.started_at,
      completedAt: run.completed_at,
      note: run.error_message || null,
    })) || []),
    ...((lenderRuns || []).map((run) => ({
      id: `lender-${run.id}`,
      lane: 'lenders' as const,
      sourceKey: run.source_key,
      runType: run.run_type,
      status: run.status,
      resultCount: run.result_count,
      market: formatMarket((run.request_params as Record<string, unknown> | null | undefined) || null),
      startedAt: run.started_at,
      completedAt: run.completed_at,
      note: run.error_message || null,
    })) || []),
    ...((investorRuns || []).map((run) => ({
      id: `investor-${run.id}`,
      lane: 'investors' as const,
      sourceKey: run.source_key,
      runType: run.run_type,
      status: run.status,
      resultCount: run.result_count,
      market: formatMarket((run.request_params as Record<string, unknown> | null | undefined) || null),
      startedAt: run.started_at,
      completedAt: run.finished_at,
      note: run.error_message || null,
    })) || []),
  ].sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())

  const currentTime = new Date().getTime()
  const recentPartnerRuns = partnerRuns.filter((run) => currentTime - new Date(run.startedAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
  const cooledDownRuns = recentPartnerRuns.filter((run) => isCooldownNote(run.note))
  const failedPartnerRuns = recentPartnerRuns.filter((run) => run.status === 'failed')
  const activePartnerRuns = recentPartnerRuns.filter((run) => !isCooldownNote(run.note) && run.status !== 'failed')
  const topLegacySources = topSources((legacyRuns || []) as LegacyScrapeRun[])

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Partner discovery</p>
          <h1 className="text-2xl font-semibold text-white">Scrape runs</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/lead-sources">Source controls</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/leads">Back to leads</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Partner discovery runs (7d)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-white">{activePartnerRuns.length}</div></CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Cooldown saves (7d)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-white">{cooledDownRuns.length}</div></CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Failed runs (7d)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-white">{failedPartnerRuns.length}</div></CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Archived legacy runtime rows</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-white">{legacyRuns?.length || 0}</div></CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Current partner discovery automation</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lane</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Run type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partnerRuns.length ? (
                partnerRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="capitalize">{run.lane}</TableCell>
                    <TableCell>{run.sourceKey || 'runtime'}</TableCell>
                    <TableCell>{run.market}</TableCell>
                    <TableCell>{run.runType}</TableCell>
                    <TableCell>
                      <Badge variant={isCooldownNote(run.note) ? 'outline' : run.status === 'failed' ? 'secondary' : 'default'}>
                        {isCooldownNote(run.note) ? 'cooled down' : run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.resultCount}</TableCell>
                    <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                    <TableCell className="max-w-[380px] text-xs text-slate-400">
                      {run.note || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500">
                    No current partner discovery runs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Legacy runtime archive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>
              These rows come from VestBlock's pre-pivot runtime.
              They are kept for history, but they are no longer part of the current seller and partner acquisition loop.
            </p>
            <div className="space-y-2">
              {topLegacySources.length ? topLegacySources.map(([sourceKey, count]) => (
                <div key={sourceKey} className="flex items-center justify-between rounded border border-slate-900 px-3 py-2">
                  <span className="truncate">{sourceKey}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              )) : <div className="text-slate-500">No archived legacy runs found.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Archived legacy scrape rows</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Run type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((legacyRuns || []) as LegacyScrapeRun[]).slice(0, 40).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{run.source_key}</TableCell>
                    <TableCell>{run.run_type}</TableCell>
                    <TableCell><Badge variant="secondary">{run.status}</Badge></TableCell>
                    <TableCell>{run.result_count}</TableCell>
                    <TableCell>{new Date(run.started_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
