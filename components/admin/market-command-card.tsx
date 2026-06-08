"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Loader2, Play, Plus, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { TargetMarketRecord } from '@/lib/leads/types'
import { findMarketPreset, marketVerticalPresets } from '@/lib/leads/marketPresets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export function MarketCommandCard() {
  const { isAuthenticated } = useAuth()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [markets, setMarkets] = useState<TargetMarketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [presetId, setPresetId] = useState(marketVerticalPresets[0]?.id || '')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  const selectedPreset = useMemo(() => findMarketPreset(presetId), [presetId])
  const activeMarkets = useMemo(() => markets.filter((market) => market.status === 'active'), [markets])
  const queuedMarkets = useMemo(() => markets.filter((market) => market.status === 'queued'), [markets])

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

  const loadMarkets = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/markets?limit=16', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to load markets.')
      }
      setMarkets((data.markets || []) as TargetMarketRecord[])
    } catch (error) {
      toast({
        title: 'Unable to load markets',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    queueMicrotask(() => {
      void loadMarkets()
    })
  }, [loadMarkets])

  const addCity = async () => {
    if (!city.trim() || !state.trim() || !selectedPreset) {
      toast({
        title: 'Add city details',
        description: 'Choose a preset, then add a city and state.',
        variant: 'destructive',
      })
      return
    }

    setWorking('add_city')
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/markets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          city,
          state,
          niche_focus: selectedPreset.niches,
          status: 'queued',
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to add city.')
      }

      setCity('')
      setState('')
      await loadMarkets()
      toast({
        title: 'City added',
        description: `${data.market?.city || 'The city'} is queued with the ${selectedPreset.label} preset.`,
      })
    } catch (error) {
      toast({
        title: 'Unable to add city',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setWorking(null)
    }
  }

  const runAction = async (intent: string, body: Record<string, unknown>, successMessage: string) => {
    setWorking(intent)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/admin/markets/actions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ intent, ...body }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to run action.')
      }

      await loadMarkets()
      toast({ title: 'Market action complete', description: successMessage })
    } catch (error) {
      toast({
        title: 'Market action failed',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setWorking(null)
    }
  }

  const runTopQueuedScrapes = async () => {
    const targets = queuedMarkets.slice(0, 3)
    if (!targets.length) {
      toast({
        title: 'No queued markets',
        description: 'Queue or activate more cities first.',
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Outreach runs off-platform',
      description: 'Use npm run outreach:v4-workflow from Codex/operator mode to scrape and score fresh markets.',
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Market Command</CardTitle>
            <CardDescription>
              Push more cities and verticals from the Command Center without leaving the page.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/market-expansion">
              Open full market console
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold">{activeMarkets.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Queued</p>
            <p className="text-2xl font-bold">{queuedMarkets.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Tracked</p>
            <p className="text-2xl font-bold">{markets.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Best next move</p>
            <p className="text-sm font-medium">
              {queuedMarkets[0] ? `Scrape ${queuedMarkets[0].city}, ${queuedMarkets[0].state}` : 'Refresh city queue'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-2">
              <Label>Saved preset</Label>
              <Select value={presetId} onValueChange={setPresetId}>
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
              <p className="text-xs text-muted-foreground">{selectedPreset?.description}</p>
              <div className="flex flex-wrap gap-2">
                {(selectedPreset?.niches || []).map((niche) => (
                  <Badge key={niche} variant="outline">{niche}</Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cmd-city">City</Label>
                <Input id="cmd-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Houston" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cmd-state">State</Label>
                <Input id="cmd-state" value={state} onChange={(event) => setState(event.target.value.toUpperCase())} placeholder="TX" maxLength={2} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={addCity} disabled={working !== null || loading}>
                {working === 'add_city' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add city with preset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => runAction('refresh_queue', {}, 'The seeded city queue was refreshed.')}
                disabled={working !== null || loading}
              >
                {working === 'refresh_queue' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Refresh city queue
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => runAction('activate_top_queued', { count: 5 }, 'The top queued cities were promoted to active.')}
                disabled={working !== null || loading}
              >
                {working === 'activate_top_queued' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Activate top 5 queued
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={runTopQueuedScrapes}
                disabled={working !== null || loading}
              >
                {working === 'run_top_scrapes' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run top 3 queued now
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div className="text-sm font-medium">Priority cities</div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading markets...
              </div>
            ) : markets.slice(0, 4).map((market) => (
              <div key={market.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{market.city}, {market.state}</div>
                    <div className="text-xs text-muted-foreground">
                      {market.status} · score {market.final_score}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction('boost_market', { marketId: market.id, amount: 12 }, `${market.city} was boosted and pushed into active focus.`)
                    }
                    disabled={working !== null}
                  >
                    Push harder
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(market.niche_focus || []).slice(0, 3).map((niche) => (
                    <Badge key={niche} variant="outline">{niche}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
