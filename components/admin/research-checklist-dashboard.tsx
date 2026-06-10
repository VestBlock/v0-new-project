"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  researchChecklistKeys,
  researchEntityTypes,
  researchOutreachStatuses,
  researchRecommendedLanes,
  type ResearchChecklistKey,
  type ResearchChecklistRecord,
  type ResearchChecklistSummary,
  type ResearchEntityType,
  type ResearchOutreachStatus,
  type ResearchRecommendedLane,
} from '@/lib/osint/types'

type ApiResult = {
  checklists: ResearchChecklistRecord[]
  summary: ResearchChecklistSummary
}

type DraftState = {
  id?: string
  entityType: ResearchEntityType
  propertyAddress: string
  city: string
  state: string
  zipCode: string
  ownerName: string
  companyName: string
  contactEmail: string
  contactPhone: string
  website: string
  recommendedLane: ResearchRecommendedLane | 'none'
  outreachStatus: ResearchOutreachStatus
  researchSummary: string
  nextAction: string
  assignedOwner: string
  followUpAt: string
  checklist: Record<ResearchChecklistKey, boolean>
  sourceLinksText: string
  riskFlagsText: string
  opportunityFlagsText: string
}

const CHECKLIST_LABELS: Record<ResearchChecklistKey, string> = {
  propertyVerified: 'Property verified',
  ownerEntityVerified: 'Owner/entity verified',
  contactQualityReviewed: 'Contact quality reviewed',
  sourceLinksAttached: 'Source links attached',
  fitCriteriaReviewed: 'Fit criteria reviewed',
  mapConditionReviewed: 'Map/condition reviewed',
  riskReviewed: 'Risk reviewed',
  nextActionSelected: 'Next action selected',
}

const ENTITY_OPTIONS = [
  { value: 'all', label: 'All entity types' },
  ...researchEntityTypes.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const LANE_OPTIONS = [
  { value: 'all', label: 'All lanes' },
  ...researchRecommendedLanes.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...researchOutreachStatuses.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

function blankChecklist() {
  return researchChecklistKeys.reduce(
    (acc, key) => {
      acc[key] = false
      return acc
    },
    {} as Record<ResearchChecklistKey, boolean>
  )
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null
}

function flagsToText(flags: ResearchChecklistRecord['risk_flags_json']) {
  return (flags || []).map((flag) => [flag.severity || 'info', flag.label, flag.notes || ''].join(' | ')).join('\n')
}

function sourceLinksToText(links: ResearchChecklistRecord['source_links_json']) {
  return (links || []).map((link) => [link.label || '', link.url, link.notes || ''].join(' | ')).join('\n')
}

function parseSourceLinks(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url, notes] = line.split('|').map((part) => part.trim())
      return line.includes('|')
        ? { label: label || null, url: url || label, notes: notes || null }
        : { label: null, url: line, notes: null }
    })
    .filter((link) => link.url)
}

function parseFlags(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first, second, third] = line.split('|').map((part) => part.trim())
      const severity = ['low', 'medium', 'high', 'info'].includes(first) ? (first as 'low' | 'medium' | 'high' | 'info') : 'info'
      return line.includes('|')
        ? { severity, label: second || first, notes: third || null }
        : { severity: 'info' as const, label: line, notes: null }
    })
}

function draftFromRecord(record?: ResearchChecklistRecord | null): DraftState {
  const checklist = blankChecklist()
  if (record?.checklist_json) {
    for (const key of researchChecklistKeys) checklist[key] = Boolean(record.checklist_json[key])
  }

  return {
    id: record?.id,
    entityType: record?.entity_type || 'property',
    propertyAddress: record?.property_address || '',
    city: record?.city || '',
    state: record?.state || '',
    zipCode: record?.zip_code || '',
    ownerName: record?.owner_name || '',
    companyName: record?.company_name || '',
    contactEmail: record?.contact_email || '',
    contactPhone: record?.contact_phone || '',
    website: record?.website || '',
    recommendedLane: record?.recommended_lane || 'none',
    outreachStatus: record?.outreach_status || 'not_ready',
    researchSummary: record?.research_summary || '',
    nextAction: record?.next_action || '',
    assignedOwner: record?.assigned_owner || '',
    followUpAt: toDateTimeLocal(record?.follow_up_at),
    checklist,
    sourceLinksText: sourceLinksToText(record?.source_links_json || []),
    riskFlagsText: flagsToText(record?.risk_flags_json || []),
    opportunityFlagsText: flagsToText(record?.opportunity_flags_json || []),
  }
}

