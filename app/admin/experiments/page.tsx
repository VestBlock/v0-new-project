import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getImprovementDashboardSnapshot } from '@/lib/improvement/repository'

export const dynamic = 'force-dynamic'

export default async function ExperimentsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const snapshot = await getImprovementDashboardSnapshot()

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Continuous improvement</p>
          <h1 className="text-2xl font-semibold text-white">Experiments and live tuning</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/improvement">Improvement</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/research">Research</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Active score adjustments</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {snapshot.activeAdjustments.length ? snapshot.activeAdjustments.map((row) => (
              <div key={row.id} className="rounded border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span>{row.scope_type} · {row.scope_key}</span>
                  <Badge variant="secondary">{row.score_delta > 0 ? `+${row.score_delta}` : row.score_delta}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">{row.reason}</div>
              </div>
            )) : <div className="text-slate-500">No active score adjustments yet.</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Active outreach variants</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {snapshot.activeVariants.length ? snapshot.activeVariants.map((row) => (
              <div key={row.id} className="rounded border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span>{row.segment_type} · {row.segment_key}</span>
                  <Badge variant="outline">{row.channel}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">{row.opener || row.body_guidance || 'No guidance text stored.'}</div>
              </div>
            )) : <div className="text-slate-500">No active outreach variants yet.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Recent experiment results</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-200">
          {snapshot.recentExperiments.length ? snapshot.recentExperiments.map((row) => (
            <div key={row.id} className="rounded border border-slate-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium text-white">{row.experiment_key}</div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{row.category}</Badge>
                  {row.winner ? <Badge>Winner</Badge> : <Badge variant="outline">Observed</Badge>}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">Variant: {row.variant_key}{row.baseline_key ? ` · Baseline: ${row.baseline_key}` : ''}</div>
            </div>
          )) : <div className="text-slate-500">No experiment results yet.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
