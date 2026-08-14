"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OsmPropertyMap } from '@/components/property-intelligence/osm-property-map'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'

type ApiResult = {
  properties: PropertyIntelligenceRecord[]
  summary: { total: number; vacantLots: number; highScore: number; averageScore: number } | null
  error?: string
}

function tone(score: number) {
  if (score >= 75) return 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
  if (score >= 55) return 'border-cyan-400/30 bg-cyan-400/15 text-cyan-200'
  return 'border-slate-600 bg-slate-800 text-slate-200'
}

export function PublicDealHunter() {
  const [properties, setProperties] = useState<PropertyIntelligenceRecord[]>([])
  const [summary, setSummary] = useState<ApiResult['summary']>(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/property-intelligence')
      .then((response) => response.json())
      .then((data: ApiResult) => {
        setProperties(data.properties || [])
        setSummary(data.summary || null)
        setSelectedId(data.properties?.[0]?.id || '')
        setError(data.error || '')
      })
      .catch(() => setError('Property intelligence is not available yet.'))
  }, [])

  const selected = useMemo(() => properties.find((property) => property.id === selectedId) || properties[0] || null, [properties, selectedId])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Mapped opportunities', summary?.total || properties.length],
          ['Vacant/land candidates', summary?.vacantLots || 0],
          ['High-score records', summary?.highScore || 0],
          ['Average score', summary?.averageScore || 0],
        ].map(([label, value]) => (
          <Card key={label} className="border-slate-800 bg-slate-950/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <Card className="border-amber-400/20 bg-amber-950/20">
          <CardContent className="p-4 text-sm text-amber-100">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <OsmPropertyMap properties={properties} selectedId={selected?.id} onSelect={setSelectedId} publicMode />

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Opportunity Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div>
                  <div className="text-lg font-semibold text-white">Opportunity near {selected.city || 'a target market'}</div>
                  <div className="text-sm text-slate-400">{[selected.city, selected.state, selected.zip_code].filter(Boolean).join(', ')}</div>
                </div>
                <Badge className={tone(selected.deal_scores?.[0]?.score || 0)}>Lead score {selected.deal_scores?.[0]?.score || 0}/100</Badge>
                <p className="text-sm text-slate-300">{selected.deal_scores?.[0]?.explanation || 'This record is available for public-signal review.'}</p>
                <div className="flex flex-wrap gap-2">
                  {(selected.property_signals || []).map((signal) => (
                    <Badge key={`${signal.signal_type}-${signal.signal_label}`} variant="outline">{signal.signal_label}</Badge>
                  ))}
                </div>
                <Button asChild><Link href="/sell">Request a Property Review</Link></Button>
              </>
            ) : (
              <div className="text-sm text-slate-400">No public property intelligence records are available yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardContent className="p-4 text-sm text-slate-400">
          This public view deliberately obscures exact property identity and map location. Data comes from public records, user uploads, and open-source research and may be incomplete or outdated. Exact records remain subject to VestBlock review, privacy controls, Fair Housing, and applicable real-estate rules.
        </CardContent>
      </Card>
    </div>
  )
}
