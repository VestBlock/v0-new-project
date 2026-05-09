import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkAdminAccess } from '@/lib/auth/admin'
import { listDailyGrowthReports } from '@/lib/reporting/repository'

export const dynamic = 'force-dynamic'

export default async function DailyReportsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const reports = await listDailyGrowthReports(30)
  const latest = reports[0]

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Morning intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Daily growth reports</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/admin/seo-opportunities">SEO opportunities</Link></Button>
          <Button asChild variant="outline"><Link href="/admin-panel">Admin home</Link></Button>
        </div>
      </div>

      {latest ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Latest date</CardTitle></CardHeader><CardContent className="text-white">{latest.report_date}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best city</CardTitle></CardHeader><CardContent className="text-white">{String((latest.summary_json as any)?.bestCity || 'n/a')}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best niche</CardTitle></CardHeader><CardContent className="text-white">{String((latest.summary_json as any)?.bestNiche || 'n/a')}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best SEO opportunity</CardTitle></CardHeader><CardContent className="text-white">{String((latest.summary_json as any)?.bestSeoOpportunity || 'n/a')}</CardContent></Card>
        </div>
      ) : null}

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Report history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {reports.length ? reports.map((report) => (
            <div key={report.id} className="flex flex-col gap-3 rounded border border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-white">{report.report_date}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary">{String((report.summary_json as any)?.bestCity || 'No city')}</Badge>
                  <Badge variant="outline">{String((report.summary_json as any)?.bestNiche || 'No niche')}</Badge>
                  <Badge variant="outline">{String((report.summary_json as any)?.bestSeoOpportunity || 'No SEO winner')}</Badge>
                </div>
              </div>
              <Button asChild size="sm" variant="outline"><Link href={`/admin/reports/daily/${report.report_date}`}>Open report</Link></Button>
            </div>
          )) : <div className="text-sm text-slate-400">No daily reports stored yet.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
