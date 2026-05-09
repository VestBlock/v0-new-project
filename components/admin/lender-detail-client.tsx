"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, Send, ExternalLink, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/lenders/constants'
import { lenderOutreachStatuses, lenderRelationshipStages } from '@/lib/lenders/types'
import type {
  LenderContactRecord,
  LenderMatchRecord,
  LenderNoteRecord,
  LenderOutreachMessageRecord,
  LenderPerformanceRecord,
  LenderProductRecord,
  LenderProgramRecord,
  LenderRecord,
  LenderRelationshipEventRecord,
} from '@/lib/lenders/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PartnerPortalLinkCard } from '@/components/admin/partner-portal-link'

type LenderDetailResponse = {
  lender: LenderRecord
  products: LenderProductRecord[]
  programs: LenderProgramRecord[]
  contacts: LenderContactRecord[]
  outreach: LenderOutreachMessageRecord[]
  notes: LenderNoteRecord[]
  matches: LenderMatchRecord[]
  performance: LenderPerformanceRecord | null
  events: LenderRelationshipEventRecord[]
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `$${Math.round(value).toLocaleString()}`
}

type PartnerProfileForm = {
  preferredBorrowers: string
  noGoItems: string
  submissionNotes: string
  partnerProcessOwner: string
  referralProgramStatus: string
  referralCompensationNotes: string
}

type PartnerIntakeFormState = {
  relationshipStage: string
  outreachStatus: string
  contactName: string
  contactEmail: string
  contactPhone: string
  statesServed: string
  nextFollowUpAt: string
  minCreditScore: string
  minRevenue: string
  minTimeInBusiness: string
  loanAmountMin: string
  loanAmountMax: string
  dscrMin: string
  speedToClose: string
  fitSummary: string
  startupAllowed: boolean
  investorAllowed: boolean
  ownerOccupiedAllowed: boolean
  lowDoc: boolean
  cashOutAllowed: boolean
  bilingualSupport: boolean
  spanishSupport: boolean
  partnerProfile: PartnerProfileForm
}

const DEFAULT_PARTNER_PROFILE: PartnerProfileForm = {
  preferredBorrowers: '',
  noGoItems: '',
  submissionNotes: '',
  partnerProcessOwner: '',
  referralProgramStatus: '',
  referralCompensationNotes: '',
}

