"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Mail, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/buyers/constants'
import { buyerOutreachStatuses, buyerRelationshipStages } from '@/lib/buyers/types'
import type {
  BuyerBuyBoxRecord,
  BuyerContactRecord,
  BuyerMarketRecord,
  BuyerMatchRecord,
  BuyerNoteRecord,
  BuyerOutreachMessageRecord,
  BuyerPerformanceRecord,
  BuyerRecord,
  BuyerRelationshipEventRecord,
} from '@/lib/buyers/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PartnerPortalLinkCard } from '@/components/admin/partner-portal-link'

type BuyerDetailResponse = {
  buyer: BuyerRecord
  buyBoxes: BuyerBuyBoxRecord[]
  markets: BuyerMarketRecord[]
  contacts: BuyerContactRecord[]
  outreach: BuyerOutreachMessageRecord[]
  notes: BuyerNoteRecord[]
  matches: BuyerMatchRecord[]
  performance: BuyerPerformanceRecord | null
  events: BuyerRelationshipEventRecord[]
}

type PartnerIntakeForm = {
  relationshipStage: string
  outreachStatus: string
  contactName: string
  contactEmail: string
  contactPhone: string
  marketsServed: string
  closingSpeed: string
  proofOfFundsStatus: string
  nextFollowUpAt: string
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

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function fromLocalDateTime(value: string) {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function joinList(values: string[] | null | undefined) {
  return (values || []).join(', ')
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `$${Math.round(value).toLocaleString()}`
}

function defaultForm(detail: BuyerDetailResponse | null): PartnerIntakeForm {
  const buyer = detail?.buyer
  const buyBox = detail?.buyBoxes?.[0]
  const buyBoxMeta =
    buyBox?.metadata_json && typeof buyBox.metadata_json === 'object'
      ? (buyBox.metadata_json as Record<string, unknown>)
      : {}

  return {
    relationshipStage: buyer?.relationship_stage || 'discovered',
    outreachStatus: buyer?.outreach_status || 'not_started',
    contactName: buyer?.contact_name || '',
    contactEmail: buyer?.contact_email || '',
    contactPhone: buyer?.contact_phone || '',
    marketsServed: joinList(buyer?.markets_served),
    closingSpeed: buyer?.closing_speed || '',
    proofOfFundsStatus: buyer?.proof_of_funds_status || '',
    nextFollowUpAt: toLocalDateTime(buyer?.next_follow_up_at),
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
    acquisitionProcessOwner: typeof buyBoxMeta.acquisitionProcessOwner === 'string' ? buyBoxMeta.acquisitionProcessOwner : '',
    referralProgramStatus: typeof buyBoxMeta.referralProgramStatus === 'string' ? buyBoxMeta.referralProgramStatus : '',
    referralCompensationNotes: typeof buyBoxMeta.referralCompensationNotes === 'string' ? buyBoxMeta.referralCompensationNotes : '',
    buyBoxNotes: buyBox?.notes || '',
  }
}

export function BuyerDetailClient({ buyerId }: { buyerId: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [detail, setDetail] = useState<BuyerDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false)
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [form, setForm] = useState<PartnerIntakeForm>(defaultForm(null))

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace(`/login?redirect=/admin/buyers/${buyerId}`)
        return
      }
      const response = await fetch(`/api/admin/buyers/${buyerId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Buyer detail failed to load.')
      const data = (await response.json()) as BuyerDetailResponse
      setDetail(data)
      setForm(defaultForm(data))
    } catch (error) {
      toast({
        title: 'Unable to load buyer detail',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [buyerId, router, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?redirect=/admin/buyers/${buyerId}`)
      return
    }
    if (isAuthenticated) void fetchDetail()
  }, [authLoading, buyerId, fetchDetail, isAuthenticated, router])

  const emailReady = useMemo(() => Boolean(detail?.buyer.contact_email?.trim()), [detail?.buyer.contact_email])

  const outreachMetadata = (message: BuyerOutreachMessageRecord) =>
    (message.metadata_json && typeof message.metadata_json === 'object' ? message.metadata_json : {}) as Record<string, unknown>

  const savePartnerIntake = async () => {
    setIsSaving(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/buyers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: buyerId,
          relationshipStage: form.relationshipStage,
          outreachStatus: form.outreachStatus,
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          marketsServed: splitList(form.marketsServed),
          closingSpeed: form.closingSpeed.trim() || null,
          proofOfFundsStatus: form.proofOfFundsStatus.trim() || null,
          nextFollowUpAt: fromLocalDateTime(form.nextFollowUpAt),
          fitSummary: form.fitSummary.trim() || null,
          bilingualSupport: form.bilingualSupport,
          spanishSupport: form.spanishSupport,
          partnerProfile: {
            buyBoxName: form.buyBoxName.trim() || null,
            assetTypes: splitList(form.assetTypes),
            states: splitList(form.states).map((value) => value.toUpperCase()),
            cities: splitList(form.cities),
            zipCodes: splitList(form.zipCodes),
            metros: splitList(form.metros),
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
            preferredDealTypes: splitList(form.preferredDealTypes),
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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not save buyer intake.')
      }

      toast({ title: 'Buyer intake saved' })
      await fetchDetail()
    } catch (error) {
      toast({
        title: 'Buyer intake not saved',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/admin/buyers/${buyerId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ note: noteText }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not save note.')
      }
      setNoteText('')
      await fetchDetail()
    } catch (error) {
      toast({
        title: 'Note not saved',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    }
  }

  const generateOutreach = async () => {
    setIsGeneratingOutreach(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/admin/buyers/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ buyerIds: [buyerId], action: 'generate_outreach' }),
      })
      if (!response.ok) throw new Error('Outreach generation failed.')
      toast({ title: 'Buyer outreach regenerated' })
      await fetchDetail()
    } catch (error) {
      toast({
        title: 'Outreach failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingOutreach(false)
    }
  }

  const updateOutreach = async (messageId: string, status: 'approved' | 'archived', sendNow = false) => {
    setUpdatingMessageId(messageId)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch(`/api/admin/buyers/${buyerId}/outreach`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messageId, status, sendNow }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not update outreach.')
      }
      toast({ title: sendNow ? 'Outreach sent' : 'Outreach updated' })
      await fetchDetail()
    } catch (error) {
      toast({
        title: 'Outreach update failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingMessageId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading buyer detail...
      </div>
    )
  }

  if (!detail) return <div className="text-slate-300">Buyer not found.</div>

  const { buyer, buyBoxes, markets, contacts, outreach, notes, matches, performance, events } = detail

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">{buyer.name}</CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              {buyer.buyer_type.replaceAll('_', ' ')} · {CATEGORY_LABELS[buyer.category] || buyer.category.replaceAll('_', ' ')}
            </p>
          </div>
          <Badge variant="secondary">{Math.round(buyer.confidence_score || 0)} / 100</Badge>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-slate-200">
          <div className="grid gap-3 md:grid-cols-2">
            <div><span className="text-slate-400">Relationship:</span> {buyer.relationship_stage.replaceAll('_', ' ')}</div>
            <div><span className="text-slate-400">Outreach:</span> {buyer.outreach_status.replaceAll('_', ' ')}</div>
            <div><span className="text-slate-400">Headquarters:</span> {[buyer.headquarters_city, buyer.headquarters_state].filter(Boolean).join(', ') || '-'}</div>
            <div><span className="text-slate-400">Markets:</span> {(buyer.markets_served || []).join(', ') || buyer.national_or_regional}</div>
            <div><span className="text-slate-400">Contact email:</span> {buyer.contact_email || '-'}</div>
            <div><span className="text-slate-400">Contact phone:</span> {buyer.contact_phone || '-'}</div>
            <div><span className="text-slate-400">Proof of funds:</span> {buyer.proof_of_funds_status || '-'}</div>
            <div><span className="text-slate-400">Closing speed:</span> {buyer.closing_speed || '-'}</div>
          </div>

          {buyer.fit_summary ? (
            <div>
              <div className="text-slate-400">Fit summary</div>
              <div className="mt-1">{buyer.fit_summary}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {buyer.bilingual_support ? <Badge variant="secondary">Bilingual</Badge> : null}
            {buyer.spanish_support ? <Badge variant="secondary">Spanish support</Badge> : null}
            {buyer.buyer_type === 'institutional' ? <Badge variant="secondary">Institutional</Badge> : null}
            {buyer.buyer_type === 'local_operator' ? <Badge variant="secondary">Local operator</Badge> : null}
          </div>

          {buyer.website ? (
            <Button asChild variant="outline">
              <a href={buyer.website} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open buyer site
              </a>
            </Button>
          ) : null}

          {contacts.length ? (
            <div>
              <div className="mb-2 text-slate-400">Contacts</div>
              <div className="grid gap-3 md:grid-cols-2">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-lg border border-slate-800 p-3">
                    <div className="font-medium text-white">{contact.name || 'Contact pending'}</div>
                    <div className="text-xs text-slate-400">{contact.title || 'Acquisitions contact'}</div>
                    <div className="mt-2 space-y-1 text-xs">
                      {contact.email ? <div>{contact.email}</div> : null}
                      {contact.phone ? <div>{contact.phone}</div> : null}
                      <div>Preferred: {contact.preferred_channel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {buyBoxes.length ? (
            <div>
              <div className="mb-2 text-slate-400">Buy boxes</div>
              <div className="space-y-2">
                {buyBoxes.map((box) => (
                  <div key={box.id} className="rounded-lg border border-slate-800 p-3">
                    <div className="font-medium text-white">{box.buy_box_name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Assets: {box.asset_types.join(', ') || '-'} · Markets: {[...box.states, ...box.cities, ...box.metros].slice(0, 6).join(', ') || '-'}
                    </div>
                    <div className="mt-2 text-xs text-slate-300">
                      Price {toCurrency(box.price_min)} - {toCurrency(box.price_max)} · Distress {box.distressed_tolerance}/10 · Code {box.code_violation_tolerance}/10
                    </div>
                    {box.notes ? <div className="mt-2 text-sm text-slate-300">{box.notes}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {markets.length ? (
            <div>
              <div className="mb-2 text-slate-400">Market coverage</div>
              <div className="grid gap-2 md:grid-cols-2">
                {markets.map((market) => (
                  <div key={market.id} className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
                    {[market.city, market.state].filter(Boolean).join(', ') || market.metro_area || 'Market'}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <PartnerPortalLinkCard partnerType="buyer" partnerId={buyerId} partnerLabel="Buyer" />

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white">Buyer intake</CardTitle>
              <p className="mt-1 text-sm text-slate-400">Save the real buy box, acquisitions path, and referral notes once a buyer responds.</p>
            </div>
            <Button variant="outline" onClick={() => void savePartnerIntake()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save intake
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Relationship stage</Label>
                <Select value={form.relationshipStage} onValueChange={(value) => setForm((current) => ({ ...current, relationshipStage: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {buyerRelationshipStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage.replaceAll('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Outreach status</Label>
                <Select value={form.outreachStatus} onValueChange={(value) => setForm((current) => ({ ...current, outreachStatus: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {buyerOutreachStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{status.replaceAll('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-followup">Next follow-up</Label>
                <Input id="buyer-followup" type="datetime-local" value={form.nextFollowUpAt} onChange={(event) => setForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="buyer-contact-name">Contact name</Label>
                <Input id="buyer-contact-name" value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-contact-email">Contact email</Label>
                <Input id="buyer-contact-email" type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-contact-phone">Contact phone</Label>
                <Input id="buyer-contact-phone" value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="buyer-markets-served">Markets served</Label>
                <Input id="buyer-markets-served" placeholder="Milwaukee, WI, Chicago, IL" value={form.marketsServed} onChange={(event) => setForm((current) => ({ ...current, marketsServed: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-closing-speed">Closing speed</Label>
                <Input id="buyer-closing-speed" placeholder="Fast / 7-14 days" value={form.closingSpeed} onChange={(event) => setForm((current) => ({ ...current, closingSpeed: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-pof">Proof of funds</Label>
                <Input id="buyer-pof" placeholder="Institutional / requested / cash buyer" value={form.proofOfFundsStatus} onChange={(event) => setForm((current) => ({ ...current, proofOfFundsStatus: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyer-fit-summary">Fit summary</Label>
              <Textarea id="buyer-fit-summary" value={form.fitSummary} onChange={(event) => setForm((current) => ({ ...current, fitSummary: event.target.value }))} placeholder="What they actually buy, how fast they move, and where they fit best inside VestBlock." />
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
                    checked={Boolean(form[key as keyof PartnerIntakeForm])}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, [key]: checked === true }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buy-box-name">Buy box name</Label>
                <Input id="buy-box-name" value={form.buyBoxName} onChange={(event) => setForm((current) => ({ ...current, buyBoxName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-assets">Asset types</Label>
                <Input id="buy-box-assets" placeholder="single_family, multifamily, commercial" value={form.assetTypes} onChange={(event) => setForm((current) => ({ ...current, assetTypes: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="buy-box-states">States</Label>
                <Input id="buy-box-states" value={form.states} onChange={(event) => setForm((current) => ({ ...current, states: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-cities">Cities</Label>
                <Input id="buy-box-cities" value={form.cities} onChange={(event) => setForm((current) => ({ ...current, cities: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-zips">ZIPs</Label>
                <Input id="buy-box-zips" value={form.zipCodes} onChange={(event) => setForm((current) => ({ ...current, zipCodes: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-metros">Metros</Label>
                <Input id="buy-box-metros" value={form.metros} onChange={(event) => setForm((current) => ({ ...current, metros: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="buy-box-occupancy">Occupancy</Label>
                <Input id="buy-box-occupancy" placeholder="vacant, occupied, rent-ready" value={form.occupancyPreference} onChange={(event) => setForm((current) => ({ ...current, occupancyPreference: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-distress">Distress tolerance</Label>
                <Input id="buy-box-distress" type="number" min="0" max="10" value={form.distressedTolerance} onChange={(event) => setForm((current) => ({ ...current, distressedTolerance: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-code">Code-violation tolerance</Label>
                <Input id="buy-box-code" type="number" min="0" max="10" value={form.codeViolationTolerance} onChange={(event) => setForm((current) => ({ ...current, codeViolationTolerance: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-price-min">Price min</Label>
                <Input id="buy-box-price-min" type="number" value={form.priceMin} onChange={(event) => setForm((current) => ({ ...current, priceMin: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-price-max">Price max</Label>
                <Input id="buy-box-price-max" type="number" value={form.priceMax} onChange={(event) => setForm((current) => ({ ...current, priceMax: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="buy-box-arv-min">ARV min</Label>
                <Input id="buy-box-arv-min" type="number" value={form.arvMin} onChange={(event) => setForm((current) => ({ ...current, arvMin: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-arv-max">ARV max</Label>
                <Input id="buy-box-arv-max" type="number" value={form.arvMax} onChange={(event) => setForm((current) => ({ ...current, arvMax: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-rehab-max">Rehab budget max</Label>
                <Input id="buy-box-rehab-max" type="number" value={form.rehabBudgetMax} onChange={(event) => setForm((current) => ({ ...current, rehabBudgetMax: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-equity">Min equity %</Label>
                <Input id="buy-box-equity" type="number" value={form.minimumEquityPercent} onChange={(event) => setForm((current) => ({ ...current, minimumEquityPercent: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-discount">Min discount %</Label>
                <Input id="buy-box-discount" type="number" value={form.minimumDiscountPercent} onChange={(event) => setForm((current) => ({ ...current, minimumDiscountPercent: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buy-box-deal-types">Preferred deal types</Label>
                <Input id="buy-box-deal-types" placeholder="cash_purchase, assignment, creative_finance" value={form.preferredDealTypes} onChange={(event) => setForm((current) => ({ ...current, preferredDealTypes: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-portfolio">Portfolio size preference</Label>
                <Input id="buy-box-portfolio" value={form.portfolioSizePreference} onChange={(event) => setForm((current) => ({ ...current, portfolioSizePreference: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buy-box-criteria">Institutional / acquisition criteria</Label>
                <Textarea id="buy-box-criteria" value={form.institutionalCriteria} onChange={(event) => setForm((current) => ({ ...current, institutionalCriteria: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-notes">Buy box notes</Label>
                <Textarea id="buy-box-notes" value={form.buyBoxNotes} onChange={(event) => setForm((current) => ({ ...current, buyBoxNotes: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buy-box-owner">Acquisition process owner</Label>
                <Input id="buy-box-owner" value={form.acquisitionProcessOwner} onChange={(event) => setForm((current) => ({ ...current, acquisitionProcessOwner: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-box-referral-status">Referral / dispo status</Label>
                <Input id="buy-box-referral-status" value={form.referralProgramStatus} onChange={(event) => setForm((current) => ({ ...current, referralProgramStatus: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buy-box-referral-comp">Referral compensation notes</Label>
              <Textarea id="buy-box-referral-comp" value={form.referralCompensationNotes} onChange={(event) => setForm((current) => ({ ...current, referralCompensationNotes: event.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Outreach</CardTitle>
            <Button variant="outline" onClick={generateOutreach} disabled={isGeneratingOutreach}>
              {isGeneratingOutreach ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Regenerate
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!emailReady ? (
              <div className="rounded-lg border border-amber-800/60 bg-amber-500/10 p-3 text-sm text-amber-100">
                No usable buyer email is saved yet. You can still use phone or DM scripts while we enrich the contact record.
              </div>
            ) : null}

            {outreach.length === 0 ? (
              <div className="text-sm text-slate-400">No outreach saved yet.</div>
            ) : (
              outreach.map((message) => (
                <div key={message.id} className="rounded-lg border border-slate-800 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium uppercase tracking-wide text-cyan-300">{message.channel.replaceAll('_', ' ')}</div>
                    <Badge variant="secondary">{message.status}</Badge>
                  </div>
                  {message.subject ? <div className="mb-2 font-medium text-white">{message.subject}</div> : null}
                  {message.cta ? <div className="mb-2 text-xs text-emerald-300">CTA: {message.cta}</div> : null}
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">{message.body}</pre>
                  {Array.isArray(outreachMetadata(message).qualificationQuestions) && (outreachMetadata(message).qualificationQuestions as unknown[]).length ? (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Qualification checklist</div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {(outreachMetadata(message).qualificationQuestions as string[]).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {typeof outreachMetadata(message).economicsPrompt === 'string' && outreachMetadata(message).economicsPrompt ? (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                      <div className="mb-1 font-medium uppercase tracking-wide text-slate-400">Partner economics note</div>
                      {String(outreachMetadata(message).economicsPrompt)}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={updatingMessageId === message.id} onClick={() => void updateOutreach(message.id, 'approved', false)}>
                      {updatingMessageId === message.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingMessageId === message.id || !emailReady || !['email_intro', 'email_followup', 'spanish_email'].includes(message.channel)}
                      onClick={() => void updateOutreach(message.id, 'approved', true)}
                    >
                      {updatingMessageId === message.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                      Send now
                    </Button>
                    <Button size="sm" variant="outline" disabled={updatingMessageId === message.id} onClick={() => void updateOutreach(message.id, 'archived', false)}>
                      Archive
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Performance and matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="grid gap-3 md:grid-cols-2">
              <div><span className="text-slate-400">Outreach sent:</span> {performance?.outreach_sent_count || 0}</div>
              <div><span className="text-slate-400">Responses:</span> {performance?.response_count || 0}</div>
              <div><span className="text-slate-400">Active matches:</span> {performance?.active_match_count || 0}</div>
              <div><span className="text-slate-400">Avg match score:</span> {Math.round(performance?.average_match_score || 0)}</div>
            </div>

            {matches.length ? (
              <div className="space-y-2">
                {matches.map((match) => (
                  <div key={match.id} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{match.property_address || 'Property match'}</div>
                      <Badge variant="secondary">{Math.round(match.confidence_score || 0)} / 100</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{[match.city, match.state].filter(Boolean).join(', ') || match.asset_type || '-'}</div>
                    <div className="mt-2 text-sm text-slate-300">{match.fit_summary || '-'}</div>
                    {match.next_info_needed?.length ? <div className="mt-2 text-xs text-slate-400">Next info: {match.next_info_needed.join(', ')}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">No buyer matches stored yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Notes and history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a buyer relationship note, buy-box detail, or next step." />
              <Button variant="outline" onClick={addNote}>Save note</Button>
            </div>

            {notes.length ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-200">
                    <div>{note.note}</div>
                    <div className="mt-2 text-xs text-slate-400">{new Date(note.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No notes yet.</div>
            )}

            {events.length ? (
              <div className="space-y-2">
                {events.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-200">
                    <div className="font-medium text-white">{event.event_type.replaceAll('_', ' ')}</div>
                    <div className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
