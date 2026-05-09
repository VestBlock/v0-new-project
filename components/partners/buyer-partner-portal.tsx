"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Building2, ExternalLink, Home, Loader2, Save, Send } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/buyers/constants'
import type {
  BuyerBuyBoxRecord,
  BuyerContactRecord,
  BuyerMatchRecord,
  BuyerOutreachMessageRecord,
  BuyerPerformanceRecord,
  BuyerRecord,
} from '@/lib/buyers/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type PortalResponse = {
  access: {
    id: string
    last_viewed_at: string | null
    last_submitted_at: string | null
    label: string | null
  }
  buyer: BuyerRecord
  buyBoxes: BuyerBuyBoxRecord[]
  contacts: BuyerContactRecord[]
  outreach: BuyerOutreachMessageRecord[]
  matches: BuyerMatchRecord[]
  performance: BuyerPerformanceRecord | null
}

type FormState = {
  contactName: string
  contactEmail: string
  contactPhone: string
  marketsServed: string
  closingSpeed: string
  proofOfFundsStatus: string
  fitSummary: string
  bilingualSupport: boolean
  spanishSupport: boolean
  buyBoxName: string
  assetTypes: string
  states: string
  cities: string
  zipCodes: string
  metros: string
  occupancyPreference: string
  distressedTolerance: string
  codeViolationTolerance: string
  tenantOccupiedAllowed: boolean
  section8Allowed: boolean
  priceMin: string
  priceMax: string
  arvMin: string
  arvMax: string
  rehabBudgetMax: string
  minimumEquityPercent: string
  minimumDiscountPercent: string
  preferredDealTypes: string
  creativeFinanceOpen: boolean
  portfolioSizePreference: string
  institutionalCriteria: string
  acquisitionProcessOwner: string
  referralProgramStatus: string
  referralCompensationNotes: string
  buyBoxNotes: string
}

function joinList(values: string[] | null | undefined) {
  return (values || []).join(', ')
}

function currency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `$${Math.round(value).toLocaleString()}`
}

function defaultForm(buyer: BuyerRecord | null, buyBox: BuyerBuyBoxRecord | null): FormState {
  const meta =
    buyBox?.metadata_json && typeof buyBox.metadata_json === 'object'
      ? (buyBox.metadata_json as Record<string, unknown>)
      : {}

  return {
    contactName: buyer?.contact_name || '',
    contactEmail: buyer?.contact_email || '',
    contactPhone: buyer?.contact_phone || '',
    marketsServed: joinList(buyer?.markets_served),
    closingSpeed: buyer?.closing_speed || '',
    proofOfFundsStatus: buyer?.proof_of_funds_status || '',
    fitSummary: buyer?.fit_summary || '',
    bilingualSupport: Boolean(buyer?.bilingual_support),
    spanishSupport: Boolean(buyer?.spanish_support),
    buyBoxName: buyBox?.buy_box_name || 'Primary buy box',
    assetTypes: joinList(buyBox?.asset_types),
    states: joinList(buyBox?.states),
    cities: joinList(buyBox?.cities),
    zipCodes: joinList(buyBox?.zip_codes),
    metros: joinList(buyBox?.metros),
    occupancyPreference: buyBox?.occupancy_preference || '',
    distressedTolerance: buyBox?.distressed_tolerance?.toString() || '',
    codeViolationTolerance: buyBox?.code_violation_tolerance?.toString() || '',
    tenantOccupiedAllowed: Boolean(buyBox?.tenant_occupied_allowed),
    section8Allowed: Boolean(buyBox?.section8_allowed),
    priceMin: buyBox?.price_min?.toString() || '',
    priceMax: buyBox?.price_max?.toString() || '',
    arvMin: buyBox?.arv_min?.toString() || '',
    arvMax: buyBox?.arv_max?.toString() || '',
    rehabBudgetMax: buyBox?.rehab_budget_max?.toString() || '',
    minimumEquityPercent: buyBox?.minimum_equity_percent?.toString() || '',
    minimumDiscountPercent: buyBox?.minimum_discount_percent?.toString() || '',
    preferredDealTypes: joinList(buyBox?.preferred_deal_types),
    creativeFinanceOpen: Boolean(buyBox?.creative_finance_open),
    portfolioSizePreference: buyBox?.portfolio_size_preference || '',
    institutionalCriteria: buyBox?.institutional_criteria || '',
    acquisitionProcessOwner: typeof meta.acquisitionProcessOwner === 'string' ? meta.acquisitionProcessOwner : '',
    referralProgramStatus: typeof meta.referralProgramStatus === 'string' ? meta.referralProgramStatus : '',
    referralCompensationNotes: typeof meta.referralCompensationNotes === 'string' ? meta.referralCompensationNotes : '',
    buyBoxNotes: buyBox?.notes || '',
  }
}

