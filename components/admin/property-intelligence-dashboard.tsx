"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Filter, Loader2, MapPinned, PlugZap, RefreshCw, ShieldAlert, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'
import { propertySignalTypes } from '@/lib/property-intelligence/types'
import { generateSafeOutreachSummary } from '@/lib/property-intelligence/outreach'
import { OSINT_COMPLIANCE_WARNING, osintAdapters } from '@/lib/property-intelligence/osint-adapters'
import { OsmPropertyMap } from '@/components/property-intelligence/osm-property-map'

type ApiResult = {
  properties: PropertyIntelligenceRecord[]
  summary: {
    total: number
    vacantLots: number
    highScore: number
    mediumScore: number
    averageScore: number
    withCoordinates: number
  } | null
  error?: string
}

type PreviewResult = {
  success?: boolean
  applied?: boolean
  summary?: { rows: number; highScore: number; vacantLots: number; signals: number }
  imported?: number
  signalsCreated?: number
  error?: string
}

type ProviderStatus = {
  features?: Record<string, boolean>
  providers?: Record<string, { label: string; status: string; note: string; configured?: boolean; enabled?: boolean }>
}

function scoreTone(score: number) {
  if (score >= 75) return 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
  if (score >= 55) return 'border-cyan-400/30 bg-cyan-400/15 text-cyan-200'
  if (score >= 35) return 'border-amber-400/30 bg-amber-400/15 text-amber-200'
  return 'border-slate-600 bg-slate-800 text-slate-200'
}

