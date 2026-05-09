import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getDailyGrowthReportByDate } from '@/lib/reporting/repository'

export const dynamic = 'force-dynamic'

export default async function DailyReportDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const { date } = await params

  try {
    const { report, sections } = await getDailyGrowthReportByDate(date)

    return (
      <div className="space-y-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">Daily report</p>
            <h1 className="text-2xl font-semibold text-white">{report.report_date}</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/admin/reports/daily">Back to reports</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/seo-opportunities">SEO opportunities</Link></Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best city</CardTitle></CardHeader><CardContent className="text-white">{String((report.summary_json as any)?.bestCity || 'n/a')}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best niche</CardTitle></CardHeader><CardContent className="text-white">{String((report.summary_json as any)?.bestNiche || 'n/a')}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best lead category</CardTitle></CardHeader><CardContent className="text-white">{String((report.summary_json as any)?.bestLeadCategory || 'n/a')}</CardContent></Card>
          <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Best SEO opportunity</CardTitle></CardHeader><CardContent className="text-white">{String((report.summary_json as any)?.bestSeoOpportunity || 'n/a')}</CardContent></Card>
        </div>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Recommended actions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-200">
            {Array.isArray(report.recommended_actions) && report.recommended_actions.length
              ? report.recommended_actions.map((item) => <div key={String(item)}>{String(item)}</div>)
              : <div className="text-slate-400">No actions stored.</div>}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.id} className="border-slate-800 bg-slate-950/70">
              <CardHeader><CardTitle className="text-white">{section.section_title}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-200">
                {Object.entries(section.summary_json || {}).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1 rounded border border-slate-800 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">{key}</div>
                    <div className="text-white">
                      {Array.isArray(value)
                        ? value.map((item, index) => (
                            <Badge key={`${key}-${index}`} variant="outline" className="mr-2 mt-1">
                              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                            </Badge>
                          ))
                        : typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  } catch {
    notFound()
  }
}
