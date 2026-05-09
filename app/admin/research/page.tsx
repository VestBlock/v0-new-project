import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getImprovementDashboardSnapshot } from '@/lib/improvement/repository'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const snapshot = await getImprovementDashboardSnapshot()

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Continuous improvement</p>
          <h1 className="text-2xl font-semibold text-white">Research briefs</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/improvement">Improvement</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/experiments">Experiments</Link>
          </Button>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Latest briefs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {snapshot.recentResearch.length ? snapshot.recentResearch.map((row) => (
            <div key={row.id} className="rounded border border-slate-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{row.brief_title}</div>
                  <p className="mt-1 text-sm text-slate-400">{row.summary}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{row.theme}</Badge>
                  <Badge variant="outline">{row.priority}</Badge>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              </div>
              {row.source_url ? (
                <a className="mt-3 inline-block text-sm text-cyan-300 hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                  {row.source_title || row.source_url}
                </a>
              ) : null}
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                {(row.recommendations_json || []).map((item) => (
                  <div key={item}>• {item}</div>
                ))}
              </div>
            </div>
          )) : <div className="text-sm text-slate-500">No research briefs generated yet.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
