"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Building2, ExternalLink, Loader2, Mail, Save, Send, Users } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/lenders/constants'
import type {
  LenderContactRecord,
  LenderMatchRecord,
  LenderOutreachMessageRecord,
  LenderPerformanceRecord,
  LenderProductRecord,
  LenderProgramRecord,
  LenderRecord,
} from '@/lib/lenders/types'
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
  lender: LenderRecord
  contacts: LenderContactRecord[]
  products: LenderProductRecord[]
  programs: LenderProgramRecord[]
  outreach: LenderOutreachMessageRecord[]
  matches: LenderMatchRecord[]
  performance: LenderPerformanceRecord | null
}

type FormState = {
  contactName: string
  contactEmail: string
  contactPhone: string
  statesServed: string
  fitSummary: string
  minCreditScore: string
  minRevenue: string
  minTimeInBusiness: string
  loanAmountMin: string
  loanAmountMax: string
  dscrMin: string
  speedToClose: string
  startupAllowed: boolean
  investorAllowed: boolean
  ownerOccupiedAllowed: boolean
  lowDoc: boolean
  cashOutAllowed: boolean
  bilingualSupport: boolean
  spanishSupport: boolean
  preferredBorrowers: string
  noGoItems: string
  submissionNotes: string
  partnerProcessOwner: string
  referralProgramStatus: string
  referralCompensationNotes: string
}

function currency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `$${Math.round(value).toLocaleString()}`
}

function defaultForm(lender: LenderRecord | null): FormState {
  const profile =
    lender?.metadata_json?.partnerProfile && typeof lender.metadata_json.partnerProfile === 'object'
      ? (lender.metadata_json.partnerProfile as Record<string, unknown>)
      : {}

  return {
    contactName: lender?.contact_name || '',
    contactEmail: lender?.contact_email || '',
    contactPhone: lender?.contact_phone || '',
    statesServed: (lender?.states_served || []).join(', '),
    fitSummary: lender?.fit_summary || '',
    minCreditScore: lender?.min_credit_score?.toString() || '',
    minRevenue: lender?.min_revenue?.toString() || '',
    minTimeInBusiness: lender?.min_time_in_business?.toString() || '',
    loanAmountMin: lender?.loan_amount_min?.toString() || '',
    loanAmountMax: lender?.loan_amount_max?.toString() || '',
    dscrMin: lender?.dscr_min?.toString() || '',
    speedToClose: lender?.speed_to_close || '',
    startupAllowed: Boolean(lender?.startup_allowed),
    investorAllowed: Boolean(lender?.investor_allowed),
    ownerOccupiedAllowed: Boolean(lender?.owner_occupied_allowed),
    lowDoc: Boolean(lender?.low_doc),
    cashOutAllowed: Boolean(lender?.cash_out_allowed),
    bilingualSupport: Boolean(lender?.bilingual_support),
    spanishSupport: Boolean(lender?.spanish_support),
    preferredBorrowers: typeof profile.preferredBorrowers === 'string' ? profile.preferredBorrowers : '',
    noGoItems: typeof profile.noGoItems === 'string' ? profile.noGoItems : '',
    submissionNotes: typeof profile.submissionNotes === 'string' ? profile.submissionNotes : '',
    partnerProcessOwner: typeof profile.partnerProcessOwner === 'string' ? profile.partnerProcessOwner : '',
    referralProgramStatus: typeof profile.referralProgramStatus === 'string' ? profile.referralProgramStatus : '',
    referralCompensationNotes:
      typeof profile.referralCompensationNotes === 'string' ? profile.referralCompensationNotes : '',
  }
}

