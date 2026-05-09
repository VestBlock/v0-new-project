"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type SamDashboardResponse = {
  success: boolean
  dashboard: {
    watchlists: Array<any>
    hotOpportunities: Array<any>
    recentDocuments: Array<any>
    exclusionChecks: Array<any>
    awards: Array<any>
    assistanceListings: Array<any>
    recentRuns: Array<any>
    agencyPerformance: Array<any>
    naicsPerformance: Array<any>
    documentSummary: {
      fetched: number
      queued: number
      failed: number
      skipped: number
    }
  }
  verification: Record<string, any>
}

type WatchlistFormState = {
  label: string
  company_name: string
  watch_type: 'opportunity' | 'competitor' | 'assistance'
  status: 'active' | 'paused' | 'archived'
  keywords: string
  naics_codes: string
  solicitation_types: string
  set_asides: string
  agency_codes: string
  organization_codes: string
  applicant_types: string
  beneficiary_types: string
  assistance_types: string
  states: string
  zip_codes: string
  response_deadline_days: string
  notes: string
}

const emptyWatchlistForm: WatchlistFormState = {
  label: '',
  company_name: '',
  watch_type: 'opportunity',
  status: 'active',
  keywords: '',
  naics_codes: '',
  solicitation_types: '',
  set_asides: '',
  agency_codes: '',
  organization_codes: '',
  applicant_types: '',
  beneficiary_types: '',
  assistance_types: '',
  states: '',
  zip_codes: '',
  response_deadline_days: '',
  notes: '',
}

function formatTime(value?: string | null) {
  if (!value) return 'N/A'
  try {
    return `${formatDistanceToNow(new Date(value), { addSuffix: true })}`
  } catch {
    return value
  }
}

function arrayToCsv(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : ''
}

function mapWatchlistToForm(watchlist: any): WatchlistFormState {
  return {
    label: watchlist.label || '',
    company_name: watchlist.company_name || '',
    watch_type: watchlist.watch_type || 'opportunity',
    status: watchlist.status || 'active',
    keywords: arrayToCsv(watchlist.keywords),
    naics_codes: arrayToCsv(watchlist.naics_codes),
    solicitation_types: arrayToCsv(watchlist.solicitation_types),
    set_asides: arrayToCsv(watchlist.set_asides),
    agency_codes: arrayToCsv(watchlist.agency_codes),
    organization_codes: arrayToCsv(watchlist.organization_codes),
    applicant_types: arrayToCsv(watchlist.applicant_types),
    beneficiary_types: arrayToCsv(watchlist.beneficiary_types),
    assistance_types: arrayToCsv(watchlist.assistance_types),
    states: arrayToCsv(watchlist.states),
    zip_codes: arrayToCsv(watchlist.zip_codes),
    response_deadline_days: watchlist.response_deadline_days ? String(watchlist.response_deadline_days) : '',
    notes: watchlist.notes || '',
  }
}

function buildWatchlistPayload(form: WatchlistFormState) {
  return {
    label: form.label.trim(),
    company_name: form.company_name.trim(),
    watch_type: form.watch_type,
    status: form.status,
    keywords: form.keywords,
    naics_codes: form.naics_codes,
    solicitation_types: form.solicitation_types,
    set_asides: form.set_asides,
    agency_codes: form.agency_codes,
    organization_codes: form.organization_codes,
    applicant_types: form.applicant_types,
    beneficiary_types: form.beneficiary_types,
    assistance_types: form.assistance_types,
    states: form.states,
    zip_codes: form.zip_codes,
    response_deadline_days: form.response_deadline_days,
    notes: form.notes.trim(),
  }
}

