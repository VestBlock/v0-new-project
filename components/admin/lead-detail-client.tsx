"use client"

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, ExternalLink, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { LeadNoteRecord, LeadRecord, OutreachMessageRecord, OutreachSendEventRecord } from '@/lib/leads/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { LeadScoreRecord, TargetMarketRecord } from '@/lib/leads/types'

type LeadAgentQualification = {
  qualification_category: 'qualified_now' | 'follow_up' | 'partner_referral' | 'nurture' | 'manual_review' | 'do_not_contact'
  qualification_reason: string
  research_summary: string[]
  missing_information: string[]
  recommended_operator_action: string
  approval_recommendation: 'approve_outreach' | 'route_to_partner' | 'research_more' | 'hold' | 'do_not_contact'
  approval_reason: string
  best_channel: 'email' | 'sms' | 'phone_script' | 'partner' | 'manual_review'
  customer_reply_goal: string
}

type AiLeadSummaryResponse = {
  scoreSummary: {
    score: number
    recommended_offer_label: string
    contactability_level: string
    urgency_level: string
    recommended_next_action: string
  }
  outreachDraft: {
    suggested_subject_line: string
    primary_channel: string
    generated_with: string
  }
  leadAgentQualification: LeadAgentQualification
}

type AiActionResult = {
  action: 'approve_outreach' | 'route_to_partner'
  message: string
  partnerRouting?: {
    partnerName: string
    partnerPath: string | null
    fitSummary: string
  } | null
}

type RoughEstimateSnapshot = {
  sourceLabel?: string
  estimateValue?: number | null
  lowEstimate?: number | null
  highEstimate?: number | null
  rentEstimate?: number | null
  confidenceLabel?: string
  equityEstimate?: number | null
  ltvEstimate?: number | null
  acquisitionRangeLow?: number | null
  acquisitionRangeHigh?: number | null
  suggestedExitPaths?: string[]
  buyerPacketSummary?: string
  lenderPacketSummary?: string
  disclaimer?: string
  warnings?: string[]
}

function pickRecordString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function formatLeadAddress(lead: LeadRecord) {
  const address = String(lead.property_address || '').trim()
  const location = [lead.city, lead.state].filter(Boolean).join(', ')
  if (!address) return location || null
  if (!location) return address
  return address.toLowerCase().includes(location.toLowerCase()) ? address : `${address}, ${location}`
}

function getLeadContactSnapshot(lead: LeadRecord) {
  const contact = lead.contact_info || {}
  const formData = lead.form_data || {}

  return {
    contactName:
      lead.name ||
      pickRecordString(contact, ['name', 'contactName', 'fullName']) ||
      pickRecordString(formData, ['contactName', 'name', 'fullName']),
    businessName:
      lead.business_name ||
      pickRecordString(contact, ['businessName', 'companyName']) ||
      pickRecordString(formData, ['businessName', 'companyName']),
    email:
      lead.email ||
      pickRecordString(contact, ['email', 'contactEmail']) ||
      pickRecordString(formData, ['email', 'contactEmail']),
    phone:
      lead.phone ||
      pickRecordString(contact, ['phone', 'contactPhone']) ||
      pickRecordString(formData, ['phone', 'contactPhone']),
    website:
      lead.website ||
      pickRecordString(contact, ['website', 'websiteUrl']) ||
      pickRecordString(formData, ['website', 'websiteUrl']),
  }
}

