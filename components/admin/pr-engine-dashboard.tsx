'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart3,
  Clock3,
  Loader2,
  MapPinned,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trophy,
  Wand2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { getSupabaseClient } from '@/lib/supabase/client'
import type {
  PrEngineDashboard as PrEngineDashboardData,
  PrLearningSnapshotRecord,
  PrPitchDraftRecord,
  PrRunRecord,
  PrTargetRecord,
} from '@/lib/pr/types'
import {
  prDraftStatuses,
  prPriorities,
  prTargetCategories,
  prTargetStatuses,
  prTargetTypes,
} from '@/lib/pr/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type DashboardResponse = {
  success: boolean
  dashboard: PrEngineDashboardData
}

type TargetFormState = {
  label: string
  organizationName: string
  contactName: string
  contactEmail: string
  targetType: (typeof prTargetTypes)[number]
  targetCategory: (typeof prTargetCategories)[number]
  audienceType: string
  audienceUrl: string
  submissionUrl: string
  city: string
  state: string
  metroArea: string
  status: (typeof prTargetStatuses)[number]
  priority: (typeof prPriorities)[number]
  fitScore: string
  revenueScore: string
  authorityScore: string
  responseProbabilityScore: string
  businessAudienceScore: string
  backlinkScore: string
  fundingAngleScore: string
  cityPriorityScore: string
  geography: string
  angleTags: string
  nextFollowUpAt: string
  notes: string
  lastResult: string
}

type DraftEditorState = {
  id: string
  title: string
  subjectLine: string
  previewText: string
  bodyMarkdown: string
  founderBio: string
  keyPoints: string
  callToAction: string
  status: (typeof prDraftStatuses)[number]
  targetLabel: string
}

const emptyTargetForm: TargetFormState = {
  label: '',
  organizationName: '',
  contactName: '',
  contactEmail: '',
  targetType: 'newsletter',
  targetCategory: 'local_small_business',
  audienceType: '',
  audienceUrl: '',
  submissionUrl: '',
  city: '',
  state: '',
  metroArea: '',
  status: 'new',
  priority: 'normal',
  fitScore: '60',
  revenueScore: '70',
  authorityScore: '55',
  responseProbabilityScore: '55',
  businessAudienceScore: '75',
  backlinkScore: '55',
  fundingAngleScore: '70',
  cityPriorityScore: '60',
  geography: '',
  angleTags: '',
  nextFollowUpAt: '',
  notes: '',
  lastResult: '',
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'Not set'
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true })
  } catch {
    return value
  }
}

function isoToLocalInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function localInputToIso(value: string) {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function normalizeOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort()
}

function targetToForm(target: PrTargetRecord): TargetFormState {
  return {
    label: target.label || '',
    organizationName: target.organization_name || '',
    contactName: target.contact_name || '',
    contactEmail: target.contact_email || '',
    targetType: target.target_type,
    targetCategory: target.target_category,
    audienceType: target.audience_type || '',
    audienceUrl: target.audience_url || '',
    submissionUrl: target.submission_url || '',
    city: target.city || '',
    state: target.state || '',
    metroArea: target.metro_area || '',
    status: target.status,
    priority: target.priority,
    fitScore: String(target.fit_score ?? 60),
    revenueScore: String(target.revenue_score ?? 70),
    authorityScore: String(target.authority_score ?? 55),
    responseProbabilityScore: String(target.response_probability_score ?? 55),
    businessAudienceScore: String(target.business_audience_score ?? 75),
    backlinkScore: String(target.backlink_score ?? 55),
    fundingAngleScore: String(target.funding_angle_score ?? 70),
    cityPriorityScore: String(target.city_priority_score ?? 60),
    geography: (target.geography || []).join(', '),
    angleTags: (target.angle_tags || []).join(', '),
    nextFollowUpAt: isoToLocalInput(target.next_follow_up_at),
    notes: target.notes || '',
    lastResult: target.last_result || '',
  }
}