export function SamIntelligenceDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = getSupabaseClient()
  const redirectTarget = useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  const [data, setData] = useState<SamDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null)
  const [form, setForm] = useState<WatchlistFormState>(emptyWatchlistForm)

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
      return null
    }
    return session.access_token
  }, [redirectTarget, router, supabase])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const response = await fetch('/api/admin/sam/dashboard', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load government intelligence dashboard.')
      }

      setData((await response.json()) as SamDashboardResponse)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load SAM dashboard.')
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
      return
    }
    if (isAuthenticated) void load()
  }, [authLoading, isAuthenticated, load, redirectTarget, router])

  const resetForm = useCallback(() => {
    setEditingWatchlistId(null)
    setForm(emptyWatchlistForm)
  }, [])

  const submitWatchlist = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const endpoint = editingWatchlistId
        ? `/api/admin/sam/watchlists/${editingWatchlistId}`
        : '/api/admin/sam/watchlists'
      const method = editingWatchlistId ? 'PATCH' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(buildWatchlistPayload(form)),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to save SAM watchlist.')
      }

      resetForm()
      await load()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save watchlist.')
    } finally {
      setIsSaving(false)
    }
  }, [editingWatchlistId, form, getAccessToken, load, resetForm])

  const removeWatchlist = useCallback(
    async (watchlistId: string) => {
      setIsSaving(true)
      setError(null)
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return

        const response = await fetch(`/api/admin/sam/watchlists/${watchlistId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || 'Unable to delete watchlist.')
        }

        if (editingWatchlistId === watchlistId) resetForm()
        await load()
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to delete watchlist.')
      } finally {
        setIsSaving(false)
      }
    },
    [editingWatchlistId, getAccessToken, load, resetForm]
  )

  const updateWatchlistStatus = useCallback(
    async (watchlist: any, status: 'active' | 'paused' | 'archived') => {
      setIsSaving(true)
      setError(null)
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return

        const response = await fetch(`/api/admin/sam/watchlists/${watchlist.id}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ status }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || 'Unable to update watchlist status.')
        }

        if (editingWatchlistId === watchlist.id) {
          setForm((current) => ({ ...current, status }))
        }
        await load()
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to update watchlist status.')
      } finally {
        setIsSaving(false)
      }
    },
    [editingWatchlistId, getAccessToken, load]
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Government intelligence unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Government intelligence unavailable</AlertTitle>
        <AlertDescription>No dashboard data returned.</AlertDescription>
      </Alert>
    )
  }

  const verification = data.verification || {}
  const opportunitiesCheck = verification.opportunitiesEndpoint || {}
  const hierarchyCheck = verification.federalHierarchyEndpoint || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Government Contract Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Watchlists, hot opportunities, exclusions, competitor awards, assistance matches, and agency demand signals.
          </p>
        </div>
        <Button onClick={() => void load()} variant="outline" size="sm" disabled={isLoading || isSaving}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>SAM action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Watchlists</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {data.dashboard.watchlists.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hot Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {data.dashboard.hotOpportunities.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fetched Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {data.dashboard.documentSummary.fetched}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Exclusion Hits</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {data.dashboard.exclusionChecks.filter((row: any) => row.active_exclusion).length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Alert variant={opportunitiesCheck.ok ? 'default' : 'destructive'}>
          {opportunitiesCheck.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          <AlertTitle>SAM opportunities verification</AlertTitle>
          <AlertDescription>
            {opportunitiesCheck.ok
              ? `Endpoint reachable. Sample count: ${opportunitiesCheck.count ?? 0}.`
              : opportunitiesCheck.error || 'No verification result.'}
          </AlertDescription>
        </Alert>
        <Alert variant={hierarchyCheck.ok ? 'default' : 'destructive'}>
          {hierarchyCheck.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          <AlertTitle>Federal hierarchy verification</AlertTitle>
          <AlertDescription>
            {hierarchyCheck.ok
              ? `Endpoint reachable. Sample count: ${hierarchyCheck.count ?? 0}.`
              : hierarchyCheck.error || 'No verification result.'}
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingWatchlistId ? 'Edit Watchlist' : 'New Watchlist'}</CardTitle>
            <CardDescription>
              Manage opportunity, competitor, and assistance scopes without touching the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Roofing SDVOSB Midwest" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Input value={form.company_name} onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))} placeholder="Client or internal owner" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Watch Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.watch_type}
                  onChange={(event) => setForm((current) => ({ ...current, watch_type: event.target.value as WatchlistFormState['watch_type'] }))}
                >
                  <option value="opportunity">Opportunity</option>
                  <option value="competitor">Competitor</option>
                  <option value="assistance">Assistance</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as WatchlistFormState['status'] }))}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Keywords</label>
                <Input value={form.keywords} onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="roofing, repairs, maintenance" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NAICS Codes</label>
                <Input value={form.naics_codes} onChange={(event) => setForm((current) => ({ ...current, naics_codes: event.target.value }))} placeholder="238160, 236220" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Set-Asides</label>
                <Input value={form.set_asides} onChange={(event) => setForm((current) => ({ ...current, set_asides: event.target.value }))} placeholder="SBA, 8A, SDVOSBC" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">States</label>
                <Input value={form.states} onChange={(event) => setForm((current) => ({ ...current, states: event.target.value }))} placeholder="WI, IL, TX" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Agency Codes</label>
                <Input value={form.agency_codes} onChange={(event) => setForm((current) => ({ ...current, agency_codes: event.target.value }))} placeholder="4700, 12D0" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Org Codes</label>
                <Input value={form.organization_codes} onChange={(event) => setForm((current) => ({ ...current, organization_codes: event.target.value }))} placeholder="4700.4701" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Solicitation Types</label>
                <Input value={form.solicitation_types} onChange={(event) => setForm((current) => ({ ...current, solicitation_types: event.target.value }))} placeholder="o, k, p" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP Codes</label>
                <Input value={form.zip_codes} onChange={(event) => setForm((current) => ({ ...current, zip_codes: event.target.value }))} placeholder="53202, 60601" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Applicant Types</label>
                <Input value={form.applicant_types} onChange={(event) => setForm((current) => ({ ...current, applicant_types: event.target.value }))} placeholder="small business, nonprofit" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Beneficiary Types</label>
                <Input value={form.beneficiary_types} onChange={(event) => setForm((current) => ({ ...current, beneficiary_types: event.target.value }))} placeholder="businesses, municipalities" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assistance Types</label>
                <Input value={form.assistance_types} onChange={(event) => setForm((current) => ({ ...current, assistance_types: event.target.value }))} placeholder="grant, cooperative agreement" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Deadline Window (days)</label>
                <Input value={form.response_deadline_days} onChange={(event) => setForm((current) => ({ ...current, response_deadline_days: event.target.value }))} placeholder="14" inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Who this is for, teaming assumptions, or why the watchlist exists." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void submitWatchlist()} disabled={isSaving || !form.label.trim()}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingWatchlistId ? 'Save Watchlist' : 'Create Watchlist'}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={isSaving}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Automation Runs</CardTitle>
            <CardDescription>
              Latest ingest, scoring, exclusions, awards, assistance, and delivery jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dashboard.recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
            ) : (
              data.dashboard.recentRuns.map((run: any) => (
                <div key={run.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{run.run_type}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(run.started_at)}</p>
                  </div>
                  <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'outline'}>
                    {run.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opportunity Watchlists</CardTitle>
          <CardDescription>
            Current SAM scopes driving opportunity, assistance, and competitor monitoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.dashboard.watchlists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No watchlists yet.</p>
          ) : (
            data.dashboard.watchlists.map((watchlist: any) => (
              <div key={watchlist.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{watchlist.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {watchlist.company_name || 'No company'} · {watchlist.watch_type} · {watchlist.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingWatchlistId(watchlist.id)
                      setForm(mapWatchlistToForm(watchlist))
                    }}>
                      Edit
                    </Button>
                    {watchlist.status !== 'paused' ? (
                      <Button variant="outline" size="sm" onClick={() => void updateWatchlistStatus(watchlist, 'paused')} disabled={isSaving}>
                        Pause
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => void updateWatchlistStatus(watchlist, 'active')} disabled={isSaving}>
                        Resume
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => void updateWatchlistStatus(watchlist, 'archived')} disabled={isSaving}>
                      Archive
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => void removeWatchlist(watchlist.id)} disabled={isSaving}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Keywords: {(watchlist.keywords || []).slice(0, 6).join(', ') || 'None'}.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  NAICS: {(watchlist.naics_codes || []).slice(0, 6).join(', ') || 'None'}.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  States: {(watchlist.states || []).slice(0, 6).join(', ') || 'None'}.
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hot Opportunities</CardTitle>
          <CardDescription>
            Highest-priority SAM opportunities after watchlist and lead-fit scoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>NAICS</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dashboard.hotOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No hot opportunities yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.dashboard.hotOpportunities.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[420px]">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.set_aside_description || 'No set-aside'}
                      </div>
                    </TableCell>
                    <TableCell>{row.agency_name || 'Unknown'}</TableCell>
                    <TableCell>{row.naics_code || 'N/A'}</TableCell>
                    <TableCell>{row.response_deadline || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge>{row.urgency_score || 0}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Document Ingestion</CardTitle>
            <CardDescription>
              Recent descriptions, additional info pages, and public attachment fetches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{data.dashboard.documentSummary.fetched}</p>
                <p className="text-xs text-muted-foreground">Fetched</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{data.dashboard.documentSummary.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{data.dashboard.documentSummary.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{data.dashboard.documentSummary.queued}</p>
                <p className="text-xs text-muted-foreground">Queued</p>
              </div>
            </div>
            {data.dashboard.recentDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No SAM documents captured yet.</p>
            ) : (
              data.dashboard.recentDocuments.slice(0, 8).map((row: any) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.title || row.document_type}</p>
                    <Badge variant={row.fetch_status === 'failed' ? 'destructive' : row.fetch_status === 'fetched' ? 'default' : 'outline'}>
                      {row.fetch_status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.document_type} · {formatTime(row.fetched_at || row.created_at)}
                  </p>
                  {row.source_url ? (
                    <a className="mt-2 block break-all text-xs text-primary underline-offset-4 hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                      {row.source_url}
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exclusion Screening</CardTitle>
            <CardDescription>
              Latest exclusion checks across watchlists and linked entities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dashboard.exclusionChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exclusion checks recorded yet.</p>
            ) : (
              data.dashboard.exclusionChecks.slice(0, 8).map((row: any) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.subject_label || row.legal_business_name || 'Unnamed subject'}</p>
                    <Badge variant={row.active_exclusion ? 'destructive' : 'outline'}>
                      {row.match_status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.exclusion_type || 'No active exclusion'} · checked {formatTime(row.checked_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Competitor Award Feed</CardTitle>
            <CardDescription>
              Recent award notices captured from the SAM award monitor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dashboard.awards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracked awards yet.</p>
            ) : (
              data.dashboard.awards.slice(0, 8).map((row: any) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.awardee_name || row.title || 'Award notice'}</p>
                    <Badge variant="outline">{row.naics_code || 'NAICS N/A'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.agency_name || 'Unknown agency'} · {row.award_date || 'Unknown date'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agency Buyer Intelligence</CardTitle>
            <CardDescription>
              Agencies generating the most visible demand in the tracked SAM feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dashboard.agencyPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agency performance data yet.</p>
            ) : (
              data.dashboard.agencyPerformance.map((row: any) => (
                <div key={row.agencyName} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.agencyName}</p>
                    <Badge variant="outline">{row.opportunityCount} opps</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Awards: {row.awardCount}. Top NAICS: {(row.topNaicsCodes || []).join(', ') || 'None'}.
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assistance Listing Matches</CardTitle>
          <CardDescription>
            Public-sector assistance programs related to current watchlist themes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.dashboard.assistanceListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assistance listing matches yet.</p>
          ) : (
            data.dashboard.assistanceListings.slice(0, 8).map((row: any) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{row.title}</p>
                  <Badge variant="outline">{row.assistance_listing_id}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.agency_name || row.department_name || 'Unknown agency'} · {row.published_date || 'No publish date'}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