export function BuyerPartnerPortal({ token }: { token: string }) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<PortalResponse | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm(null, null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [matchLoadingId, setMatchLoadingId] = useState<string | null>(null)

  const fetchPortal = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/portal/buyers/${token}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load portal.')
      setDetail(data)
      setForm(defaultForm(data.buyer, data.buyBoxes?.[0] || null))
    } catch (error) {
      toast({
        title: 'Portal unavailable',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [toast, token])

  useEffect(() => {
    void fetchPortal()
  }, [fetchPortal])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/portal/buyers/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          marketsServed: form.marketsServed
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          closingSpeed: form.closingSpeed.trim() || null,
          proofOfFundsStatus: form.proofOfFundsStatus.trim() || null,
          fitSummary: form.fitSummary.trim() || null,
          bilingualSupport: form.bilingualSupport,
          spanishSupport: form.spanishSupport,
          partnerProfile: {
            buyBoxName: form.buyBoxName.trim() || null,
            assetTypes: form.assetTypes.split(',').map((value) => value.trim()).filter(Boolean),
            states: form.states.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean),
            cities: form.cities.split(',').map((value) => value.trim()).filter(Boolean),
            zipCodes: form.zipCodes.split(',').map((value) => value.trim()).filter(Boolean),
            metros: form.metros.split(',').map((value) => value.trim()).filter(Boolean),
            occupancyPreference: form.occupancyPreference.trim() || null,
            distressedTolerance: form.distressedTolerance ? Number(form.distressedTolerance) : null,
            codeViolationTolerance: form.codeViolationTolerance ? Number(form.codeViolationTolerance) : null,
            tenantOccupiedAllowed: form.tenantOccupiedAllowed,
            section8Allowed: form.section8Allowed,
            priceMin: form.priceMin ? Number(form.priceMin) : null,
            priceMax: form.priceMax ? Number(form.priceMax) : null,
            arvMin: form.arvMin ? Number(form.arvMin) : null,
            arvMax: form.arvMax ? Number(form.arvMax) : null,
            rehabBudgetMax: form.rehabBudgetMax ? Number(form.rehabBudgetMax) : null,
            minimumEquityPercent: form.minimumEquityPercent ? Number(form.minimumEquityPercent) : null,
            minimumDiscountPercent: form.minimumDiscountPercent ? Number(form.minimumDiscountPercent) : null,
            preferredDealTypes: form.preferredDealTypes.split(',').map((value) => value.trim()).filter(Boolean),
            creativeFinanceOpen: form.creativeFinanceOpen,
            portfolioSizePreference: form.portfolioSizePreference.trim() || null,
            institutionalCriteria: form.institutionalCriteria.trim() || null,
            acquisitionProcessOwner: form.acquisitionProcessOwner.trim() || null,
            referralProgramStatus: form.referralProgramStatus.trim() || null,
            referralCompensationNotes: form.referralCompensationNotes.trim() || null,
            buyBoxNotes: form.buyBoxNotes.trim() || null,
          },
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to save profile.')
      toast({ title: 'Buyer profile saved' })
      await fetchPortal()
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateMatch = async (matchId: string, status: 'reviewed' | 'active' | 'rejected') => {
    setMatchLoadingId(matchId)
    try {
      const response = await fetch(`/api/portal/buyers/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, status }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to update opportunity.')
      toast({ title: 'Opportunity updated' })
      await fetchPortal()
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setMatchLoadingId(null)
    }
  }

  const summary = useMemo(() => {
    const matches = detail?.matches || []
    const buyBox = detail?.buyBoxes?.[0]
    return {
      openMatches: matches.filter((match) => ['matched', 'reviewed', 'shared'].includes(match.status)).length,
      activeMatches: matches.filter((match) => match.status === 'active').length,
      priceBand: `${currency(buyBox?.price_min)} - ${currency(buyBox?.price_max)}`,
    }
  }, [detail])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-300">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading buyer portal...
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4">
        <Card className="w-full border-slate-800 bg-slate-950/80">
          <CardContent className="space-y-3 p-8 text-center">
            <div className="text-xl font-semibold text-white">This buyer invite is not active.</div>
            <p className="text-sm text-slate-400">
              Ask the VestBlock team for a fresh buyer portal link and we&apos;ll get you back to your dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { buyer, buyBoxes, contacts, outreach, matches, performance, access } = detail
  const primaryBuyBox = buyBoxes[0] || null

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">VestBlock buyer portal</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-white">{buyer.name}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Keep your buy box sharp, review seller-fit opportunities, and help us route better real estate deals into your lane.
              </p>
            </div>
            {buyer.website ? (
              <Button asChild variant="outline">
                <a href={buyer.website} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open site
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Open opportunities</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.openMatches}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Active opportunities</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.activeMatches}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Price band</div>
              <div className="mt-2 text-sm font-medium text-white">{summary.priceBand}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Last update</div>
              <div className="mt-2 text-sm font-medium text-white">
                {access.last_submitted_at
                  ? formatDistanceToNow(new Date(access.last_submitted_at), { addSuffix: true })
                  : 'Waiting on first update'}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Buyer profile</CardTitle>
                  <p className="mt-1 text-sm text-slate-400">
                    Show us your real acquisition criteria so we can send cleaner deals and save everyone time.
                  </p>
                </div>
                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save profile
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Contact name</Label>
                    <Input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact email</Label>
                    <Input type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact phone</Label>
                    <Input value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Markets served</Label>
                    <Input placeholder="Milwaukee, WI, Chicago, IL" value={form.marketsServed} onChange={(event) => setForm((current) => ({ ...current, marketsServed: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Closing speed</Label>
                    <Input placeholder="7-14 days" value={form.closingSpeed} onChange={(event) => setForm((current) => ({ ...current, closingSpeed: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Proof of funds</Label>
                    <Input placeholder="Institutional / requested / cash" value={form.proofOfFundsStatus} onChange={(event) => setForm((current) => ({ ...current, proofOfFundsStatus: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['bilingualSupport', 'Bilingual support'],
                    ['spanishSupport', 'Spanish support'],
                    ['tenantOccupiedAllowed', 'Tenant-occupied okay'],
                    ['section8Allowed', 'Section 8 okay'],
                    ['creativeFinanceOpen', 'Creative finance open'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-lg border border-slate-800 p-3 text-sm text-slate-200">
                      <Checkbox
                        checked={Boolean(form[key as keyof FormState])}
                        onCheckedChange={(checked) => setForm((current) => ({ ...current, [key]: checked === true }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Fit summary</Label>
                  <Textarea value={form.fitSummary} onChange={(event) => setForm((current) => ({ ...current, fitSummary: event.target.value }))} placeholder="Tell us what makes a deal an easy yes, a maybe, or an instant pass." />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Buy box name</Label>
                    <Input value={form.buyBoxName} onChange={(event) => setForm((current) => ({ ...current, buyBoxName: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Asset types</Label>
                    <Input placeholder="single_family, multifamily, mixed_use" value={form.assetTypes} onChange={(event) => setForm((current) => ({ ...current, assetTypes: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>States</Label>
                    <Input value={form.states} onChange={(event) => setForm((current) => ({ ...current, states: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cities</Label>
                    <Input value={form.cities} onChange={(event) => setForm((current) => ({ ...current, cities: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIPs</Label>
                    <Input value={form.zipCodes} onChange={(event) => setForm((current) => ({ ...current, zipCodes: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Metros</Label>
                    <Input value={form.metros} onChange={(event) => setForm((current) => ({ ...current, metros: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Occupancy</Label>
                    <Input value={form.occupancyPreference} onChange={(event) => setForm((current) => ({ ...current, occupancyPreference: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Distress tolerance</Label>
                    <Input type="number" min="0" max="10" value={form.distressedTolerance} onChange={(event) => setForm((current) => ({ ...current, distressedTolerance: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Code tolerance</Label>
                    <Input type="number" min="0" max="10" value={form.codeViolationTolerance} onChange={(event) => setForm((current) => ({ ...current, codeViolationTolerance: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Price min</Label>
                    <Input type="number" value={form.priceMin} onChange={(event) => setForm((current) => ({ ...current, priceMin: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Price max</Label>
                    <Input type="number" value={form.priceMax} onChange={(event) => setForm((current) => ({ ...current, priceMax: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="space-y-2">
                    <Label>ARV min</Label>
                    <Input type="number" value={form.arvMin} onChange={(event) => setForm((current) => ({ ...current, arvMin: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>ARV max</Label>
                    <Input type="number" value={form.arvMax} onChange={(event) => setForm((current) => ({ ...current, arvMax: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rehab max</Label>
                    <Input type="number" value={form.rehabBudgetMax} onChange={(event) => setForm((current) => ({ ...current, rehabBudgetMax: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min equity %</Label>
                    <Input type="number" value={form.minimumEquityPercent} onChange={(event) => setForm((current) => ({ ...current, minimumEquityPercent: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min discount %</Label>
                    <Input type="number" value={form.minimumDiscountPercent} onChange={(event) => setForm((current) => ({ ...current, minimumDiscountPercent: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Preferred deal types</Label>
                    <Input placeholder="cash_purchase, assignment, creative_finance" value={form.preferredDealTypes} onChange={(event) => setForm((current) => ({ ...current, preferredDealTypes: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Portfolio size preference</Label>
                    <Input value={form.portfolioSizePreference} onChange={(event) => setForm((current) => ({ ...current, portfolioSizePreference: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Institutional / acquisition criteria</Label>
                    <Textarea value={form.institutionalCriteria} onChange={(event) => setForm((current) => ({ ...current, institutionalCriteria: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Buy box notes</Label>
                    <Textarea value={form.buyBoxNotes} onChange={(event) => setForm((current) => ({ ...current, buyBoxNotes: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Acquisition process owner</Label>
                    <Input value={form.acquisitionProcessOwner} onChange={(event) => setForm((current) => ({ ...current, acquisitionProcessOwner: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Referral / dispo status</Label>
                    <Input value={form.referralProgramStatus} onChange={(event) => setForm((current) => ({ ...current, referralProgramStatus: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Referral compensation notes</Label>
                  <Textarea value={form.referralCompensationNotes} onChange={(event) => setForm((current) => ({ ...current, referralCompensationNotes: event.target.value }))} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Property opportunities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {matches.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
                    No live property opportunities are queued for you yet. Keeping your buy box current helps us route better deals faster.
                  </div>
                ) : (
                  matches.map((match) => (
                    <div key={match.id} className="rounded-lg border border-slate-800 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-white">
                            {match.property_address || `${match.city || 'Unknown city'}, ${match.state || ''}`.trim() || 'Property-fit opportunity'}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {match.asset_type || 'General asset'} · {match.occupancy || 'Occupancy unknown'} · {match.deal_type || 'General fit'}
                          </div>
                        </div>
                        <Badge variant="secondary">{match.status.replaceAll('_', ' ')}</Badge>
                      </div>
                      {match.fit_summary ? <p className="mt-3 text-sm text-slate-300">{match.fit_summary}</p> : null}
                      {match.next_info_needed?.length ? (
                        <div className="mt-3 text-xs text-slate-300">
                          <span className="text-slate-400">Next info:</span> {match.next_info_needed.join(', ')}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={matchLoadingId === match.id} onClick={() => void updateMatch(match.id, 'reviewed')}>
                          {matchLoadingId === match.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Home className="mr-1 h-3.5 w-3.5" />}
                          Reviewing
                        </Button>
                        <Button size="sm" disabled={matchLoadingId === match.id} onClick={() => void updateMatch(match.id, 'active')}>
                          {matchLoadingId === match.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                          Interested
                        </Button>
                        <Button size="sm" variant="secondary" disabled={matchLoadingId === match.id} onClick={() => void updateMatch(match.id, 'rejected')}>
                          Pass
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Coverage snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-cyan-300" />
                  <span>{buyer.buyer_type.replaceAll('_', ' ')} · {CATEGORY_LABELS[buyer.category] || buyer.category.replaceAll('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Home className="h-4 w-4 text-cyan-300" />
                  <span>{joinList(buyer.markets_served) || buyer.national_or_regional}</span>
                </div>
                {primaryBuyBox ? (
                  <div className="text-xs text-slate-400">
                    {joinList(primaryBuyBox.asset_types) || 'General assets'} · {summary.priceBand} · Distress {primaryBuyBox.distressed_tolerance}/10
                  </div>
                ) : null}
                {performance ? (
                  <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
                    Sent {performance.outreach_sent_count || 0} · Responses {performance.response_count || 0} · Active matches {performance.active_match_count || 0}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Contacts and buy box</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300">
                    <div className="font-medium text-white">{contact.name || 'Contact pending'}</div>
                    <div className="text-xs text-slate-400">{contact.title || 'Acquisitions contact'}</div>
                    {contact.email ? <div className="mt-1">{contact.email}</div> : null}
                    {contact.phone ? <div>{contact.phone}</div> : null}
                  </div>
                ))}
                {buyBoxes.slice(0, 3).map((box) => (
                  <div key={box.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300">
                    <div className="font-medium text-white">{box.buy_box_name}</div>
                    <div className="text-xs text-slate-400">
                      {joinList(box.asset_types) || 'General assets'} · {joinList([...box.states, ...box.cities, ...box.metros].slice(0, 6)) || 'Markets pending'}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Price {currency(box.price_min)} - {currency(box.price_max)} · Distress {box.distressed_tolerance}/10 · Code {box.code_violation_tolerance}/10
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Recent outreach from VestBlock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {outreach.length === 0 ? (
                  <div className="text-sm text-slate-400">No outreach history saved yet.</div>
                ) : (
                  outreach.slice(0, 4).map((message) => (
                    <div key={message.id} className="rounded-lg border border-slate-800 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs uppercase tracking-wide text-cyan-300">{message.channel.replaceAll('_', ' ')}</div>
                        <Badge variant="secondary">{message.status}</Badge>
                      </div>
                      {message.subject ? <div className="mt-2 text-sm font-medium text-white">{message.subject}</div> : null}
                      <p className="mt-2 line-clamp-4 text-xs text-slate-400">{message.body}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