function draftToEditor(
  draft: PrPitchDraftRecord & { target?: { id: string; label: string; status: string } | null }
): DraftEditorState {
  return {
    id: draft.id,
    title: draft.title || '',
    subjectLine: draft.subject_line || '',
    previewText: draft.preview_text || '',
    bodyMarkdown: draft.body_markdown || '',
    founderBio: draft.founder_bio || '',
    keyPoints: (draft.key_points || []).join(', '),
    callToAction: draft.call_to_action || '',
    status: draft.status,
    targetLabel: draft.target?.label || 'Unknown target',
  }
}

export function PrEngineDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [data, setData] = useState<PrEngineDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null)
  const [targetForm, setTargetForm] = useState<TargetFormState>(emptyTargetForm)
  const [draftEditor, setDraftEditor] = useState<DraftEditorState | null>(null)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [cityFilter, setCityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      router.replace('/login?redirect=/admin/pr-engine')
      return null
    }
    return session.access_token
  }, [router, supabase])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const params = new URLSearchParams()
      if (cityFilter !== 'all') params.set('city', cityFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/admin/pr-engine?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to load the PR engine.')
      }
      const body = (await response.json()) as DashboardResponse
      setData(body.dashboard)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load the PR engine.')
    } finally {
      setIsLoading(false)
    }
  }, [cityFilter, categoryFilter, statusFilter, getAccessToken])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/pr-engine')
      return
    }
    if (isAuthenticated) void load()
  }, [authLoading, isAuthenticated, load, router])

  function resetTargetForm() {
    setEditingTargetId(null)
    setTargetForm(emptyTargetForm)
  }

  async function postIntent(payload: Record<string, unknown>) {
    const accessToken = await getAccessToken()
    if (!accessToken) return null

    const response = await fetch('/api/admin/pr-engine', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.error || 'PR action failed.')
    }
    return body
  }

  async function patchEntity(payload: Record<string, unknown>) {
    const accessToken = await getAccessToken()
    if (!accessToken) return null

    const response = await fetch('/api/admin/pr-engine', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.error || 'PR update failed.')
    }
    return body
  }

  async function saveTarget() {
    setIsSaving(true)
    setError(null)
    try {
      await postIntent({
        intent: 'create_target',
        target: {
          id: editingTargetId || undefined,
          label: targetForm.label,
          organizationName: targetForm.organizationName,
          contactName: targetForm.contactName,
          contactEmail: targetForm.contactEmail,
          targetType: targetForm.targetType,
          targetCategory: targetForm.targetCategory,
          audienceType: targetForm.audienceType,
          audienceUrl: targetForm.audienceUrl,
          submissionUrl: targetForm.submissionUrl,
          city: targetForm.city,
          state: targetForm.state,
          metroArea: targetForm.metroArea,
          status: targetForm.status,
          priority: targetForm.priority,
          fitScore: Number(targetForm.fitScore || 60),
          revenueScore: Number(targetForm.revenueScore || 70),
          authorityScore: Number(targetForm.authorityScore || 55),
          responseProbabilityScore: Number(targetForm.responseProbabilityScore || 55),
          businessAudienceScore: Number(targetForm.businessAudienceScore || 75),
          backlinkScore: Number(targetForm.backlinkScore || 55),
          fundingAngleScore: Number(targetForm.fundingAngleScore || 70),
          cityPriorityScore: Number(targetForm.cityPriorityScore || 60),
          geography: targetForm.geography,
          angleTags: targetForm.angleTags,
          nextFollowUpAt: localInputToIso(targetForm.nextFollowUpAt),
          notes: targetForm.notes,
          lastResult: targetForm.lastResult,
        },
      })
      toast({
        title: editingTargetId ? 'PR target updated' : 'PR target created',
        description: 'The PR pipeline is ready for the next move.',
      })
      resetTargetForm()
      await load()
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Unable to save PR target.'
      setError(message)
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  async function runOperatorAction(
    intent:
      | 'run_discovery'
      | 'run_city_expansion'
      | 'run_pitch_automation'
      | 'queue_approved_outreach'
      | 'run_weekly_learning'
  ) {
    setIsSaving(true)
    try {
      await postIntent({ intent })
      toast({
        title: 'PR engine ran',
        description: intent.replaceAll('_', ' '),
      })
      await load()
    } catch (nextError) {
      toast({
        title: 'PR run failed',
        description: nextError instanceof Error ? nextError.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function generatePitch(targetId: string, angle?: string) {
    setIsSaving(true)
    try {
      await postIntent({
        intent: 'generate_pitch',
        targetId,
        pitchChannel: 'email',
        angle,
      })
      toast({ title: 'Pitch draft generated', description: 'A new draft has been added to the queue.' })
      await load()
    } catch (nextError) {
      toast({
        title: 'Pitch generation failed',
        description: nextError instanceof Error ? nextError.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function patchTarget(target: PrTargetRecord, patch: Partial<TargetFormState> & { status?: string }) {
    setIsSaving(true)
    try {
      const base = targetToForm(target)
      await patchEntity({
        entity: 'target',
        id: target.id,
        label: patch.label ?? base.label,
        organizationName: patch.organizationName ?? base.organizationName,
        contactName: patch.contactName ?? base.contactName,
        contactEmail: patch.contactEmail ?? base.contactEmail,
        targetType: patch.targetType ?? base.targetType,
        targetCategory: patch.targetCategory ?? base.targetCategory,
        audienceType: patch.audienceType ?? base.audienceType,
        audienceUrl: patch.audienceUrl ?? base.audienceUrl,
        submissionUrl: patch.submissionUrl ?? base.submissionUrl,
        city: patch.city ?? base.city,
        state: patch.state ?? base.state,
        metroArea: patch.metroArea ?? base.metroArea,
        status: patch.status ?? base.status,
        priority: patch.priority ?? base.priority,
        fitScore: Number(patch.fitScore ?? base.fitScore),
        revenueScore: Number(patch.revenueScore ?? base.revenueScore),
        authorityScore: Number(patch.authorityScore ?? base.authorityScore),
        responseProbabilityScore: Number(patch.responseProbabilityScore ?? base.responseProbabilityScore),
        businessAudienceScore: Number(patch.businessAudienceScore ?? base.businessAudienceScore),
        backlinkScore: Number(patch.backlinkScore ?? base.backlinkScore),
        fundingAngleScore: Number(patch.fundingAngleScore ?? base.fundingAngleScore),
        cityPriorityScore: Number(patch.cityPriorityScore ?? base.cityPriorityScore),
        geography: patch.geography ?? base.geography,
        angleTags: patch.angleTags ?? base.angleTags,
        nextFollowUpAt: localInputToIso(patch.nextFollowUpAt ?? base.nextFollowUpAt),
        notes: patch.notes ?? base.notes,
        lastResult: patch.lastResult ?? base.lastResult,
      })
      await load()
    } catch (nextError) {
      toast({
        title: 'Target update failed',
        description: nextError instanceof Error ? nextError.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function patchDraft(payload: Partial<DraftEditorState> & { id: string }) {
    setIsSaving(true)
    try {
      await patchEntity({
        entity: 'draft',
        id: payload.id,
        title: payload.title,
        subjectLine: payload.subjectLine,
        previewText: payload.previewText,
        bodyMarkdown: payload.bodyMarkdown,
        founderBio: payload.founderBio,
        keyPoints: payload.keyPoints,
        callToAction: payload.callToAction,
        status: payload.status,
      })
      toast({ title: 'Draft updated', description: 'The pitch queue has been refreshed.' })
      setDraftDialogOpen(false)
      await load()
    } catch (nextError) {
      toast({
        title: 'Draft update failed',
        description: nextError instanceof Error ? nextError.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function markDraftSent(draft: PrPitchDraftRecord & { target?: { id: string; label: string; status: string } | null }) {
    setIsSaving(true)
    try {
      await postIntent({
        intent: 'log_outreach',
        targetId: draft.target_id,
        draftId: draft.id,
        activityType: 'submission',
        channel: draft.pitch_channel,
        status: 'waiting',
        subject: draft.subject_line || draft.title,
        messageExcerpt: draft.body_markdown,
        destination: draft.target?.label || null,
      })
      toast({ title: 'Submission logged', description: 'The follow-up timer has started.' })
      await load()
    } catch (nextError) {
      toast({
        title: 'Submission logging failed',
        description: nextError instanceof Error ? nextError.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function patchOutreach(id: string, patch: { status?: string; outcome?: string; nextFollowUpAt?: string | null; respondedAt?: string | null }) {
    setIsSaving(true)
    try {
      await patchEntity({
        entity: 'outreach',
        id,
        status: patch.status,
        outcome: patch.outcome,
        nextFollowUpAt: patch.nextFollowUpAt,
        respondedAt: patch.respondedAt,
      })
      await load()
    } catch (nextError) {
      toast({
        title: 'Outreach update failed',
        description: nextError instanceof Error ? nextError.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const cityOptions = useMemo(() => normalizeOptions((data?.targets || []).map((item) => [item.city, item.state].filter(Boolean).join(', '))), [data?.targets])
  const filteredTargets = data?.targets || []
  const latestRuns = data?.recentRuns || []
  const learningSnapshots = data?.learningSnapshots || []

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-300">Loading the PR engine...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
          <AlertTitle>PR engine needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Targets" value={data?.summary.totalTargets || 0} />
        <MetricCard title="Ready to pitch" value={data?.summary.readyToPitch || 0} />
        <MetricCard title="Approved drafts" value={data?.summary.approvedDrafts || 0} />
        <MetricCard title="Follow-up due" value={data?.summary.followUpDue || 0} />
        <MetricCard title="Wins" value={data?.summary.wins || 0} />
        <MetricCard title="Urgent targets" value={data?.summary.urgentTargets || 0} />
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">Best immediate PR move</CardTitle>
            <CardDescription>Keep the machine revenue-biased instead of visibility for visibility’s sake.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={isLoading || isSaving}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <Button variant="outline" onClick={() => void runOperatorAction('run_discovery')} disabled={isSaving}>
              <Target className="mr-2 h-4 w-4" />
              Discover
            </Button>
            <Button variant="outline" onClick={() => void runOperatorAction('run_city_expansion')} disabled={isSaving}>
              <MapPinned className="mr-2 h-4 w-4" />
              Expand cities
            </Button>
            <Button variant="outline" onClick={() => void runOperatorAction('run_pitch_automation')} disabled={isSaving}>
              <Sparkles className="mr-2 h-4 w-4" />
              Draft queue
            </Button>
            <Button variant="outline" onClick={() => void runOperatorAction('queue_approved_outreach')} disabled={isSaving}>
              <Send className="mr-2 h-4 w-4" />
              Queue outreach
            </Button>
            <Button variant="outline" onClick={() => void runOperatorAction('run_weekly_learning')} disabled={isSaving}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Learn
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
            {data?.summary.bestImmediateMove || 'Run discovery and city expansion to feed the queue.'}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">{editingTargetId ? 'Edit PR target' : 'Add PR target'}</CardTitle>
            <CardDescription>
              Track real targets with city, category, and fit scoring so the automation can prioritize well.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Target label" value={targetForm.label} onChange={(event) => setTargetForm((current) => ({ ...current, label: event.target.value }))} />
              <Input placeholder="Organization" value={targetForm.organizationName} onChange={(event) => setTargetForm((current) => ({ ...current, organizationName: event.target.value }))} />
              <Input placeholder="Contact name" value={targetForm.contactName} onChange={(event) => setTargetForm((current) => ({ ...current, contactName: event.target.value }))} />
              <Input placeholder="Contact email" value={targetForm.contactEmail} onChange={(event) => setTargetForm((current) => ({ ...current, contactEmail: event.target.value }))} />
              <Select value={targetForm.targetType} onValueChange={(value) => setTargetForm((current) => ({ ...current, targetType: value as TargetFormState['targetType'] }))}>
                <SelectTrigger><SelectValue placeholder="Target type" /></SelectTrigger>
                <SelectContent>{prTargetTypes.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={targetForm.targetCategory} onValueChange={(value) => setTargetForm((current) => ({ ...current, targetCategory: value as TargetFormState['targetCategory'] }))}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{prTargetCategories.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Audience type" value={targetForm.audienceType} onChange={(event) => setTargetForm((current) => ({ ...current, audienceType: event.target.value }))} />
              <Input placeholder="Audience URL" value={targetForm.audienceUrl} onChange={(event) => setTargetForm((current) => ({ ...current, audienceUrl: event.target.value }))} />
              <Input placeholder="Submission URL" value={targetForm.submissionUrl} onChange={(event) => setTargetForm((current) => ({ ...current, submissionUrl: event.target.value }))} />
              <Input placeholder="City" value={targetForm.city} onChange={(event) => setTargetForm((current) => ({ ...current, city: event.target.value }))} />
              <Input placeholder="State" value={targetForm.state} onChange={(event) => setTargetForm((current) => ({ ...current, state: event.target.value }))} />
              <Input placeholder="Metro area" value={targetForm.metroArea} onChange={(event) => setTargetForm((current) => ({ ...current, metroArea: event.target.value }))} />
              <Select value={targetForm.status} onValueChange={(value) => setTargetForm((current) => ({ ...current, status: value as TargetFormState['status'] }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{prTargetStatuses.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={targetForm.priority} onValueChange={(value) => setTargetForm((current) => ({ ...current, priority: value as TargetFormState['priority'] }))}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>{prPriorities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Geography tags" value={targetForm.geography} onChange={(event) => setTargetForm((current) => ({ ...current, geography: event.target.value }))} />
              <Input placeholder="Angle tags" value={targetForm.angleTags} onChange={(event) => setTargetForm((current) => ({ ...current, angleTags: event.target.value }))} />
              <Input type="datetime-local" value={targetForm.nextFollowUpAt} onChange={(event) => setTargetForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} />
              <Input placeholder="Last result" value={targetForm.lastResult} onChange={(event) => setTargetForm((current) => ({ ...current, lastResult: event.target.value }))} />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="Fit" type="number" value={targetForm.fitScore} onChange={(event) => setTargetForm((current) => ({ ...current, fitScore: event.target.value }))} />
              <Input placeholder="Revenue" type="number" value={targetForm.revenueScore} onChange={(event) => setTargetForm((current) => ({ ...current, revenueScore: event.target.value }))} />
              <Input placeholder="Authority" type="number" value={targetForm.authorityScore} onChange={(event) => setTargetForm((current) => ({ ...current, authorityScore: event.target.value }))} />
              <Input placeholder="Response" type="number" value={targetForm.responseProbabilityScore} onChange={(event) => setTargetForm((current) => ({ ...current, responseProbabilityScore: event.target.value }))} />
              <Input placeholder="Business audience" type="number" value={targetForm.businessAudienceScore} onChange={(event) => setTargetForm((current) => ({ ...current, businessAudienceScore: event.target.value }))} />
              <Input placeholder="Backlink" type="number" value={targetForm.backlinkScore} onChange={(event) => setTargetForm((current) => ({ ...current, backlinkScore: event.target.value }))} />
              <Input placeholder="Funding angle" type="number" value={targetForm.fundingAngleScore} onChange={(event) => setTargetForm((current) => ({ ...current, fundingAngleScore: event.target.value }))} />
              <Input placeholder="City priority" type="number" value={targetForm.cityPriorityScore} onChange={(event) => setTargetForm((current) => ({ ...current, cityPriorityScore: event.target.value }))} />
            </div>

            <Textarea placeholder="Notes, fit rationale, local context, or submission requirements" value={targetForm.notes} onChange={(event) => setTargetForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px]" />

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveTarget()} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingTargetId ? 'Save target' : 'Create target'}
              </Button>
              <Button variant="outline" onClick={resetTargetForm} disabled={isSaving}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Pipeline filters and run history</CardTitle>
            <CardDescription>Use filters to narrow the queue, then review what the automation did most recently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cityOptions.map((value) => <SelectItem key={value} value={value.split(', ')[0]}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {prTargetCategories.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {prTargetStatuses.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {latestRuns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">No PR runs yet.</div>
              ) : latestRuns.slice(0, 6).map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Target pipeline</CardTitle>
            <CardDescription>Daily city expansion and category discovery feed this queue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Fit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTargets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium text-white">{target.label}</div>
                      <div className="text-xs text-slate-400">
                        {[target.target_type.replaceAll('_', ' '), target.audience_type].filter(Boolean).join(' • ')}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{target.target_category.replaceAll('_', ' ')}</Badge></TableCell>
                    <TableCell>{[target.city, target.state].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell>{target.fit_score}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{target.status.replaceAll('_', ' ')}</Badge>
                        <Badge variant="outline">{target.priority}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingTargetId(target.id); setTargetForm(targetToForm(target)) }}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void generatePitch(target.id, target.angle_tags[0])}>
                          <Sparkles className="mr-2 h-3.5 w-3.5" />
                          Draft
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void patchTarget(target, { status: 'follow_up_due', nextFollowUpAt: isoToLocalInput(new Date().toISOString()) })}>
                          <Clock3 className="mr-2 h-3.5 w-3.5" />
                          Due
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Learning loop</CardTitle>
            <CardDescription>These are the latest structured takeaways from responses, wins, and ignored angles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningSnapshots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">No learning snapshots yet.</div>
            ) : learningSnapshots.slice(0, 8).map((snapshot) => (
              <LearningCard key={snapshot.id} snapshot={snapshot} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Pitch drafts</CardTitle>
            <CardDescription>Approve and send the strongest drafts first so the machine gets signal faster.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draft</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.drafts || []).map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell className="max-w-[320px]">
                      <div className="font-medium text-white">{draft.title}</div>
                      <div className="text-xs text-slate-400">{draft.target?.label || 'Unknown target'} • {draft.subject_line || 'No subject'}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{draft.status}</Badge></TableCell>
                    <TableCell>{draft.pitch_channel}</TableCell>
                    <TableCell>{formatRelativeTime(draft.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setDraftEditor(draftToEditor(draft)); setDraftDialogOpen(true) }}>Edit</Button>
                        {draft.status !== 'approved' ? <Button size="sm" variant="outline" onClick={() => void patchDraft({ id: draft.id, status: 'approved' })}>Approve</Button> : null}
                        <Button size="sm" onClick={() => void markDraftSent(draft)}>
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Mark sent
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Submission and follow-up queue</CardTitle>
            <CardDescription>High-fit overdue targets should move quickly, not disappear into admin debt.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next follow-up</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.outreach || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium text-white">{item.target?.label || 'Unknown target'}</div>
                      <div className="text-xs text-slate-400">{item.subject || item.outcome || 'No note yet'}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                    <TableCell>{formatRelativeTime(item.next_follow_up_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void patchOutreach(item.id, { status: 'waiting', nextFollowUpAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() })}>
                          <Clock3 className="mr-2 h-3.5 w-3.5" />
                          Follow up
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void patchOutreach(item.id, { status: 'won', respondedAt: new Date().toISOString(), outcome: 'Accepted / featured' })}>
                          <Trophy className="mr-2 h-3.5 w-3.5" />
                          Win
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent className="max-w-4xl border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit pitch draft</DialogTitle>
            <DialogDescription>Keep it concise, useful, and easy to say yes to.</DialogDescription>
          </DialogHeader>
          {draftEditor ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                Target: <span className="font-medium text-white">{draftEditor.targetLabel}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={draftEditor.title} onChange={(event) => setDraftEditor((current) => current ? { ...current, title: event.target.value } : current)} placeholder="Draft title" />
                <Select value={draftEditor.status} onValueChange={(value) => setDraftEditor((current) => current ? { ...current, status: value as DraftEditorState['status'] } : current)}>
                  <SelectTrigger><SelectValue placeholder="Draft status" /></SelectTrigger>
                  <SelectContent>{prDraftStatuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input value={draftEditor.subjectLine} onChange={(event) => setDraftEditor((current) => current ? { ...current, subjectLine: event.target.value } : current)} placeholder="Subject line" />
              <Input value={draftEditor.previewText} onChange={(event) => setDraftEditor((current) => current ? { ...current, previewText: event.target.value } : current)} placeholder="Preview text" />
              <Textarea value={draftEditor.bodyMarkdown} onChange={(event) => setDraftEditor((current) => current ? { ...current, bodyMarkdown: event.target.value } : current)} className="min-h-[260px]" />
              <Textarea value={draftEditor.founderBio} onChange={(event) => setDraftEditor((current) => current ? { ...current, founderBio: event.target.value } : current)} className="min-h-[90px]" placeholder="Founder bio" />
              <Input value={draftEditor.keyPoints} onChange={(event) => setDraftEditor((current) => current ? { ...current, keyPoints: event.target.value } : current)} placeholder="Key points, comma separated" />
              <Input value={draftEditor.callToAction} onChange={(event) => setDraftEditor((current) => current ? { ...current, callToAction: event.target.value } : current)} placeholder="Call to action" />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftDialogOpen(false)}>Close</Button>
            <Button onClick={() => { if (draftEditor) void patchDraft(draftEditor) }} disabled={!draftEditor || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardHeader><CardTitle className="text-sm text-slate-300">{title}</CardTitle></CardHeader>
      <CardContent className="text-2xl text-white">{value}</CardContent>
    </Card>
  )
}

function RunCard({ run }: { run: PrRunRecord }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-white">{run.run_type.replaceAll('_', ' ')}</div>
          <div className="text-sm text-slate-400">
            {[run.city, run.state].filter(Boolean).join(', ') || 'Global'} • {formatRelativeTime(run.started_at)}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{run.status}</Badge>
          <Badge variant="secondary">{run.created_target_count} targets</Badge>
          <Badge variant="secondary">{run.created_draft_count} drafts</Badge>
        </div>
      </div>
    </div>
  )
}

function LearningCard({ snapshot }: { snapshot: PrLearningSnapshotRecord }) {
  const label =
    snapshot.snapshot_type === 'angle'
      ? snapshot.angle_key
      : snapshot.snapshot_type === 'category'
        ? snapshot.target_category?.replaceAll('_', ' ')
        : snapshot.snapshot_type === 'city'
          ? [snapshot.city, snapshot.state].filter(Boolean).join(', ')
          : 'Operator note'

  const metrics = snapshot.metrics_json || {}

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-white">{label || 'Learning snapshot'}</div>
          <div className="text-sm text-slate-400">{snapshot.snapshot_type.replaceAll('_', ' ')}</div>
        </div>
        <Badge variant="outline">{formatRelativeTime(snapshot.created_at)}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {Object.entries(metrics).slice(0, 4).map(([key, value]) => (
          <Badge key={key} variant="secondary">{key}: {String(value)}</Badge>
        ))}
      </div>
      {snapshot.recommendation ? (
        <p className="mt-3 text-sm text-slate-300">{snapshot.recommendation}</p>
      ) : null}
    </div>
  )
}
