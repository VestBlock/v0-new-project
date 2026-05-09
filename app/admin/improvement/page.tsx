import Link from 'next/link'
import { redirect } from 'next/navigation'

import { StrategyUpdateActions } from '@/components/admin/strategy-update-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getImprovementDashboardSnapshot } from '@/lib/improvement/repository'

export const dynamic = 'force-dynamic'

export default async function ImprovementPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const snapshot = await getImprovementDashboardSnapshot()
  const summary = snapshot.report?.summary_json || {}

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Continuous improvement</p>
          <h1 className="text-2xl font-semibold text-white">Improvement engine</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/research">Research</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/experiments">Experiments</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin home</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Latest run</CardTitle></CardHeader>
          <CardContent className="text-white">{snapshot.latestRun?.run_type || 'No runs yet'}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Best city</CardTitle></CardHeader>
          <CardContent className="text-white">{String(summary.bestCity || 'n/a')}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Best niche</CardTitle></CardHeader>
          <CardContent className="text-white">{String(summary.bestNiche || 'n/a')}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-sm text-slate-300">Pending approvals</CardTitle></CardHeader>
          <CardContent className="text-white">{snapshot.queuedUpdates.filter((row) => row.approval_status === 'queued').length}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Top wins</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-200">
            {Array.isArray(summary.topWins) && summary.topWins.length
              ? summary.topWins.map((item: string) => <div key={item}>{item}</div>)
              : <div className="text-slate-500">No daily report stored yet.</div>}
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Biggest losses</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-200">
            {Array.isArray(summary.biggestLosses) && summary.biggestLosses.length
              ? summary.biggestLosses.map((item: string) => <div key={item}>{item}</div>)
              : <div className="text-slate-500">No daily report stored yet.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Queued strategy updates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {snapshot.queuedUpdates.length ? snapshot.queuedUpdates.map((row) => (
            <div key={row.id} className="rounded border border-slate-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{row.title}</div>
                  <p className="mt-1 text-sm text-slate-400">{row.rationale}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{row.category}</Badge>
                  <Badge variant={row.risk_level === 'low' ? 'default' : 'outline'}>{row.risk_level}</Badge>
                  <Badge variant="outline">{row.approval_status}</Badge>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">Target: {row.target_type} · {row.target_key}</div>
              <div className="mt-3">
                <StrategyUpdateActions id={row.id} approvalStatus={row.approval_status} />
              </div>
            </div>
          )) : <div className="text-sm text-slate-500">No queued strategy updates yet.</div>}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Recent insights</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-200">
          {snapshot.recentInsights.length ? snapshot.recentInsights.map((row) => (
            <div key={row.id} className="rounded border border-slate-800 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-white">{row.title}</div>
                <Badge variant="outline">{row.severity}</Badge>
              </div>
              <p className="mt-1 text-slate-400">{row.summary}</p>
            </div>
          )) : <div className="text-slate-500">No insights recorded yet.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
