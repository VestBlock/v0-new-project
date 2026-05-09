"use client"

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Play, Plus, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { TargetMarketRecord } from '@/lib/leads/types'
import { DEFAULT_GOOGLE_PLACES_NICHES, GOOGLE_MAPS_PROVIDER_LABELS } from '@/lib/leads/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { findMarketPreset, marketVerticalPresets } from '@/lib/leads/marketPresets'

type MarketExpansionConsoleProps = {
  initialMarkets: TargetMarketRecord[]
}

type RunnerResult = {
  success: boolean
  count?: number
  provider?: string
  error?: string
}

function normalizeList(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

async function parseResult(response: Response): Promise<RunnerResult> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      success: false,
      error: typeof data?.error === 'string' ? data.error : 'Request failed.',
    }
  }
  return {
    success: true,
    count: typeof data?.count === 'number' ? data.count : 0,
    provider: typeof data?.provider === 'string' ? data.provider : undefined,
  }
}

export function MarketExpansionConsole({ initialMarkets }: MarketExpansionConsoleProps) {
  const { isAuthenticated } = useAuth()
  const supabase = getSupabaseClient()
  const { toast } = useToast()
  const router = useRouter()

  const sortedMarkets = useMemo(
    () => [...initialMarkets].sort((a, b) => b.final_score - a.final_score),
    [initialMarkets]
  )

  const [selectedMarketId, setSelectedMarketId] = useState<string>(sortedMarkets[0]?.id || '')
  const selectedMarket = useMemo(
    () => sortedMarkets.find((market) => market.id === selectedMarketId) || null,
    [sortedMarkets, selectedMarketId]
  )

  const [createCity, setCreateCity] = useState('')
  const [createState, setCreateState] = useState('')
  const [createMetroArea, setCreateMetroArea] = useState('')
  const [createPopulation, setCreatePopulation] = useState('')
  const [createNiches, setCreateNiches] = useState(DEFAULT_GOOGLE_PLACES_NICHES.slice(0, 4).join(', '))
  const [createStatus, setCreateStatus] = useState<'queued' | 'active' | 'paused'>('queued')
  const [createPresetId, setCreatePresetId] = useState(marketVerticalPresets[0]?.id || '')

  const [editNiches, setEditNiches] = useState('')
  const [editStatus, setEditStatus] = useState<'queued' | 'active' | 'scraped' | 'paused' | 'exhausted'>('queued')
  const [editScore, setEditScore] = useState('')
  const [editPresetId, setEditPresetId] = useState(marketVerticalPresets[0]?.id || '')

  const [scrapeProvider, setScrapeProvider] = useState<'auto' | 'google' | 'outscraper'>('auto')
  const [scrapeLimit, setScrapeLimit] = useState('8')
  const [scrapeLanguage, setScrapeLanguage] = useState('en')
  const [scrapeRegion, setScrapeRegion] = useState('US')
  const [scrapeNiches, setScrapeNiches] = useState('')
  const [scrapePresetId, setScrapePresetId] = useState(marketVerticalPresets[0]?.id || '')

  const [savingCreate, setSavingCreate] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [runningScrape, setRunningScrape] = useState(false)
  const [runningBulkAction, setRunningBulkAction] = useState<string | null>(null)

  const createPreset = useMemo(() => findMarketPreset(createPresetId), [createPresetId])
  const editPreset = useMemo(() => findMarketPreset(editPresetId), [editPresetId])
  const scrapePreset = useMemo(() => findMarketPreset(scrapePresetId), [scrapePresetId])

  useEffect(() => {
    if (!selectedMarket && sortedMarkets[0]) {
      setSelectedMarketId(sortedMarkets[0].id)
    }
  }, [selectedMarket, sortedMarkets])

  useEffect(() => {
    if (!selectedMarket) return
    setEditNiches((selectedMarket.niche_focus || []).join(', '))
    setEditStatus(selectedMarket.status)
    setEditScore(String(selectedMarket.final_score || 0))
    setScrapeNiches((selectedMarket.niche_focus || []).join(', '))
  }, [selectedMarket])

  const marketCountLabel = `${sortedMarkets.length} tracked market${sortedMarkets.length === 1 ? '' : 's'}`

  const getAuthHeaders = async () => {
    if (!isAuthenticated) {
      throw new Error('You must be signed in as an admin.')
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Missing admin session.')
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }
  }

  const refreshWithToast = (title: string, description: string) => {
    toast({ title, description })
    router.refresh()
  }

  const postMarketAction = async (intent: string, payload: Record<string, unknown>, description: string) => {
    setRunningBulkAction(intent)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/markets/actions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          intent,
          ...payload,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to run market action.')
      }

      refreshWithToast('Market action complete', description)
    } catch (error) {
      toast({
        title: 'Market action failed',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setRunningBulkAction(null)
    }
  }

  const createMarket = async () => {
    const niches = normalizeList(createNiches)
    if (!createCity.trim() || !createState.trim() || !niches.length) {
      toast({
        title: 'Missing market details',
        description: 'Add a city, state, and at least one vertical.',
        variant: 'destructive',
      })
      return
    }

    setSavingCreate(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/markets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          city: createCity,
          state: createState,
          metro_area: createMetroArea,
          population: createPopulation ? Number(createPopulation) : null,
          niche_focus: niches,
          status: createStatus,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to save market.')
      }

      setCreateCity('')
      setCreateState('')
      setCreateMetroArea('')
      setCreatePopulation('')
      setCreateNiches(DEFAULT_GOOGLE_PLACES_NICHES.slice(0, 4).join(', '))
      refreshWithToast(
        'Market queued',
        `${data.market?.city || 'City'} is now in the market queue with your target verticals.`
      )
      if (data.market?.id) setSelectedMarketId(String(data.market.id))
    } catch (error) {
      toast({
        title: 'Unable to add market',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setSavingCreate(false)
    }
  }

  const saveMarket = async (override?: Partial<{ status: string }>) => {
    if (!selectedMarket) return

    setSavingEdit(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/markets/${selectedMarket.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          niche_focus: normalizeList(editNiches),
          status: override?.status || editStatus,
          final_score: Number(editScore),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update market.')
      }

      refreshWithToast(
        'Market updated',
        `${selectedMarket.city}, ${selectedMarket.state} is now set to ${data.market?.status || editStatus}.`
      )
    } catch (error) {
      toast({
        title: 'Unable to update market',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const runMarketScrape = async () => {
    if (!selectedMarket) return
    const niches = normalizeList(scrapeNiches)
    if (!niches.length) {
      toast({
        title: 'Add scrape verticals',
        description: 'Add at least one vertical before running a scrape.',
        variant: 'destructive',
      })
      return
    }

    setRunningScrape(true)
    try {
      const headers = await getAuthHeaders()
      const scrapeResponse = await fetch('/api/leads/scrape/google-places', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: scrapeProvider,
          city: selectedMarket.city,
          state: selectedMarket.state,
          language: scrapeLanguage,
          region: scrapeRegion.toLowerCase(),
          limitPerNiche: Number(scrapeLimit),
          niches,
        }),
      })

      const scrapeResult = await parseResult(scrapeResponse)
      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error)
      }

      const patchResponse = await fetch(`/api/admin/markets/${selectedMarket.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          niche_focus: niches,
          status: scrapeResult.count && scrapeResult.count > 0 ? 'scraped' : 'exhausted',
          last_scraped_at: new Date().toISOString(),
          performance_json: {
            lastManualRunAt: new Date().toISOString(),
            lastLeadCount: scrapeResult.count || 0,
            lastProvider: scrapeResult.provider || scrapeProvider,
            lastManualNiches: niches,
          },
        }),
      })

      const patchData = await patchResponse.json().catch(() => ({}))
      if (!patchResponse.ok) {
        throw new Error(typeof patchData?.error === 'string' ? patchData.error : 'Unable to record market run.')
      }

      refreshWithToast(
        'Scrape completed',
        `Saved ${scrapeResult.count || 0} leads for ${selectedMarket.city}, ${selectedMarket.state}${scrapeResult.provider ? ` via ${scrapeResult.provider}` : ''}.`
      )
    } catch (error) {
      toast({
        title: 'Scrape failed',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setRunningScrape(false)
    }
  }

  const runTopQueuedScrapes = async () => {
    const targets = sortedMarkets.filter((market) => market.status === 'queued').slice(0, 3)
    if (!targets.length) {
      toast({
        title: 'No queued markets',
        description: 'Refresh or activate the city queue first.',
        variant: 'destructive',
      })
      return
    }

    setRunningBulkAction('run_top_scrapes')
    try {
      const headers = await getAuthHeaders()
      let totalSaved = 0

      for (const market of targets) {
        const niches = (market.niche_focus || []).slice(0, 4)
        const scrapeResponse = await fetch('/api/leads/scrape/google-places', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: 'auto',
            city: market.city,
            state: market.state,
            language: 'en',
            region: 'us',
            limitPerNiche: 8,
            niches,
          }),
        })

        const scrapeData = await scrapeResponse.json().catch(() => ({}))
        if (!scrapeResponse.ok) {
          throw new Error(typeof scrapeData?.error === 'string' ? scrapeData.error : `Unable to scrape ${market.city}.`)
        }

        totalSaved += Number(scrapeData.count || 0)

        await fetch(`/api/admin/markets/${market.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: Number(scrapeData.count || 0) > 0 ? 'scraped' : 'exhausted',
            last_scraped_at: new Date().toISOString(),
            performance_json: {
              lastManualRunAt: new Date().toISOString(),
              lastLeadCount: Number(scrapeData.count || 0),
              lastProvider: scrapeData.provider || 'auto',
              bestNiche: niches[0] || null,
            },
          }),
        })
      }

      refreshWithToast('Queued markets scraped', `Saved ${totalSaved} leads across ${targets.length} queued cities.`)
    } catch (error) {
      toast({
        title: 'Queued market scrape failed',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setRunningBulkAction(null)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1.35fr]">
      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Target a new city</CardTitle>
          <CardDescription>
            Add a city, give it vertical focus, and push it into the daily market queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={createPresetId} onValueChange={setCreatePresetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {marketVerticalPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">{createPreset?.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="market-city">City</Label>
              <Input id="market-city" value={createCity} onChange={(event) => setCreateCity(event.target.value)} placeholder="Phoenix" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="market-state">State</Label>
              <Input
                id="market-state"
                value={createState}
                onChange={(event) => setCreateState(event.target.value.toUpperCase())}
                placeholder="AZ"
                maxLength={2}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="market-metro">Metro area</Label>
              <Input
                id="market-metro"
                value={createMetroArea}
                onChange={(event) => setCreateMetroArea(event.target.value)}
                placeholder="Phoenix Metro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="market-population">Population</Label>
              <Input
                id="market-population"
                type="number"
                value={createPopulation}
                onChange={(event) => setCreatePopulation(event.target.value)}
                placeholder="1650070"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="market-niches">Verticals</Label>
            <Textarea
              id="market-niches"
              value={createNiches}
              onChange={(event) => setCreateNiches(event.target.value)}
              className="min-h-24"
              placeholder="roofers, property managers, real estate investors"
            />
            <div className="flex flex-wrap gap-2">
              {(createPreset?.niches || []).map((niche) => (
                <Badge key={niche} variant="outline">{niche}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={createStatus} onValueChange={(value: 'queued' | 'active' | 'paused') => setCreateStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="active">Active now</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createMarket} disabled={savingCreate}>
            {savingCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add city to expansion queue
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => createPreset && setCreateNiches(createPreset.niches.join(', '))}
            disabled={!createPreset || savingCreate}
          >
            Apply preset niches
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-white">Market control console</CardTitle>
              <CardDescription>
                {marketCountLabel}. Edit niche focus, push status, or run a city scrape from here.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-slate-700 text-slate-200">
              {selectedMarket ? `${selectedMarket.city}, ${selectedMarket.state}` : 'Pick a market'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => postMarketAction('refresh_queue', {}, 'The seeded city queue was refreshed.')}
              disabled={runningBulkAction !== null}
            >
              {runningBulkAction === 'refresh_queue' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Refresh city queue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => postMarketAction('activate_top_queued', { count: 5 }, 'The top queued cities were promoted to active.')}
              disabled={runningBulkAction !== null}
            >
              {runningBulkAction === 'activate_top_queued' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Activate top 5 queued
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={runTopQueuedScrapes}
              disabled={runningBulkAction !== null}
            >
              {runningBulkAction === 'run_top_scrapes' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run top 3 queued now
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Select tracked market</Label>
            <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a market" />
              </SelectTrigger>
              <SelectContent>
                {sortedMarkets.map((market) => (
                  <SelectItem key={market.id} value={market.id}>
                    {market.city}, {market.state} · {market.status} · score {market.final_score}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMarket ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedMarket.status}</Badge>
                <Badge variant="outline">{selectedMarket.metro_area || 'Local market'}</Badge>
                <Badge variant="outline">score {selectedMarket.final_score}</Badge>
                <Badge variant="outline">{selectedMarket.population ? `${selectedMarket.population.toLocaleString()} pop` : 'No population set'}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-2">
                  <Label htmlFor="edit-niches">Niche focus</Label>
                  <Textarea
                    id="edit-niches"
                    value={editNiches}
                    onChange={(event) => setEditNiches(event.target.value)}
                    className="min-h-24"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Preset</Label>
                    <Select value={editPresetId} onValueChange={setEditPresetId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {marketVerticalPresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editStatus}
                      onValueChange={(value: 'queued' | 'active' | 'scraped' | 'paused' | 'exhausted') => setEditStatus(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="queued">Queued</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="scraped">Scraped</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="exhausted">Exhausted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-score">Priority score</Label>
                    <Input id="edit-score" type="number" value={editScore} onChange={(event) => setEditScore(event.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveMarket()} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save market settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => editPreset && setEditNiches(editPreset.niches.join(', '))}
                  disabled={!editPreset || savingEdit}
                >
                  Apply preset
                </Button>
                <Button type="button" variant="outline" onClick={() => saveMarket({ status: 'active' })} disabled={savingEdit}>
                  Make active
                </Button>
                <Button type="button" variant="outline" onClick={() => saveMarket({ status: 'queued' })} disabled={savingEdit}>
                  Queue again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => postMarketAction('boost_market', { marketId: selectedMarket.id, amount: 12 }, `${selectedMarket.city} was boosted and pushed into active focus.`)}
                  disabled={runningBulkAction !== null}
                >
                  Push harder here
                </Button>
                <Button type="button" variant="outline" onClick={() => saveMarket({ status: 'paused' })} disabled={savingEdit}>
                  Pause city
                </Button>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <div className="mb-3">
                  <div className="text-sm font-medium text-white">Run more verticals now</div>
                  <div className="text-sm text-slate-400">
                    Tell VestBlock to scrape this city immediately with the niches you choose.
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-4">
                    <Label>Scrape preset</Label>
                    <Select value={scrapePresetId} onValueChange={setScrapePresetId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {marketVerticalPresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">{scrapePreset?.description}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={scrapeProvider} onValueChange={(value: 'auto' | 'google' | 'outscraper') => setScrapeProvider(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{GOOGLE_MAPS_PROVIDER_LABELS.auto}</SelectItem>
                        <SelectItem value="google">{GOOGLE_MAPS_PROVIDER_LABELS.google}</SelectItem>
                        <SelectItem value="outscraper">{GOOGLE_MAPS_PROVIDER_LABELS.outscraper}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scrape-limit">Per niche</Label>
                    <Input id="scrape-limit" type="number" value={scrapeLimit} onChange={(event) => setScrapeLimit(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scrape-language">Language</Label>
                    <Input id="scrape-language" value={scrapeLanguage} onChange={(event) => setScrapeLanguage(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scrape-region">Region</Label>
                    <Input id="scrape-region" value={scrapeRegion} onChange={(event) => setScrapeRegion(event.target.value.toUpperCase())} />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Label htmlFor="scrape-niches">Scrape these verticals</Label>
                  <Textarea
                    id="scrape-niches"
                    value={scrapeNiches}
                    onChange={(event) => setScrapeNiches(event.target.value)}
                    className="min-h-24"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(scrapePreset?.niches || []).map((niche) => (
                      <Badge key={niche} variant="outline">{niche}</Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => scrapePreset && setScrapeNiches(scrapePreset.niches.join(', '))}
                    disabled={!scrapePreset || runningScrape}
                  >
                    Apply scrape preset
                  </Button>
                  <Button onClick={runMarketScrape} disabled={runningScrape}>
                    {runningScrape ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Scrape this city now
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">No tracked market yet. Add a city on the left to start.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