export function PropertyIntelligenceDashboard() {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [properties, setProperties] = useState<PropertyIntelligenceRecord[]>([])
  const [summary, setSummary] = useState<ApiResult['summary']>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [lastPreview, setLastPreview] = useState<PreviewResult | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [syncMessage, setSyncMessage] = useState('')

  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [signal, setSignal] = useState('all')
  const [vacantOnly, setVacantOnly] = useState(false)
  const [minScore, setMinScore] = useState('55')

  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const selected = useMemo(() => properties.find((property) => property.id === selectedId) || properties[0] || null, [properties, selectedId])
  const outreach = selected ? generateSafeOutreachSummary(selected) : null

  const queryString = useCallback(() => {
    const params = new URLSearchParams({ limit: '250' })
    if (search) params.set('search', search)
    if (city) params.set('city', city)
    if (state) params.set('state', state)
    if (zip) params.set('zip', zip)
    if (signal !== 'all') params.set('signal', signal)
    if (vacantOnly) params.set('vacant', 'true')
    if (minScore) params.set('min_score', minScore)
    return params.toString()
  }, [city, minScore, search, signal, state, vacantOnly, zip])

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      router.replace('/login?redirect=/admin/deal-hunter')
      return null
    }
    return session.access_token
  }, [router, supabase.auth])

  const fetchProperties = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch(`/api/admin/property-intelligence?${queryString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = (await response.json().catch(() => ({}))) as ApiResult
      if (!response.ok) throw new Error(data.error || 'Failed to load property intelligence.')
      setProperties(data.properties || [])
      setSummary(data.summary || null)
      setSelectedId((current) => current || data.properties?.[0]?.id || '')
    } catch (error) {
      toast({
        title: 'Property intelligence unavailable',
        description: error instanceof Error ? error.message : 'Apply the Supabase schema and try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [getToken, queryString, toast])

  const fetchProviders = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch('/api/admin/property-intelligence/providers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
      setProviderStatus(await response.json())
    } catch {
      setProviderStatus(null)
    }
  }, [getToken])

  useEffect(() => {
    fetchProperties()
    fetchProviders()
  }, [fetchProperties, fetchProviders])

  const runImport = async (apply: boolean) => {
    if (!file || !sourceName) {
      toast({ title: 'Import needs a source name and file', variant: 'destructive' })
      return
    }
    setIsImporting(true)
    try {
      const token = await getToken()
      if (!token) return
      const form = new FormData()
      form.set('file', file)
      form.set('sourceName', sourceName)
      form.set('sourceUrl', sourceUrl)
      form.set('confidenceLevel', '70')
      form.set('apply', String(apply))

      const response = await fetch('/api/admin/property-intelligence/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = (await response.json().catch(() => ({}))) as PreviewResult
      if (!response.ok) throw new Error(data.error || 'Import failed.')
      setLastPreview(data)
      toast({
        title: apply ? 'Import applied' : 'Import preview ready',
        description: apply
          ? `${data.imported || 0} properties and ${data.signalsCreated || 0} signals stored.`
          : `${data.summary?.rows || 0} rows parsed, ${data.summary?.vacantLots || 0} vacant-lot candidates.`,
      })
      if (apply) fetchProperties()
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Check the file format and schema.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const exportUrl = `/api/admin/property-intelligence/export?${queryString()}`
  const triggerDealMachineSync = async () => {
    setSyncMessage('')
    const token = await getToken()
    if (!token) return
    const response = await fetch('/api/admin/property-intelligence/dealmachine-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))
    setSyncMessage(data.error || data.message || 'DealMachine sync request completed.')
    toast({
      title: response.ok ? 'DealMachine sync checked' : 'DealMachine sync blocked',
      description: data.error || 'Provider route responded.',
      variant: response.ok ? 'default' : 'destructive',
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Imported', summary?.total || 0],
          ['Vacant lots', summary?.vacantLots || 0],
          ['High score', summary?.highScore || 0],
          ['Avg score', summary?.averageScore || 0],
        ].map(([label, value]) => (
          <Card key={label} className="border-slate-800 bg-slate-950/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Upload className="h-5 w-5" /> Public Data Import</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
          <div className="space-y-2">
            <Label>Source name</Label>
            <Input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Jackson County tax delinquent list" />
          </div>
          <div className="space-y-2">
            <Label>Source URL or notes</Label>
            <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="County URL or file note" />
          </div>
          <div className="space-y-2">
            <Label>CSV / GeoJSON</Label>
            <Input type="file" accept=".csv,.geojson,.json,text/csv,application/geo+json,application/json" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button onClick={() => runImport(false)} disabled={isImporting} variant="outline">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />} Preview
            </Button>
            <Button onClick={() => runImport(true)} disabled={isImporting}>
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Apply Import
            </Button>
            {lastPreview?.summary ? (
              <div className="self-center text-sm text-slate-400">
                Preview: {lastPreview.summary.rows} rows, {lastPreview.summary.highScore} high-score, {lastPreview.summary.signals} signals.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><PlugZap className="h-5 w-5" /> Providers & Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(providerStatus?.features || {}).map(([flag, enabled]) => (
              <Badge key={flag} variant={enabled ? 'secondary' : 'outline'}>{flag.replaceAll('_', ' ')}: {enabled ? 'on' : 'off'}</Badge>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(providerStatus?.providers || {}).slice(0, 9).map(([key, provider]) => (
              <div key={key} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-white">{provider.label}</div>
                  <Badge variant={provider.status === 'implemented' ? 'secondary' : 'outline'}>{provider.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{provider.note}</p>
                {'configured' in provider ? (
                  <p className="mt-2 text-xs text-cyan-200">Configured: {provider.configured ? 'yes' : 'no'} · Enabled: {provider.enabled ? 'yes' : 'no'}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={triggerDealMachineSync}>Trigger DealMachine Sync Check</Button>
            {syncMessage ? <span className="text-sm text-slate-400">{syncMessage}</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Filter className="h-5 w-5" /> Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <Input placeholder="Search address/parcel" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Input placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
          <Input placeholder="State" value={state} onChange={(event) => setState(event.target.value)} />
          <Input placeholder="Zip" value={zip} onChange={(event) => setZip(event.target.value)} />
          <Select value={signal} onValueChange={setSignal}>
            <SelectTrigger><SelectValue placeholder="Signal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All signals</SelectItem>
              {propertySignalTypes.map((item) => <SelectItem key={item} value={item}>{item.replaceAll('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Min score" value={minScore} onChange={(event) => setMinScore(event.target.value)} />
          <div className="flex items-center gap-2">
            <Checkbox checked={vacantOnly} onCheckedChange={(checked) => setVacantOnly(Boolean(checked))} id="vacant-only" />
            <Label htmlFor="vacant-only">Vacant only</Label>
          </div>
          <div className="flex gap-2 md:col-span-5">
            <Button onClick={fetchProperties} disabled={isLoading} variant="outline">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
            <Button asChild variant="outline">
              <a href={exportUrl}><Download className="h-4 w-4" /> Export Outreach CSV</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <OsmPropertyMap properties={properties} selectedId={selected?.id} onSelect={setSelectedId} />

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><MapPinned className="h-5 w-5" /> Lead Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div>
                  <div className="text-lg font-semibold text-white">{selected.property_address || 'Unnamed property'}</div>
                  <div className="text-sm text-slate-400">{[selected.city, selected.state, selected.zip_code].filter(Boolean).join(', ')}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={scoreTone(selected.deal_scores?.[0]?.score || 0)}>Score {selected.deal_scores?.[0]?.score || 0}</Badge>
                  {selected.is_vacant_lot ? <Badge variant="secondary">Vacant confidence {selected.vacant_lot_confidence}</Badge> : null}
                  <Badge variant="outline">{selected.owner_entities?.owner_name || 'Unknown owner'}</Badge>
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>{selected.deal_scores?.[0]?.explanation || 'No score stored yet.'}</p>
                  <p className="text-cyan-200">{selected.deal_scores?.[0]?.recommended_next_action}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selected.property_signals || []).map((item) => (
                    <Badge key={`${item.signal_type}-${item.signal_label}`} variant="outline">{item.signal_label}</Badge>
                  ))}
                </div>
                {outreach ? (
                  <div className="space-y-3">
                    <Label>Safe SMS draft</Label>
                    <Textarea readOnly value={outreach.suggestedSms} />
                    <Label>Safe email draft</Label>
                    <Textarea readOnly value={outreach.suggestedEmail} className="min-h-[170px]" />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-slate-400">No records loaded yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><ShieldAlert className="h-5 w-5" /> OSINT Guardrails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">{OSINT_COMPLIANCE_WARNING}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(osintAdapters).map(([key, adapter]) => (
              <div key={key} className="rounded-lg border border-slate-800 p-3">
                <div className="font-medium text-white">{adapter.label}</div>
                <p className="mt-1 text-xs text-slate-400">{adapter.expectedUse}</p>
                <p className="mt-2 text-xs text-amber-200">{adapter.manualOnlyReason}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Imported Properties</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id} className="cursor-pointer" onClick={() => setSelectedId(property.id)}>
                  <TableCell>
                    <div className="font-medium text-white">{property.property_address || 'No address'}</div>
                    <div className="text-xs text-slate-500">{[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}</div>
                  </TableCell>
                  <TableCell className="text-slate-300">{property.owner_entities?.owner_name || 'Unknown'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(property.property_signals || []).slice(0, 3).map((item) => <Badge key={item.id || item.signal_label} variant="outline">{item.signal_type}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell><Badge className={scoreTone(property.deal_scores?.[0]?.score || 0)}>{property.deal_scores?.[0]?.score || 0}</Badge></TableCell>
                </TableRow>
              ))}
              {!properties.length ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">No property intelligence records loaded.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
