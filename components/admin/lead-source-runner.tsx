"use client"

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Play, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DEFAULT_GOOGLE_PLACES_NICHES, GOOGLE_MAPS_PROVIDER_LABELS } from '@/lib/leads/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type RunnerResult = {
  success: boolean
  count?: number
  provider?: string
  error?: string
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

export function LeadSourceRunner() {
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const supabase = getSupabaseClient()

  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [newBusinessQuery, setNewBusinessQuery] = useState('LLC')
  const [newBusinessLimit, setNewBusinessLimit] = useState('10')
  const [newBusinessDaysBack, setNewBusinessDaysBack] = useState('45')

  const [codeProvider, setCodeProvider] = useState<'all' | 'cincinnati' | 'milwaukee'>('all')
  const [codeLimit, setCodeLimit] = useState('20')
  const [codeDaysBack, setCodeDaysBack] = useState('120')
  const [codeCity, setCodeCity] = useState('')
  const [codeState, setCodeState] = useState('')
  const [codeStreet, setCodeStreet] = useState('')
  const [codeZip, setCodeZip] = useState('')

  const [mapsCity, setMapsCity] = useState('Milwaukee')
  const [mapsState, setMapsState] = useState('WI')
  const [mapsProvider, setMapsProvider] = useState<'auto' | 'google' | 'outscraper'>('auto')
  const [mapsLimit, setMapsLimit] = useState('8')
  const [mapsNiches, setMapsNiches] = useState(DEFAULT_GOOGLE_PLACES_NICHES.join(', '))
  const [mapsLanguage, setMapsLanguage] = useState('en')
  const [mapsRegion, setMapsRegion] = useState('US')

  const [samKeyword, setSamKeyword] = useState('construction')
  const [samNaics, setSamNaics] = useState('')
  const [samCity, setSamCity] = useState('Milwaukee')
  const [samState, setSamState] = useState('WI')
  const [samDaysBack, setSamDaysBack] = useState('30')
  const [samLimit, setSamLimit] = useState('25')

  const mapsNicheCount = useMemo(
    () => mapsNiches.split(',').map((item) => item.trim()).filter(Boolean).length,
    [mapsNiches]
  )

  useEffect(() => {
    if (codeProvider === 'milwaukee') {
      setCodeCity('Milwaukee')
      setCodeState('WI')
      return
    }
    if (codeProvider === 'cincinnati') {
      setCodeCity('Cincinnati')
      setCodeState('OH')
      setCodeStreet('')
      setCodeZip('')
      return
    }
    setCodeCity('')
    setCodeState('')
  }, [codeProvider])

  const runAuthorizedPost = async (key: string, url: string, payload: Record<string, unknown>) => {
    if (!isAuthenticated) {
      throw new Error('You must be signed in as an admin.')
    }

    setRunningKey(key)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Missing admin session.')
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await parseResult(response)
      if (!result.success) throw new Error(result.error)

      toast({
        title: 'Scrape completed',
        description:
          typeof result.count === 'number'
            ? `Saved ${result.count} leads${result.provider ? ` via ${result.provider}` : ''}.`
            : 'The scrape completed successfully.',
      })
    } catch (error) {
      toast({
        title: 'Scrape failed',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setRunningKey(null)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">New business filings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="nb-query">Entity query</Label>
              <Input id="nb-query" value={newBusinessQuery} onChange={(e) => setNewBusinessQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-limit">Limit</Label>
              <Input id="nb-limit" type="number" value={newBusinessLimit} onChange={(e) => setNewBusinessLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-days">Days back</Label>
              <Input id="nb-days" type="number" value={newBusinessDaysBack} onChange={(e) => setNewBusinessDaysBack(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() =>
              runAuthorizedPost('new-businesses', '/api/leads/scrape/new-businesses', {
                query: newBusinessQuery,
                limit: Number(newBusinessLimit),
                daysBack: Number(newBusinessDaysBack),
              })
            }
            disabled={runningKey !== null}
          >
            {runningKey === 'new-businesses' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Wisconsin DFI scrape
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Code violation leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={codeProvider} onValueChange={(value: 'all' | 'cincinnati' | 'milwaukee') => setCodeProvider(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="milwaukee">Milwaukee</SelectItem>
                  <SelectItem value="cincinnati">Cincinnati</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code-city">City</Label>
              <Input id="code-city" value={codeCity} readOnly placeholder={codeProvider === 'all' ? 'Auto by source' : ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code-state">State</Label>
              <Input id="code-state" value={codeState} readOnly placeholder={codeProvider === 'all' ? 'Auto by source' : ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code-limit">Limit</Label>
              <Input id="code-limit" type="number" value={codeLimit} onChange={(e) => setCodeLimit(e.target.value)} />
            </div>
          </div>
          {(codeProvider === 'milwaukee' || codeProvider === 'all') ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code-street">Milwaukee street seed</Label>
                <Input
                  id="code-street"
                  value={codeStreet}
                  onChange={(e) => setCodeStreet(e.target.value)}
                  placeholder="1234 N 35th St"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code-zip">Milwaukee zip seed</Label>
                <Input
                  id="code-zip"
                  value={codeZip}
                  onChange={(e) => setCodeZip(e.target.value)}
                  placeholder="53210"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="code-days">Days back</Label>
            <Input id="code-days" type="number" value={codeDaysBack} onChange={(e) => setCodeDaysBack(e.target.value)} />
          </div>
          <p className="text-xs text-slate-400">
            Cincinnati only supports Cincinnati, OH. Milwaukee is address-driven and works best with a Milwaukee street or zip seed. “All” runs Cincinnati by default and only adds Milwaukee when you give it a usable Milwaukee seed.
          </p>
          <Button
            onClick={() =>
              runAuthorizedPost('code-violations', '/api/leads/scrape/code-violations', {
                provider: codeProvider,
                city: codeCity,
                state: codeState,
                street: codeStreet,
                zip: codeZip,
                limit: Number(codeLimit),
                daysBack: Number(codeDaysBack),
              })
            }
            disabled={runningKey !== null}
          >
            {runningKey === 'code-violations' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run code violation scrape
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Maps business leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={mapsProvider} onValueChange={(value: 'auto' | 'google' | 'outscraper') => setMapsProvider(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{GOOGLE_MAPS_PROVIDER_LABELS.auto}</SelectItem>
                  <SelectItem value="google">{GOOGLE_MAPS_PROVIDER_LABELS.google}</SelectItem>
                  <SelectItem value="outscraper">{GOOGLE_MAPS_PROVIDER_LABELS.outscraper}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maps-city">City</Label>
              <Input id="maps-city" value={mapsCity} onChange={(e) => setMapsCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maps-state">State</Label>
              <Input id="maps-state" value={mapsState} onChange={(e) => setMapsState(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maps-limit">Per niche</Label>
              <Input id="maps-limit" type="number" value={mapsLimit} onChange={(e) => setMapsLimit(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maps-language">Language</Label>
              <Input id="maps-language" value={mapsLanguage} onChange={(e) => setMapsLanguage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maps-region">Region</Label>
              <Input id="maps-region" value={mapsRegion} onChange={(e) => setMapsRegion(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maps-niches">Niches ({mapsNicheCount})</Label>
            <Textarea
              id="maps-niches"
              value={mapsNiches}
              onChange={(e) => setMapsNiches(e.target.value)}
              className="min-h-24"
            />
          </div>
          <Button
            onClick={() =>
              runAuthorizedPost('maps', '/api/leads/scrape/google-places', {
                provider: mapsProvider,
                city: mapsCity,
                state: mapsState,
                language: mapsLanguage,
                region: mapsRegion.toLowerCase(),
                limitPerNiche: Number(mapsLimit),
                niches: mapsNiches
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            disabled={runningKey !== null}
          >
            {runningKey === 'maps' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Run maps lead scrape
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">SAM.gov opportunity matcher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sam-keyword">Keyword</Label>
              <Input id="sam-keyword" value={samKeyword} onChange={(e) => setSamKeyword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sam-city">City</Label>
              <Input id="sam-city" value={samCity} onChange={(e) => setSamCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sam-state">State</Label>
              <Input id="sam-state" value={samState} onChange={(e) => setSamState(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sam-naics">NAICS codes</Label>
              <Input id="sam-naics" value={samNaics} onChange={(e) => setSamNaics(e.target.value)} placeholder="236220, 238220" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sam-days">Days back</Label>
              <Input id="sam-days" type="number" value={samDaysBack} onChange={(e) => setSamDaysBack(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sam-limit">Limit</Label>
              <Input id="sam-limit" type="number" value={samLimit} onChange={(e) => setSamLimit(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() =>
              runAuthorizedPost('sam', '/api/leads/scrape/sam', {
                keyword: samKeyword,
                city: samCity,
                state: samState,
                daysBack: Number(samDaysBack),
                limit: Number(samLimit),
                naicsCodes: samNaics
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            disabled={runningKey !== null}
          >
            {runningKey === 'sam' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run SAM opportunity match
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
