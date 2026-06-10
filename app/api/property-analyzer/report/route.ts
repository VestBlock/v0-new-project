export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  buildAnalyzerReportHtml,
  type AnalyzerReportType,
} from '@/lib/property/reportGenerator'

const reportSchema = z.object({
  reportType: z.enum(['investor', 'buyer', 'lender']),
  address: z.string().trim().min(3).max(260),
  form: z.record(z.string(), z.string()).default({}),
  estimate: z.unknown(),
  opportunity: z.unknown(),
})

function fileStem(reportType: AnalyzerReportType) {
  if (reportType === 'buyer') return 'vestblock-buyer-packet'
  if (reportType === 'lender') return 'vestblock-lender-packet'
  return 'vestblock-investor-report'
}

export async function POST(request: NextRequest) {
  try {
    const parsed = reportSchema.safeParse(await request.json().catch(() => ({})))

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing report inputs.' },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const html = buildAnalyzerReportHtml(payload)
    const baseName = `${fileStem(payload.reportType)}-${payload.address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72)}`

    try {
      const { htmlToPdfBuffer } = await import('@/lib/letters/render')
      const pdf = await htmlToPdfBuffer(html)

      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        },
      })
    } catch (error) {
      console.error('[property-analyzer/report] PDF generation fallback to HTML:', error)

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.html"`,
        },
      })
    }
  } catch (error) {
    console.error('[property-analyzer/report] request failed:', error)
    return NextResponse.json(
      { error: 'Unable to generate the analyzer report right now.' },
      { status: 500 }
    )
  }
}