export function LenderPartnerPortal({ token }: { token: string }) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<PortalResponse | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [matchLoadingId, setMatchLoadingId] = useState<string | null>(null)

  const fetchPortal = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/portal/lenders/${token}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load portal.')
      setDetail(data)
      setForm(defaultForm(data.lender))
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
      const response = await fetch(`/api/portal/lenders/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          statesServed: form.statesServed
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
          fitSummary: form.fitSummary.trim() || null,
          minCreditScore: form.minCreditScore ? Number(form.minCreditScore) : null,
          minRevenue: form.minRevenue ? Number(form.minRevenue) : null,
          minTimeInBusiness: form.minTimeInBusiness ? Number(form.minTimeInBusiness) : null,
          loanAmountMin: form.loanAmountMin ? Number(form.loanAmountMin) : null,
          loanAmountMax: form.loanAmountMax ? Number(form.loanAmountMax) : null,
          dscrMin: form.dscrMin ? Number(form.dscrMin) : null,
          speedToClose: form.speedToClose.trim() || null,
          startupAllowed: form.startupAllowed,
          investorAllowed: form.investorAllowed,
          ownerOccupiedAllowed: form.ownerOccupiedAllowed,
          lowDoc: form.lowDoc,
          cashOutAllowed: form.cashOutAllowed,
          bilingualSupport: form.bilingualSupport,
          spanishSupport: form.spanishSupport,
          partnerProfile: {
            preferredBorrowers: form.preferredBorrowers.trim() || null,
            noGoItems: form.noGoItems.trim() || null,
            submissionNotes: form.submissionNotes.trim() || null,
            partnerProcessOwner: form.partnerProcessOwner.trim() || null,
            referralProgramStatus: form.referralProgramStatus.trim() || null,
            referralCompensationNotes: form.referralCompensationNotes.trim() || null,
          },
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to save profile.')
      toast({ title: 'Partner profile saved' })
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
      const response = await fetch(`/api/portal/lenders/${token}`, {
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
    return {
      activeMatches: matches.filter((match) => match.status === 'active').length,
      openMatches: matches.filter((match) => ['matched', 'reviewed', 'shared'].includes(match.status)).length,
      statesCovered: detail?.lender.states_served?.length || 0,
    }
  }, [detail])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-300">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading lender portal...
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4">
        <Card className="w-full border-slate-800 bg-slate-950/80">
          <CardContent className="space-y-3 p-8 text-center">
            <div className="text-xl font-semibold text-white">This partner link is not active.</div>
            <p className="text-sm text-slate-400">
              Ask the VestBlock team for a fresh lender portal invite and we&apos;ll get you right back in.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { lender, contacts, products, programs, outreach, matches, performance, access } = detail

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">VestBlock partner portal</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-white">{lender.name}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Keep your lending box current, review borrower-fit opportunities, and help us route cleaner files into your lane.
              </p>
            </div>
            {lender.website ? (
              <Button asChild variant="outline">
                <a href={lender.website} target="_blank" rel="noreferrer">
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
              <div className="text-xs uppercase tracking-wide text-slate-400">States covered</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.statesCovered}</div>
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
                  <CardTitle className="text-white">Partner profile</CardTitle>
                  <p className="mt-1 text-sm text-slate-400">
                    Tell us what fits your real lending box so we can send better borrowers and better documentation.
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
                    <Label>States served</Label>
                    <Input placeholder="WI, IL, IN" value={form.statesServed} onChange={(event) => setForm((current) => ({ ...current, statesServed: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Speed to close</Label>
                    <Input placeholder="5-7 business days" value={form.speedToClose} onChange={(event) => setForm((current) => ({ ...current, speedToClose: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>DSCR min</Label>
                    <Input type="number" step="0.01" value={form.dscrMin} onChange={(event) => setForm((current) => ({ ...current, dscrMin: event.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Min credit</Label>
                    <Input type="number" value={form.minCreditScore} onChange={(event) => setForm((current) => ({ ...current, minCreditScore: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min revenue</Label>
                    <Input type="number" value={form.minRevenue} onChange={(event) => setForm((current) => ({ ...current, minRevenue: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time in business (months)</Label>
                    <Input type="number" value={form.minTimeInBusiness} onChange={(event) => setForm((current) => ({ ...current, minTimeInBusiness: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan min</Label>
                    <Input type="number" value={form.loanAmountMin} onChange={(event) => setForm((current) => ({ ...current, loanAmountMin: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan max</Label>
                    <Input type="number" value={form.loanAmountMax} onChange={(event) => setForm((current) => ({ ...current, loanAmountMax: event.target.value }))} />
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
                        checked={Boolean(form[key as keyof FormState])}
                        onCheckedChange={(checked) => setForm((current) => ({ ...current, [key]: checked === true }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Fit summary</Label>
                  <Textarea value={form.fitSummary} onChange={(event) => setForm((current) => ({ ...current, fitSummary: event.target.value }))} placeholder="Who you want most, what closes quickly, and where you want VestBlock to route you first." />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Preferred borrowers / deals</Label>
                    <Textarea value={form.preferredBorrowers} onChange={(event) => setForm((current) => ({ ...current, preferredBorrowers: event.target.value }))} placeholder="BRRRR investors, cash-out refis, owner-occupied first-time buyers..." />
                  </div>
                  <div className="space-y-2">
                    <Label>No-go items</Label>
                    <Textarea value={form.noGoItems} onChange={(event) => setForm((current) => ({ ...current, noGoItems: event.target.value }))} placeholder="No recent BK, no hospitality, no tax liens, no first-time rehabbers..." />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Submission notes</Label>
                    <Textarea value={form.submissionNotes} onChange={(event) => setForm((current) => ({ ...current, submissionNotes: event.target.value }))} placeholder="What should a clean file include before we send it?" />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner process owner</Label>
                    <Textarea value={form.partnerProcessOwner} onChange={(event) => setForm((current) => ({ ...current, partnerProcessOwner: event.target.value }))} placeholder="Who handles partner referrals, intake, or relationship ops?" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Referral program status</Label>
                    <Textarea value={form.referralProgramStatus} onChange={(event) => setForm((current) => ({ ...current, referralProgramStatus: event.target.value }))} placeholder="Do you have a broker/referral program, partner intake flow, or compliance paperwork?" />
                  </div>
                  <div className="space-y-2">
                    <Label>Referral compensation notes</Label>
                    <Textarea value={form.referralCompensationNotes} onChange={(event) => setForm((current) => ({ ...current, referralCompensationNotes: event.target.value }))} placeholder="Optional: share any fee structure or notes we should know once we're aligned." />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Borrower-fit opportunities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {matches.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
                    We don&apos;t have live borrower opportunities in your lane yet. Keeping your profile current helps us send cleaner matches sooner.
                  </div>
                ) : (
                  matches.map((match) => (
                    <div key={match.id} className="rounded-lg border border-slate-800 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-white">{match.fit_summary || 'Borrower-fit opportunity'}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {match.borrower_state || 'Unknown state'} · {match.borrower_industry || 'General'} · {match.deal_type || match.service_type || 'General fit'}
                          </div>
                        </div>
                        <Badge variant="secondary">{match.status.replaceAll('_', ' ')}</Badge>
                      </div>
                      {match.fit_explanation ? <p className="mt-3 text-sm text-slate-300">{match.fit_explanation}</p> : null}
                      {match.next_docs_needed?.length ? (
                        <div className="mt-3 text-xs text-slate-300">
                          <span className="text-slate-400">Next docs:</span> {match.next_docs_needed.join(', ')}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={matchLoadingId === match.id} onClick={() => void updateMatch(match.id, 'reviewed')}>
                          {matchLoadingId === match.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1 h-3.5 w-3.5" />}
                          Reviewing
                        </Button>
                        <Button size="sm" disabled={matchLoadingId === match.id} onClick={() => void updateMatch(match.id, 'active')}>
                          {matchLoadingId === match.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                          Good fit
                        </Button>
                        <Button size="sm" variant="secondary" disabled={matchLoadingId === match.id} onClick={() => void updateMatch(match.id, 'rejected')}>
                          Not a fit
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
                <CardTitle className="text-white">Current coverage snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-cyan-300" />
                  <span>{lender.lender_type.replaceAll('_', ' ')} · {CATEGORY_LABELS[lender.category] || lender.category.replaceAll('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-cyan-300" />
                  <span>{(lender.states_served || []).join(', ') || lender.national_or_regional}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Loan range {currency(lender.loan_amount_min)} - {currency(lender.loan_amount_max)} · DSCR {lender.dscr_min ?? '-'} · Confidence {Math.round(lender.confidence_score || 0)}/100
                </div>
                {performance ? (
                  <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
                    Sent {performance.outreach_sent_count || 0} · Responses {performance.response_count || 0} · Active matches {performance.active_match_count || 0}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Contacts and products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300">
                    <div className="font-medium text-white">{contact.name || 'Contact pending'}</div>
                    <div className="text-xs text-slate-400">{contact.title || 'Partner contact'}</div>
                    {contact.email ? <div className="mt-1">{contact.email}</div> : null}
                    {contact.phone ? <div>{contact.phone}</div> : null}
                  </div>
                ))}
                {products.slice(0, 3).map((product) => (
                  <div key={product.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300">
                    <div className="font-medium text-white">{product.product_name}</div>
                    <div className="text-xs text-slate-400">{CATEGORY_LABELS[product.category] || product.category.replaceAll('_', ' ')}</div>
                    {product.description ? <p className="mt-2 text-xs text-slate-400">{product.description}</p> : null}
                  </div>
                ))}
                {programs.slice(0, 2).map((program) => (
                  <div key={program.id} className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300">
                    <div className="font-medium text-white">{program.program_name}</div>
                    <div className="text-xs text-slate-400">{program.program_type.replaceAll('_', ' ')}</div>
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