function pickRecordObject(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function getLeadRoughEstimate(lead: LeadRecord): RoughEstimateSnapshot | null {
  const estimate = pickRecordObject(lead.form_data, 'roughEstimate')
  if (!estimate) return null

  return {
    sourceLabel: pickRecordString(estimate, ['sourceLabel', 'source']) || undefined,
    estimateValue: typeof estimate.estimateValue === 'number' ? estimate.estimateValue : null,
    lowEstimate: typeof estimate.lowEstimate === 'number' ? estimate.lowEstimate : null,
    highEstimate: typeof estimate.highEstimate === 'number' ? estimate.highEstimate : null,
    rentEstimate: typeof estimate.rentEstimate === 'number' ? estimate.rentEstimate : null,
    confidenceLabel: pickRecordString(estimate, ['confidenceLabel']) || undefined,
    equityEstimate: typeof estimate.equityEstimate === 'number' ? estimate.equityEstimate : null,
    ltvEstimate: typeof estimate.ltvEstimate === 'number' ? estimate.ltvEstimate : null,
    acquisitionRangeLow: typeof estimate.acquisitionRangeLow === 'number' ? estimate.acquisitionRangeLow : null,
    acquisitionRangeHigh: typeof estimate.acquisitionRangeHigh === 'number' ? estimate.acquisitionRangeHigh : null,
    suggestedExitPaths: Array.isArray(estimate.suggestedExitPaths)
      ? estimate.suggestedExitPaths.filter((path): path is string => typeof path === 'string')
      : [],
    buyerPacketSummary: pickRecordString(estimate, ['buyerPacketSummary']) || undefined,
    lenderPacketSummary: pickRecordString(estimate, ['lenderPacketSummary']) || undefined,
    disclaimer: pickRecordString(estimate, ['disclaimer']) || undefined,
    warnings: Array.isArray(estimate.warnings)
      ? estimate.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
  }
}

function formatMoney(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatExitPath(path: string) {
  return path.replace(/_/g, ' ')
}

export function LeadDetailClient({ leadId }: { leadId: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [lead, setLead] = useState<LeadRecord | null>(null)
  const [score, setScore] = useState<LeadScoreRecord | null>(null)
  const [outreach, setOutreach] = useState<OutreachMessageRecord[]>([])
  const [notes, setNotes] = useState<LeadNoteRecord[]>([])
  const [sendEvents, setSendEvents] = useState<OutreachSendEventRecord[]>([])
  const [market, setMarket] = useState<TargetMarketRecord | null>(null)
  const [aiSummary, setAiSummary] = useState<AiLeadSummaryResponse | null>(null)
  const [aiActionResult, setAiActionResult] = useState<AiActionResult | null>(null)
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false)
  const [isApplyingAiAction, setIsApplyingAiAction] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false)
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const fetchLead = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace(`/login?redirect=/admin/leads/${leadId}`)
        return
      }

      const response = await fetch(`/api/admin/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Lead detail failed to load.')
      const data = await response.json()
      setLead(data.lead || null)
      setScore(data.score || null)
      setOutreach(data.outreach || [])
      setNotes(data.notes || [])
      setSendEvents(data.sendEvents || [])
      setMarket(data.market || null)
    } catch (error) {
      toast({
        title: 'Unable to load lead detail',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [leadId, router, supabase, toast])

  const fetchAiSummary = async () => {
    setIsLoadingAiSummary(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) return

      const response = await fetch(`/api/admin/leads/${leadId}/ai-summary`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('AI summary failed to load.')
      const data = await response.json()
      setAiSummary({
        scoreSummary: data.scoreSummary,
        outreachDraft: data.outreachDraft,
        leadAgentQualification: data.leadAgentQualification,
      })
      toast({ title: 'AI qualification ready' })
    } catch (error) {
      toast({
        title: 'AI summary failed',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingAiSummary(false)
    }
  }

  const runAiAction = async (action: 'approve_outreach' | 'route_to_partner') => {
    setIsApplyingAiAction(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) return

      const response = await fetch(`/api/admin/leads/${leadId}/ai-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'AI action failed.')

      setAiActionResult({
        action: data.action,
        message: data.message,
        partnerRouting: data.partnerRouting || null,
      })
      toast({ title: 'AI action applied', description: data.message })
      await fetchLead()
    } catch (error) {
      toast({
        title: 'AI action failed',
        description: error instanceof Error ? error.message : 'Try again shortly.',
        variant: 'destructive',
      })
    } finally {
      setIsApplyingAiAction(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?redirect=/admin/leads/${leadId}`)
      return
    }
    if (isAuthenticated) {
      queueMicrotask(() => {
        void fetchLead()
      })
    }
  }, [authLoading, fetchLead, isAuthenticated, leadId, router])

  const generateOutreach = async () => {
    setIsGeneratingOutreach(true)
    try {
      toast({
        title: 'Outreach runs off-platform',
        description: 'Use npm run outreach:v4-workflow from Codex/operator mode to generate and review drafts.',
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

      const response = await fetch(`/api/admin/leads/${leadId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ note: noteText }),
      })

      if (!response.ok) throw new Error('Could not save note.')
      setNoteText('')
      await fetchLead()
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

      const response = await fetch(`/api/admin/leads/${leadId}/outreach`, {
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
      await fetchLead()
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
        Loading lead detail...
      </div>
    )
  }

  if (!lead) {
    return <div className="text-slate-300">Lead not found.</div>
  }

  const emailChannelAvailable = Boolean(lead.email && lead.email_valid !== false)
  const formattedLeadAddress = formatLeadAddress(lead)
  const contactSnapshot = getLeadContactSnapshot(lead)
  const roughEstimate = getLeadRoughEstimate(lead)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">{lead.business_name || lead.name || 'Lead detail'}</CardTitle>
            <p className="mt-1 text-sm text-slate-400">{lead.source || 'Manual lead'} · {lead.category || lead.lead_type}</p>
          </div>
          <Badge variant="secondary">{lead.best_offer || 'Unassigned offer'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-200">
          <div className="grid gap-3 md:grid-cols-2">
            <div><span className="text-slate-400">Score:</span> {lead.lead_score || 0}</div>
            <div><span className="text-slate-400">Status:</span> {lead.status}</div>
            <div><span className="text-slate-400">Niche:</span> {lead.niche || '-'}</div>
            <div><span className="text-slate-400">Primary contact:</span> {contactSnapshot.contactName || '-'}</div>
            <div><span className="text-slate-400">Business:</span> {contactSnapshot.businessName || '-'}</div>
            <div><span className="text-slate-400">Email:</span> {contactSnapshot.email || '-'}</div>
            <div><span className="text-slate-400">Phone:</span> {contactSnapshot.phone || '-'}</div>
            <div><span className="text-slate-400">City:</span> {[lead.city, lead.state].filter(Boolean).join(', ') || '-'}</div>
            <div><span className="text-slate-400">Website:</span> {contactSnapshot.website ? <a className="text-cyan-300 hover:underline" href={contactSnapshot.website} target="_blank" rel="noreferrer">{contactSnapshot.website}</a> : '-'}</div>
            <div><span className="text-slate-400">Outreach status:</span> {lead.outreach_status || '-'}</div>
            <div><span className="text-slate-400">Delivery status:</span> {lead.delivery_status || '-'}</div>
          </div>

          {formattedLeadAddress ? (
            <div>
              <div className="text-slate-400">Property / business address</div>
              <div>{formattedLeadAddress}</div>
            </div>
          ) : null}

          {roughEstimate ? (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-950/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-white">Property estimate and deal fit</div>
                  <div className="text-xs text-slate-400">
                    {roughEstimate.sourceLabel || 'Internal review'} · {roughEstimate.confidenceLabel || 'needs review'} confidence
                  </div>
                </div>
                {roughEstimate.suggestedExitPaths?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {roughEstimate.suggestedExitPaths.slice(0, 4).map((path) => (
                      <Badge key={path} variant="secondary">{formatExitPath(path)}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div><span className="text-slate-400">Rough value:</span> {formatMoney(roughEstimate.estimateValue)}</div>
                <div><span className="text-slate-400">Value band:</span> {formatMoney(roughEstimate.lowEstimate)} - {formatMoney(roughEstimate.highEstimate)}</div>
                <div><span className="text-slate-400">Rent estimate:</span> {formatMoney(roughEstimate.rentEstimate)}</div>
                <div><span className="text-slate-400">Equity estimate:</span> {formatMoney(roughEstimate.equityEstimate)}</div>
                <div><span className="text-slate-400">Estimated LTV:</span> {roughEstimate.ltvEstimate !== null && roughEstimate.ltvEstimate !== undefined ? `${roughEstimate.ltvEstimate}%` : '-'}</div>
                <div><span className="text-slate-400">Cash review band:</span> {formatMoney(roughEstimate.acquisitionRangeLow)} - {formatMoney(roughEstimate.acquisitionRangeHigh)}</div>
              </div>
              {roughEstimate.buyerPacketSummary ? (
                <div className="mt-3">
                  <div className="text-slate-400">Buyer packet</div>
                  <div>{roughEstimate.buyerPacketSummary}</div>
                </div>
              ) : null}
              {roughEstimate.lenderPacketSummary ? (
                <div className="mt-3">
                  <div className="text-slate-400">Lender packet</div>
                  <div>{roughEstimate.lenderPacketSummary}</div>
                </div>
              ) : null}
              {roughEstimate.warnings?.length ? (
                <div className="mt-3 text-xs text-amber-200">
                  {roughEstimate.warnings.slice(0, 2).join(' ')}
                </div>
              ) : null}
              {roughEstimate.disclaimer ? (
                <div className="mt-2 text-xs text-slate-500">{roughEstimate.disclaimer}</div>
              ) : null}
            </div>
          ) : null}

          {lead.pain_signal ? (
            <div>
              <div className="text-slate-400">Pain signal</div>
              <div>{lead.pain_signal}</div>
            </div>
          ) : null}

          {score?.reasoning ? (
            <div>
              <div className="text-slate-400">AI score explanation</div>
              <div>{score.reasoning}</div>
            </div>
          ) : null}

          {lead.website_audit_json && Object.keys(lead.website_audit_json).length ? (
            <div>
              <div className="text-slate-400">Website audit notes</div>
              <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-800 p-3 text-xs text-slate-300">
                {JSON.stringify(lead.website_audit_json, null, 2)}
              </pre>
            </div>
          ) : null}

          {market ? (
            <div>
              <div className="text-slate-400">Target market</div>
              <div>{market.city}, {market.state} · {market.metro_area || 'Local market'} · score {market.final_score}</div>
            </div>
          ) : null}

          {lead.source_url ? (
            <Button asChild variant="outline">
              <a href={lead.source_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open source record
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">AI qualification</CardTitle>
            <Button variant="outline" onClick={fetchAiSummary} disabled={isLoadingAiSummary}>
              {isLoadingAiSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {aiSummary ? 'Refresh AI summary' : 'Build AI summary'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!aiSummary ? (
              <div className="text-sm text-slate-400">
                Run a lead-agent-style qualification pass for category, research notes, operator action, and approval guidance.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{aiSummary.leadAgentQualification.qualification_category.replace(/_/g, ' ')}</Badge>
                  <Badge variant="secondary">{aiSummary.leadAgentQualification.approval_recommendation.replace(/_/g, ' ')}</Badge>
                  <Badge variant="secondary">{aiSummary.leadAgentQualification.best_channel.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-200">
                  <div><span className="text-slate-400">AI score:</span> {aiSummary.scoreSummary.score}</div>
                  <div><span className="text-slate-400">Recommended offer:</span> {aiSummary.scoreSummary.recommended_offer_label}</div>
                  <div><span className="text-slate-400">Urgency:</span> {aiSummary.scoreSummary.urgency_level}</div>
                  <div><span className="text-slate-400">Contactability:</span> {aiSummary.scoreSummary.contactability_level}</div>
                  <div><span className="text-slate-400">Primary channel:</span> {aiSummary.outreachDraft.primary_channel}</div>
                  <div><span className="text-slate-400">Generated with:</span> {aiSummary.outreachDraft.generated_with}</div>
                </div>
                <div>
                  <div className="text-slate-400">Qualification reason</div>
                  <div className="text-sm text-slate-200">{aiSummary.leadAgentQualification.qualification_reason}</div>
                </div>
                <div>
                  <div className="text-slate-400">Research summary</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                    {aiSummary.leadAgentQualification.research_summary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                {aiSummary.leadAgentQualification.missing_information.length ? (
                  <div>
                    <div className="text-slate-400">Missing information</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
                      {aiSummary.leadAgentQualification.missing_information.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <div className="text-slate-400">Recommended operator action</div>
                  <div className="text-sm text-slate-200">{aiSummary.leadAgentQualification.recommended_operator_action}</div>
                </div>
                <div>
                  <div className="text-slate-400">Approval reason</div>
                  <div className="text-sm text-slate-200">{aiSummary.leadAgentQualification.approval_reason}</div>
                </div>
                <div>
                  <div className="text-slate-400">Customer reply goal</div>
                  <div className="text-sm text-slate-200">{aiSummary.leadAgentQualification.customer_reply_goal}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiSummary.leadAgentQualification.approval_recommendation === 'approve_outreach' ? (
                    <Button onClick={() => void runAiAction('approve_outreach')} disabled={isApplyingAiAction}>
                      {isApplyingAiAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                      Approve first email draft
                    </Button>
                  ) : null}
                  {aiSummary.leadAgentQualification.approval_recommendation === 'route_to_partner' ? (
                    <Button variant="outline" onClick={() => void runAiAction('route_to_partner')} disabled={isApplyingAiAction}>
                      {isApplyingAiAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                      Create partner routing task
                    </Button>
                  ) : null}
                </div>
                {aiActionResult ? (
                  <div className="rounded-lg border border-slate-800 p-3 text-sm text-slate-200">
                    <div className="font-medium text-white">{aiActionResult.message}</div>
                    {aiActionResult.partnerRouting?.fitSummary ? (
                      <div className="mt-2 text-slate-300">{aiActionResult.partnerRouting.fitSummary}</div>
                    ) : null}
                    {aiActionResult.partnerRouting?.partnerPath ? (
                      <a
                        className="mt-2 inline-flex text-cyan-300 hover:underline"
                        href={aiActionResult.partnerRouting.partnerPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open suggested partner path
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
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
            {outreach.length === 0 ? (
              <div className="text-sm text-slate-400">No outreach saved yet.</div>
            ) : (
              outreach.map((message) => (
                <div key={message.id} className="rounded-lg border border-slate-800 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium uppercase tracking-wide text-cyan-300">
                      {message.channel.replace('_', ' ')}
                    </div>
                    <Badge variant="secondary">{message.status}</Badge>
                  </div>
                  {message.subject ? <div className="mb-2 font-medium text-white">{message.subject}</div> : null}
                  {message.cta ? <div className="mb-2 text-xs text-emerald-300">CTA: {message.cta}</div> : null}
                  {message.language ? <div className="mb-2 text-xs text-slate-400">Language: {message.language}</div> : null}
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">{message.body}</pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.channel === 'email' && message.status !== 'approved' && message.status !== 'sent' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateOutreach(message.id, 'approved')}
                        disabled={updatingMessageId === message.id}
                      >
                        {updatingMessageId === message.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Approve
                      </Button>
                    ) : null}
                    {message.channel === 'email' && (message.status === 'approved' || message.status === 'needs_review') ? (
                      <Button
                        size="sm"
                        onClick={() => updateOutreach(message.id, 'approved', true)}
                        disabled={updatingMessageId === message.id || !emailChannelAvailable}
                      >
                        {updatingMessageId === message.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        Send now
                      </Button>
                    ) : null}
                    {message.status !== 'archived' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateOutreach(message.id, 'archived')}
                        disabled={updatingMessageId === message.id}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                  {message.channel === 'email' && !emailChannelAvailable ? (
                    <div className="mt-2 text-xs text-amber-300">
                      Email send unavailable: this lead does not have a usable email address.
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Send history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sendEvents.length === 0 ? (
              <div className="text-sm text-slate-400">No send events yet.</div>
            ) : (
              sendEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium text-white">{event.channel.replace('_', ' ')}</div>
                    <Badge variant="secondary">{event.status}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(event.created_at).toLocaleString()}
                    {event.provider ? ` · ${event.provider}` : ''}
                  </div>
                  {event.error_message ? <div className="mt-2 text-xs text-rose-300">{event.error_message}</div> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add an internal note or follow-up context"
              className="min-h-[120px]"
            />
            <Button onClick={addNote}>Add note</Button>
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200">
                  <div className="mb-2 text-xs text-slate-500">{new Date(note.created_at).toLocaleString()}</div>
                  {note.note}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
