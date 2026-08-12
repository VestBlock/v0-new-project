export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { parsePropertyImport } from '@/lib/property-intelligence/import'
import { importPropertyIntelligenceRows } from '@/lib/property-intelligence/repository'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const form = await request.formData()
    const file = form.get('file')
    const sourceName = String(form.get('sourceName') || '').trim()
    const sourceUrl = String(form.get('sourceUrl') || '').trim()
    const apply = String(form.get('apply') || '') === 'true'
    const confidenceLevel = Number(form.get('confidenceLevel') || 70)

    if (!sourceName) return NextResponse.json({ error: 'Source name is required.' }, { status: 400 })
    if (!(file instanceof File)) return NextResponse.json({ error: 'CSV or GeoJSON file is required.' }, { status: 400 })

    const text = await file.text()
    const preview = parsePropertyImport(text, {
      sourceName,
      sourceUrl,
      fileName: file.name,
      fileType: file.type,
      confidenceLevel: Number.isFinite(confidenceLevel) ? confidenceLevel : 70,
    })

    if (!apply) {
      return NextResponse.json({
        success: true,
        applied: false,
        preview: preview.slice(0, 25),
        summary: {
          rows: preview.length,
          highScore: preview.filter((row) => row.dealScore.score >= 75).length,
          vacantLots: preview.filter((row) => row.vacantLotConfidence >= 50).length,
          signals: preview.reduce((sum, row) => sum + row.signals.length, 0),
        },
      })
    }

    const result = await importPropertyIntelligenceRows({
      rows: preview,
      sourceName,
      sourceUrl,
      fileName: file.name,
      importedBy: user?.id,
      confidenceLevel: Number.isFinite(confidenceLevel) ? confidenceLevel : 70,
    })

    return NextResponse.json({ success: true, applied: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import property intelligence file.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