function scoreTone(score: number) {
  if (score >= 80) return 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30'
  if (score >= 60) return 'bg-cyan-400/15 text-cyan-200 border-cyan-400/30'
  if (score >= 40) return 'bg-amber-400/15 text-amber-200 border-amber-400/30'
  return 'bg-slate-700 text-slate-200 border-slate-600'
}

export function ResearchChecklistDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [checklists, setChecklists] = useState<ResearchChecklistRecord[]>([])
  const [summary, setSummary] = useState<ResearchChecklistSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [draft, setDraft] = useState<DraftState>(() => draftFromRecord(null))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState<string>('all')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [recommendedLane, setRecommendedLane] = useState<string>('all')
  const [outreachStatus, setOutreachStatus] = useState<string>('all')
  const [minConfidence, setMinConfidence] = useState('')

  const selectedRecord = useMemo(() => checklists.find((item) => item.id === selectedId) || null, [checklists, selectedId])
  const allSelected = checklists.length > 0 && selectedIds.length === checklists.length

  const fetchChecklists = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace('/login?redirect=/admin/research-checklists')
        return
      }

      const params = new URLSearchParams({ page: '1', limit: '200' })
      if (search) params.set('search', search)
      if (entityType !== 'all') params.set('entity_type', entityType)
      if (city) params.set('city', city)
      if (state) params.set('state', state)
      if (recommendedLane !== 'all') params.set('recommended_lane', recommendedLane)
      if (outreachStatus !== 'all') params.set('outreach_status', outreachStatus)
      if (minConfidence) params.set('min_confidence', minConfidence)

      const response = await fetch(`/api/admin/research-checklists?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ApiResult> & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Failed to load research checklists.')

      const rows = data.checklists || []
      setChecklists(rows)
      setSummary(data.summary || null)
      setSelectedIds([])

      const nextSelected = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id || ''
      setSelectedId(nextSelected)
      setDraft(draftFromRecord(rows.find((row) => row.id === nextSelected) || null))
    } catch (error) {
      toast({
        title: 'Unable to load research checklists',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [city, entityType, minConfidence, outreachStatus, recommendedLane, router, search, selectedId, state, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/research-checklists')
      return
    }
    if (isAuthenticated) {
      const timer = window.setTimeout(() => void fetchChecklists(), 0)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [authLoading, fetchChecklists, isAuthenticated, router])

  const chooseRecord = (record: ResearchChecklistRecord) => {
    setSelectedId(record.id)
    setDraft(draftFromRecord(record))
  }

  const startNew = () => {
    setSelectedId('')
    setDraft(draftFromRecord(null))
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)))
  }

  const saveDraft = async () => {
    setIsSaving(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const payload = {
        id: draft.id,
        entityType: draft.entityType,
        propertyAddress: draft.propertyAddress,
        city: draft.city,
        state: draft.state,
        zipCode: draft.zipCode,
        ownerName: draft.ownerName,
        companyName: draft.companyName,
        contactEmail: draft.contactEmail,
        contactPhone: draft.contactPhone,
        website: draft.website,
        recommendedLane: draft.recommendedLane === 'none' ? null : draft.recommendedLane,
        outreachStatus: draft.outreachStatus,
        researchSummary: draft.researchSummary,
        nextAction: draft.nextAction,
        assignedOwner: draft.assignedOwner,
        followUpAt: fromDateTimeLocal(draft.followUpAt),
        checklist: draft.checklist,
        sourceLinks: parseSourceLinks(draft.sourceLinksText),
        riskFlags: parseFlags(draft.riskFlagsText),
        opportunityFlags: parseFlags(draft.opportunityFlagsText),
      }

      const response = await fetch('/api/admin/research-checklists', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to save checklist.')

      toast({ title: 'Research checklist saved', description: 'Internal diligence record updated.' })
      setSelectedId(data.checklist?.id || selectedId)
      await fetchChecklists()
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const runBulkAction = async (action: 'needs_review' | 'ready' | 'approved' | 'do_not_contact' | 'assign_owner') => {
    if (!selectedIds.length) {
      toast({ title: 'Select records first', description: 'Choose checklist rows before running a batch action.' })
      return
    }

    const assignedOwner = action === 'assign_owner' ? window.prompt('Assign owner') || '' : ''
    if (action === 'assign_owner' && !assignedOwner.trim()) return

    setBulkLoading(action)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/research-checklists/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ checklistIds: selectedIds, action, assignedOwner }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Bulk action failed.')

      toast({ title: 'Batch updated', description: `${selectedIds.length} checklist records processed.` })
      await fetchChecklists()
    } catch (error) {
      toast({
        title: 'Bulk action failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setBulkLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading research checklist...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={ClipboardCheck} label="Total" value={summary?.total || 0} detail="Internal records" />
        <MetricCard icon={CheckCircle2} label="Ready" value={summary?.readyForOutreach || 0} detail="Ready or approved" />
        <MetricCard icon={AlertTriangle} label="Needs Review" value={summary?.needsReview || 0} detail="Not ready or review" />
        <MetricCard icon={ShieldCheck} label="Do Not Contact" value={summary?.doNotContact || 0} detail="Suppressed records" />
        <MetricCard icon={Search} label="Avg Confidence" value={summary?.averageConfidence || 0} detail="Out of 100" />
        <MetricCard icon={UserCheck} label="Follow-Ups Due" value={summary?.followUpsDue || 0} detail="Due now or earlier" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_.95fr]">
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Opportunity Diligence Queue</CardTitle>
                <p className="mt-1 text-sm text-slate-400">Internal review before outreach, routing, or partner follow-up.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => fetchChecklists()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button onClick={startNew}>New Checklist</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search property, owner, email" className="border-slate-700 bg-slate-950 md:col-span-2" />
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className="border-slate-700 bg-slate-950" />
              <Input value={state} onChange={(event) => setState(event.target.value)} placeholder="State" className="border-slate-700 bg-slate-950" />
              <Select value={recommendedLane} onValueChange={setRecommendedLane}>
                <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={outreachStatus} onValueChange={setOutreachStatus}>
                <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={minConfidence} onChange={(event) => setMinConfidence(event.target.value)} placeholder="Min confidence" className="w-40 border-slate-700 bg-slate-950" />
              <Button onClick={() => fetchChecklists()} variant="secondary">Apply Filters</Button>
              <Button onClick={() => runBulkAction('needs_review')} disabled={bulkLoading !== null} variant="outline">Needs Review</Button>
              <Button onClick={() => runBulkAction('ready')} disabled={bulkLoading !== null} variant="outline">Mark Ready</Button>
              <Button onClick={() => runBulkAction('approved')} disabled={bulkLoading !== null} variant="outline">Approve</Button>
              <Button onClick={() => runBulkAction('assign_owner')} disabled={bulkLoading !== null} variant="outline">Assign Owner</Button>
              <Button onClick={() => runBulkAction('do_not_contact')} disabled={bulkLoading !== null} variant="outline">Do Not Contact</Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 hover:bg-slate-950">
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelectedIds(checked ? checklists.map((item) => item.id) : [])} aria-label="Select all checklist records" />
                    </TableHead>
                    <TableHead>Property / Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Lane</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklists.map((item) => (
                    <TableRow key={item.id} className={`border-slate-800 hover:bg-slate-900/80 ${selectedId === item.id ? 'bg-cyan-950/20' : ''}`}>
                      <TableCell>
                        <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={(checked) => toggleSelect(item.id, Boolean(checked))} aria-label={`Select ${item.property_address || item.owner_name || item.company_name || item.id}`} />
                      </TableCell>
                      <TableCell className="min-w-64">
                        <button type="button" className="text-left" onClick={() => chooseRecord(item)}>
                          <div className="font-medium text-white">{item.property_address || item.company_name || item.owner_name || 'Untitled record'}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.contact_email || item.contact_phone || item.website || item.next_action || 'No contact channel yet'}</div>
                        </button>
                      </TableCell>
                      <TableCell className="capitalize text-slate-300">{item.entity_type.replaceAll('_', ' ')}</TableCell>
                      <TableCell className="text-slate-300">{[item.city, item.state].filter(Boolean).join(', ') || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{(item.recommended_lane || 'none').replaceAll('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="capitalize text-slate-300">{item.outreach_status.replaceAll('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge className={scoreTone(item.confidence_score)}>{item.confidence_score}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.updated_at ? formatDistanceToNow(new Date(item.updated_at), { addSuffix: true }) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!checklists.length ? (
                    <TableRow className="border-slate-800">
                      <TableCell colSpan={8} className="py-8 text-center text-slate-400">
                        No research checklists match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle className="text-lg">{selectedRecord ? 'Checklist Detail' : 'New Checklist'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Property address" value={draft.propertyAddress} onChange={(value) => setDraft((current) => ({ ...current, propertyAddress: value }))} />
              <Field label="Owner name" value={draft.ownerName} onChange={(value) => setDraft((current) => ({ ...current, ownerName: value }))} />
              <Field label="Company/entity" value={draft.companyName} onChange={(value) => setDraft((current) => ({ ...current, companyName: value }))} />
              <Field label="Email" value={draft.contactEmail} onChange={(value) => setDraft((current) => ({ ...current, contactEmail: value }))} />
              <Field label="Phone" value={draft.contactPhone} onChange={(value) => setDraft((current) => ({ ...current, contactPhone: value }))} />
              <Field label="Website" value={draft.website} onChange={(value) => setDraft((current) => ({ ...current, website: value }))} />
              <Field label="City" value={draft.city} onChange={(value) => setDraft((current) => ({ ...current, city: value }))} />
              <Field label="State" value={draft.state} onChange={(value) => setDraft((current) => ({ ...current, state: value }))} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Entity type</Label>
                <Select value={draft.entityType} onValueChange={(value) => setDraft((current) => ({ ...current, entityType: value as ResearchEntityType }))}>
                  <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {researchEntityTypes.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recommended lane</Label>
                <Select value={draft.recommendedLane} onValueChange={(value) => setDraft((current) => ({ ...current, recommendedLane: value as ResearchRecommendedLane | 'none' }))}>
                  <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lane selected</SelectItem>
                    {researchRecommendedLanes.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Outreach status</Label>
                <Select value={draft.outreachStatus} onValueChange={(value) => setDraft((current) => ({ ...current, outreachStatus: value as ResearchOutreachStatus }))}>
                  <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {researchOutreachStatuses.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Assigned owner" value={draft.assignedOwner} onChange={(value) => setDraft((current) => ({ ...current, assignedOwner: value }))} />
              <Field label="Follow-up date" type="datetime-local" value={draft.followUpAt} onChange={(value) => setDraft((current) => ({ ...current, followUpAt: value }))} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {researchChecklistKeys.map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                  <Checkbox
                    checked={draft.checklist[key]}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        checklist: { ...current.checklist, [key]: Boolean(checked) },
                      }))
                    }
                  />
                  {CHECKLIST_LABELS[key]}
                </label>
              ))}
            </div>

            <Textarea value={draft.researchSummary} onChange={(event) => setDraft((current) => ({ ...current, researchSummary: event.target.value }))} placeholder="Research summary" className="min-h-24 border-slate-700 bg-slate-950" />
            <Textarea value={draft.nextAction} onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))} placeholder="Next action" className="min-h-20 border-slate-700 bg-slate-950" />
            <Textarea value={draft.sourceLinksText} onChange={(event) => setDraft((current) => ({ ...current, sourceLinksText: event.target.value }))} placeholder="Source links, one per line: label | url | notes" className="min-h-24 border-slate-700 bg-slate-950" />
            <Textarea value={draft.riskFlagsText} onChange={(event) => setDraft((current) => ({ ...current, riskFlagsText: event.target.value }))} placeholder="Risk flags, one per line: severity | label | notes" className="min-h-20 border-slate-700 bg-slate-950" />
            <Textarea value={draft.opportunityFlagsText} onChange={(event) => setDraft((current) => ({ ...current, opportunityFlagsText: event.target.value }))} placeholder="Opportunity flags, one per line: severity | label | notes" className="min-h-20 border-slate-700 bg-slate-950" />

            <Button onClick={saveDraft} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              Save Research Checklist
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="border-slate-700 bg-slate-950" />
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof ClipboardCheck; label: string; value: number; detail: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-200">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}