const DEFAULT_PARTNER_INTAKE_FORM: PartnerIntakeFormState = {
  relationshipStage: 'discovered',
  outreachStatus: 'not_started',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  statesServed: '',
  nextFollowUpAt: '',
  minCreditScore: '',
  minRevenue: '',
  minTimeInBusiness: '',
  loanAmountMin: '',
  loanAmountMax: '',
  dscrMin: '',
  speedToClose: '',
  fitSummary: '',
  startupAllowed: false,
  investorAllowed: false,
  ownerOccupiedAllowed: false,
  lowDoc: false,
  cashOutAllowed: false,
  bilingualSupport: false,
  spanishSupport: false,
  partnerProfile: DEFAULT_PARTNER_PROFILE,
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function lenderToPartnerForm(lender: LenderRecord): PartnerIntakeFormState {
  const partnerProfile =
    lender.metadata_json?.partnerProfile && typeof lender.metadata_json.partnerProfile === 'object'
      ? (lender.metadata_json.partnerProfile as Record<string, unknown>)
      : {}

  return {
    relationshipStage: lender.relationship_stage,
    outreachStatus: lender.outreach_status,
    contactName: lender.contact_name || '',
    contactEmail: lender.contact_email || '',
    contactPhone: lender.contact_phone || '',
    statesServed: (lender.states_served || []).join(', '),
    nextFollowUpAt: toDateTimeLocalValue(lender.next_follow_up_at),
    minCreditScore: lender.min_credit_score?.toString() || '',
    minRevenue: lender.min_revenue?.toString() || '',
    minTimeInBusiness: lender.min_time_in_business?.toString() || '',
    loanAmountMin: lender.loan_amount_min?.toString() || '',
    loanAmountMax: lender.loan_amount_max?.toString() || '',
    dscrMin: lender.dscr_min?.toString() || '',
    speedToClose: lender.speed_to_close || '',
    fitSummary: lender.fit_summary || '',
    startupAllowed: lender.startup_allowed,
    investorAllowed: lender.investor_allowed,
    ownerOccupiedAllowed: lender.owner_occupied_allowed,
    lowDoc: lender.low_doc,
    cashOutAllowed: lender.cash_out_allowed,
    bilingualSupport: lender.bilingual_support,
    spanishSupport: lender.spanish_support,
    partnerProfile: {
      preferredBorrowers: typeof partnerProfile.preferredBorrowers === 'string' ? partnerProfile.preferredBorrowers : '',
      noGoItems: typeof partnerProfile.noGoItems === 'string' ? partnerProfile.noGoItems : '',
      submissionNotes: typeof partnerProfile.submissionNotes === 'string' ? partnerProfile.submissionNotes : '',
      partnerProcessOwner: typeof partnerProfile.partnerProcessOwner === 'string' ? partnerProfile.partnerProcessOwner : '',
      referralProgramStatus: typeof partnerProfile.referralProgramStatus === 'string' ? partnerProfile.referralProgramStatus : '',
      referralCompensationNotes:
        typeof partnerProfile.referralCompensationNotes === 'string' ? partnerProfile.referralCompensationNotes : '',
    },
  }
}

export function LenderDetailClient({ lenderId }: { lenderId: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [detail, setDetail] = useState<LenderDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false)
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null)
  const [isSavingPartnerForm, setIsSavingPartnerForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [partnerForm, setPartnerForm] = useState<PartnerIntakeFormState>(DEFAULT_PARTNER_INTAKE_FORM)

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace(`/login?redirect=/admin/lenders/${lenderId}`)
        return
      }

      const response = await fetch(`/api/admin/lenders/${lenderId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Lender detail failed to load.')
      const data = await response.json()
      setDetail(data)
    } catch (error) {
      toast({
        title: 'Unable to load lender detail',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [lenderId, router, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?redirect=/admin/lenders/${lenderId}`)
      return
    }
    if (isAuthenticated) void fetchDetail()
  }, [authLoading, fetchDetail, isAuthenticated, lenderId, router])

  useEffect(() => {
    if (detail?.lender) {
      setPartnerForm(lenderToPartnerForm(detail.lender))
    }
  }, [detail?.lender])

  const generateOutreach = async () => {
    setIsGeneratingOutreach(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/lenders/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lenderIds: [lenderId], action: 'generate_outreach' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Outreach generation failed.')
      }

      toast({ title: 'Partner outreach regenerated' })
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

  const addNote = async () => {
    if (!noteText.trim()) return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/admin/lenders/${lenderId}/notes`, {
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

  const updateOutreach = async (messageId: string, status: 'approved' | 'archived', sendNow = false) => {
    setUpdatingMessageId(messageId)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/admin/lenders/${lenderId}/outreach`, {
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

  const savePartnerIntake = async () => {
    setIsSavingPartnerForm(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/lenders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: lenderId,
          relationshipStage: partnerForm.relationshipStage,
          outreachStatus: partnerForm.outreachStatus,
          contactName: partnerForm.contactName.trim() || null,
          contactEmail: partnerForm.contactEmail.trim() || null,
          contactPhone: partnerForm.contactPhone.trim() || null,
          statesServed: partnerForm.statesServed
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
          nextFollowUpAt: fromDateTimeLocalValue(partnerForm.nextFollowUpAt),
          minCreditScore: partnerForm.minCreditScore ? Number(partnerForm.minCreditScore) : null,
          minRevenue: partnerForm.minRevenue ? Number(partnerForm.minRevenue) : null,
          minTimeInBusiness: partnerForm.minTimeInBusiness ? Number(partnerForm.minTimeInBusiness) : null,
          loanAmountMin: partnerForm.loanAmountMin ? Number(partnerForm.loanAmountMin) : null,
          loanAmountMax: partnerForm.loanAmountMax ? Number(partnerForm.loanAmountMax) : null,
          dscrMin: partnerForm.dscrMin ? Number(partnerForm.dscrMin) : null,
          speedToClose: partnerForm.speedToClose.trim() || null,
          fitSummary: partnerForm.fitSummary.trim() || null,
          startupAllowed: partnerForm.startupAllowed,
          investorAllowed: partnerForm.investorAllowed,
          ownerOccupiedAllowed: partnerForm.ownerOccupiedAllowed,
          lowDoc: partnerForm.lowDoc,
          cashOutAllowed: partnerForm.cashOutAllowed,
          bilingualSupport: partnerForm.bilingualSupport,
          spanishSupport: partnerForm.spanishSupport,
          partnerProfile: {
            preferredBorrowers: partnerForm.partnerProfile.preferredBorrowers.trim() || null,
            noGoItems: partnerForm.partnerProfile.noGoItems.trim() || null,
            submissionNotes: partnerForm.partnerProfile.submissionNotes.trim() || null,
            partnerProcessOwner: partnerForm.partnerProfile.partnerProcessOwner.trim() || null,
            referralProgramStatus: partnerForm.partnerProfile.referralProgramStatus.trim() || null,
            referralCompensationNotes: partnerForm.partnerProfile.referralCompensationNotes.trim() || null,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not save partner intake.')
      }

      toast({ title: 'Partner intake saved' })
      await fetchDetail()
    } catch (error) {
      toast({
        title: 'Partner intake not saved',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingPartnerForm(false)
    }
  }

  const emailReady = useMemo(() => Boolean(detail?.lender.contact_email?.trim()), [detail?.lender.contact_email])

  const outreachMetadata = (message: LenderOutreachMessageRecord) =>
    (message.metadata_json && typeof message.metadata_json === 'object' ? message.metadata_json : {}) as Record<string, unknown>

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading lender detail...
      </div>
    )
  }

  if (!detail) {
    return <div className="text-slate-300">Lender not found.</div>
  }

  const { lender, contacts, products, programs, outreach, notes, matches, performance, events } = detail

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">{lender.name}</CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              {lender.lender_type.replaceAll('_', ' ')} · {CATEGORY_LABELS[lender.category] || lender.category.replaceAll('_', ' ')}
            </p>
          </div>
          <Badge variant="secondary">{Math.round(lender.confidence_score || 0)} / 100</Badge>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-slate-200">
          <div className="grid gap-3 md:grid-cols-2">
            <div><span className="text-slate-400">Relationship:</span> {lender.relationship_stage.replaceAll('_', ' ')}</div>
            <div><span className="text-slate-400">Outreach:</span> {lender.outreach_status.replaceAll('_', ' ')}</div>
            <div><span className="text-slate-400">Headquarters:</span> {[lender.headquarters_city, lender.headquarters_state].filter(Boolean).join(', ') || '-'}</div>
            <div><span className="text-slate-400">Coverage:</span> {(lender.states_served || []).join(', ') || lender.national_or_regional}</div>
            <div><span className="text-slate-400">Contact email:</span> {lender.contact_email || '-'}</div>
            <div><span className="text-slate-400">Contact phone:</span> {lender.contact_phone || '-'}</div>
            <div><span className="text-slate-400">Min credit:</span> {lender.min_credit_score || '-'}</div>
            <div><span className="text-slate-400">Time in business:</span> {typeof lender.min_time_in_business === 'number' ? `${lender.min_time_in_business} months` : '-'}</div>
            <div><span className="text-slate-400">Loan range:</span> {formatCurrency(lender.loan_amount_min)} - {formatCurrency(lender.loan_amount_max)}</div>
            <div><span className="text-slate-400">DSCR min:</span> {lender.dscr_min ?? '-'}</div>
          </div>

          {lender.fit_summary ? (
            <div>
              <div className="text-slate-400">Fit summary</div>
              <div className="mt-1">{lender.fit_summary}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {lender.startup_allowed ? <Badge variant="secondary">Startup friendly</Badge> : null}
            {lender.investor_allowed ? <Badge variant="secondary">Investor allowed</Badge> : null}
            {lender.owner_occupied_allowed ? <Badge variant="secondary">Owner occupied</Badge> : null}
            {lender.low_doc ? <Badge variant="secondary">Low doc</Badge> : null}
            {lender.cash_out_allowed ? <Badge variant="secondary">Cash out</Badge> : null}
            {lender.spanish_support || lender.bilingual_support ? <Badge variant="secondary">Spanish support</Badge> : null}
          </div>

          {lender.website ? (
            <Button asChild variant="outline">
              <a href={lender.website} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open lender site
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
                    <div className="text-xs text-slate-400">{contact.title || 'Relationship contact'}</div>
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

          {products.length ? (
            <div>
              <div className="mb-2 text-slate-400">Products</div>
              <div className="space-y-2">
                {products.map((product) => (
                  <div key={product.id} className="rounded-lg border border-slate-800 p-3">
                    <div className="font-medium text-white">{product.product_name}</div>
                    <div className="text-xs text-slate-400">{CATEGORY_LABELS[product.category] || product.category.replaceAll('_', ' ')}</div>
                    {product.description ? <div className="mt-2 text-sm text-slate-300">{product.description}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {programs.length ? (
            <div>
              <div className="mb-2 text-slate-400">Programs</div>
              <div className="space-y-2">
                {programs.map((program) => (
                  <div key={program.id} className="rounded-lg border border-slate-800 p-3">
                    <div className="font-medium text-white">{program.program_name}</div>
                    <div className="text-xs text-slate-400">{program.program_type.replaceAll('_', ' ')}</div>
                    {program.description ? <div className="mt-2 text-sm text-slate-300">{program.description}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <PartnerPortalLinkCard partnerType="lender" partnerId={lenderId} partnerLabel="Lender" />

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white">Partner intake</CardTitle>
              <p className="mt-1 text-sm text-slate-400">
                Save the real fit box, partner process, and referral notes once a lender actually responds.
              </p>
            </div>
            <Button variant="outline" onClick={() => void savePartnerIntake()} disabled={isSavingPartnerForm}>
              {isSavingPartnerForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save intake
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Relationship stage</Label>
                <Select
                  value={partnerForm.relationshipStage}
                  onValueChange={(value) => setPartnerForm((current) => ({ ...current, relationshipStage: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lenderRelationshipStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage.replaceAll('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Outreach status</Label>
                <Select
                  value={partnerForm.outreachStatus}
                  onValueChange={(value) => setPartnerForm((current) => ({ ...current, outreachStatus: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lenderOutreachStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replaceAll('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-next-followup">Next follow-up</Label>
                <Input
                  id="partner-next-followup"
                  type="datetime-local"
                  value={partnerForm.nextFollowUpAt}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="partner-contact-name">Contact name</Label>
                <Input
                  id="partner-contact-name"
                  value={partnerForm.contactName}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, contactName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-contact-email">Contact email</Label>
                <Input
                  id="partner-contact-email"
                  type="email"
                  value={partnerForm.contactEmail}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, contactEmail: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-contact-phone">Contact phone</Label>
                <Input
                  id="partner-contact-phone"
                  value={partnerForm.contactPhone}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, contactPhone: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="partner-states-served">States served</Label>
                <Input
                  id="partner-states-served"
                  placeholder="WI, IL, IN, OH"
                  value={partnerForm.statesServed}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, statesServed: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-speed">Speed to close</Label>
                <Input
                  id="partner-speed"
                  placeholder="5-7 business days"
                  value={partnerForm.speedToClose}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, speedToClose: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-dscr">DSCR min</Label>
                <Input
                  id="partner-dscr"
                  type="number"
                  step="0.01"
                  value={partnerForm.dscrMin}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, dscrMin: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="partner-min-credit">Min credit</Label>
                <Input
                  id="partner-min-credit"
                  type="number"
                  value={partnerForm.minCreditScore}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, minCreditScore: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-min-revenue">Min revenue</Label>
                <Input
                  id="partner-min-revenue"
                  type="number"
                  value={partnerForm.minRevenue}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, minRevenue: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-min-tib">Min time in business (months)</Label>
                <Input
                  id="partner-min-tib"
                  type="number"
                  value={partnerForm.minTimeInBusiness}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, minTimeInBusiness: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-loan-min">Loan min</Label>
                <Input
                  id="partner-loan-min"
                  type="number"
                  value={partnerForm.loanAmountMin}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, loanAmountMin: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-loan-max">Loan max</Label>
                <Input
                  id="partner-loan-max"
                  type="number"
                  value={partnerForm.loanAmountMax}
                  onChange={(event) => setPartnerForm((current) => ({ ...current, loanAmountMax: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['startupAllowed', 'Startup friendly'],
                ['investorAllowed', 'Investor allowed'],
                ['ownerOccupiedAllowed', 'Owner occupied'],
                ['lowDoc', 'Low doc'],
                ['cashOutAllowed', 'Cash out'],
                ['bilingualSupport', 'Bilingual support'],
                ['spanishSupport', 'Spanish support'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-lg border border-slate-800 p-3 text-sm text-slate-200">
                  <Checkbox
                    checked={Boolean(partnerForm[key as keyof PartnerIntakeFormState])}
                    onCheckedChange={(checked) =>
                      setPartnerForm((current) => ({
                        ...current,
                        [key]: checked === true,
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-fit-summary">Fit summary</Label>
              <Textarea
                id="partner-fit-summary"
                value={partnerForm.fitSummary}
                onChange={(event) => setPartnerForm((current) => ({ ...current, fitSummary: event.target.value }))}
                placeholder="What they like, how they underwrite, and where they are most useful for VestBlock."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-preferred-borrowers">Preferred borrowers / deals</Label>
                <Textarea
                  id="partner-preferred-borrowers"
                  value={partnerForm.partnerProfile.preferredBorrowers}
                  onChange={(event) =>
                    setPartnerForm((current) => ({
                      ...current,
                      partnerProfile: { ...current.partnerProfile, preferredBorrowers: event.target.value },
                    }))
                  }
                  placeholder="BRRRR investors, 680+ owner-occupied buyers, established contractors, low-doc borrowers..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-no-go-items">No-go items / hard stops</Label>
                <Textarea
                  id="partner-no-go-items"
                  value={partnerForm.partnerProfile.noGoItems}
                  onChange={(event) =>
                    setPartnerForm((current) => ({
                      ...current,
                      partnerProfile: { ...current.partnerProfile, noGoItems: event.target.value },
                    }))
                  }
                  placeholder="No recent BK, no hospitality, no tax liens, no first-time rehabbers..."
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-submission-notes">Submission / packaging notes</Label>
                <Textarea
                  id="partner-submission-notes"
                  value={partnerForm.partnerProfile.submissionNotes}
                  onChange={(event) =>
                    setPartnerForm((current) => ({
                      ...current,
                      partnerProfile: { ...current.partnerProfile, submissionNotes: event.target.value },
                    }))
                  }
                  placeholder="Needs rent roll + scope of work, wants bank statements first, prefers warm intro with summary..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-process-owner">Partner process owner</Label>
                <Input
                  id="partner-process-owner"
                  value={partnerForm.partnerProfile.partnerProcessOwner}
                  onChange={(event) =>
                    setPartnerForm((current) => ({
                      ...current,
                      partnerProfile: { ...current.partnerProfile, partnerProcessOwner: event.target.value },
                    }))
                  }
                  placeholder="Capital markets manager, broker desk, branch manager..."
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-referral-status">Referral / broker program status</Label>
                <Textarea
                  id="partner-referral-status"
                  value={partnerForm.partnerProfile.referralProgramStatus}
                  onChange={(event) =>
                    setPartnerForm((current) => ({
                      ...current,
                      partnerProfile: { ...current.partnerProfile, referralProgramStatus: event.target.value },
                    }))
                  }
                  placeholder="Formal broker desk, direct referral path only, case-by-case, no paid referrals..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-referral-comp">Referral compensation notes</Label>
                <Textarea
                  id="partner-referral-comp"
                  value={partnerForm.partnerProfile.referralCompensationNotes}
                  onChange={(event) =>
                    setPartnerForm((current) => ({
                      ...current,
                      partnerProfile: { ...current.partnerProfile, referralCompensationNotes: event.target.value },
                    }))
                  }
                  placeholder="State-limited, requires disclosures, flat fee, bps, non-compensated relationship..."
                />
              </div>
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
                No usable lender email is saved yet. You can still use phone or DM scripts while we enrich the contact record.
              </div>
            ) : null}

            {outreach.length === 0 ? (
              <div className="text-sm text-slate-400">No outreach saved yet.</div>
            ) : (
              outreach.map((message) => (
                <div key={message.id} className="rounded-lg border border-slate-800 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium uppercase tracking-wide text-cyan-300">
                      {message.channel.replaceAll('_', ' ')}
                    </div>
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingMessageId === message.id}
                      onClick={() => void updateOutreach(message.id, 'approved', false)}
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingMessageId === message.id}
                      onClick={() => void updateOutreach(message.id, 'archived', false)}
                    >
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
                      <div className="font-medium text-white">{match.service_type || 'Funding route'}</div>
                      <Badge variant="secondary">{Math.round(match.confidence_score || 0)} / 100</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{match.fit_summary}</div>
                    {match.next_docs_needed?.length ? (
                      <div className="mt-2 text-xs text-slate-400">
                        Next docs: {match.next_docs_needed.join(', ')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">No borrower matches stored yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Notes and history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Add a lender relationship note, fit detail, or next step."
              />
              <Button variant="outline" onClick={addNote}>Save note</Button>
            </div>

            {notes.length ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-200">
                    <div>{note.note}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {new Date(note.created_at).toLocaleString()}
                    </div>
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
