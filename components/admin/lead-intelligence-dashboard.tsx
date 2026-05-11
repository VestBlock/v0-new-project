"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Download, ExternalLink, Loader2, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { captureClientEvent } from '@/lib/analytics/client'
import { analyticsEvents } from '@/lib/analytics/events'
import { getSourceFamily } from '@/lib/leads/source-keys'
import type { LeadOutreachStatus, LeadRecord, LeadStatus } from '@/lib/leads/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

type LeadSummary = {
  total: number
  newToday: number
  outreachReady: number
  emailReady: number
  sent: number
  highIntent: number
  averageScore: number
  offers: Array<{ label: string; value: number }>
  failedScrapes: Array<{ source: string; startedAt: string; error: string | null }>
  emailBlockers: Array<{ reason: string; value: number }>
}

type BulkActionResult = {
  count?: number
  approvedMessages?: number
  skipped?: number
  generated?: number
  skippedReasons?: Record<string, number>
  error?: string
}

type LeadQueueRow = LeadRecord & {
  email_autopilot_eligible?: boolean | null
  email_autopilot_reason?: string | null
}

type EmailPriorityMode = 'all' | 'prioritize' | 'only'

const STATUS_OPTIONS: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'scored', label: 'Scored' },
  { value: 'outreach_ready', label: 'Outreach Ready' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
  { value: 'do_not_contact', label: 'Do Not Contact' },
]

const OUTREACH_OPTIONS: Array<{ value: LeadOutreachStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All outreach' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'followup_due', label: 'Follow-up Due' },
  { value: 'failed', label: 'Failed' },
]

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'apify_yelp_businesses', label: 'Apify Yelp' },
  { value: 'csv_import', label: 'CSV Imports' },
  { value: 'zillow_stale_listing_import', label: 'Zillow Stale Listings' },
  { value: 'failed_listing_import', label: 'Failed Listings' },
  { value: 'real_estate_listing_import', label: 'Real Estate Listing Imports' },
  { value: 'absentee_owner_import', label: 'Absentee Owners' },
  { value: 'tired_landlord_import', label: 'Tired Landlords' },
  { value: 'tax_delinquent_import', label: 'Tax Delinquent' },
  { value: 'probate_inherited_import', label: 'Probate / Inherited' },
  { value: 'vacant_distress_import', label: 'Vacant / Distress' },
  { value: 'preforeclosure_import', label: 'Preforeclosure' },
  { value: 'wisconsin_dfi_new_businesses', label: 'Wisconsin DFI' },
  { value: 'cincinnati_code_enforcement', label: 'Cincinnati Code Enforcement' },
  { value: 'milwaukee_accela_enforcement', label: 'Milwaukee Accela' },
  { value: 'google_places_businesses', label: 'Google Places' },
  { value: 'outscraper_google_maps_businesses', label: 'Outscraper Maps' },
  { value: 'sam_contract_opportunities', label: 'SAM.gov Matches' },
]

const DELIVERY_OPTIONS = [
  { value: 'all', label: 'All delivery' },
  { value: 'not_sent', label: 'Not Sent' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'replied', label: 'Replied' },
  { value: 'booked', label: 'Booked' },
  { value: 'failed', label: 'Failed' },
]

function scoreBand(score: number) {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  return 'D'
}

function formatLeadAddress(lead: LeadRecord) {
  const address = String(lead.property_address || '').trim()
  const location = [lead.city, lead.state].filter(Boolean).join(', ')
  if (!address) return location || null
  if (!location) return address
  return address.toLowerCase().includes(location.toLowerCase()) ? address : `${address}, ${location}`
}

function pickRecordString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function getLeadContactSnapshot(lead: LeadRecord) {
  const contact = lead.contact_info || {}
  const formData = lead.form_data || {}

  return {
    contactName:
      lead.name ||
      pickRecordString(contact, ['name', 'contactName', 'fullName']) ||
      pickRecordString(formData, ['contactName', 'name', 'fullName']),
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

function formatSourceLabel(source: string | null | undefined) {
  const family = getSourceFamily(source)

  switch (family) {
    case 'outscraper_google_maps_businesses':
      return 'Outscraper Maps'
    case 'google_places_businesses':
      return 'Google Places'
    case 'apify_yelp_businesses':
      return 'Apify Yelp'
    case 'cincinnati_code_enforcement':
      return 'Cincinnati Code'
    case 'milwaukee_accela_enforcement':
      return 'Milwaukee Accela'
    case 'wisconsin_dfi_new_businesses':
      return 'Wisconsin DFI'
    default:
      return family || 'Unknown source'
  }
}

function formatAutopilotReason(reason?: string | null) {
  switch (reason) {
    case 'eligible':
      return 'Auto-send eligible'
    case 'missing_email':
      return 'Missing email'
    case 'invalid_email':
      return 'Invalid email'
    case 'mismatched_domain':
      return 'Email/domain mismatch'
    case 'platform_email':
      return 'Platform email'
    case 'institutional_domain':
      return 'Institutional domain'
    case 'high_bounce_risk':
      return 'High bounce risk'
    case 'suppressed':
      return 'Suppressed'
    case 'legacy_google_places_paused':
      return 'Legacy source paused'
    case 'do_not_contact':
      return 'Do not contact'
    case 'auto_approval_disabled':
      return 'Auto-approval disabled'
    case 'below_min_score':
      return 'Below score floor'
    case 'non_primary_campaign':
      return 'Manual offer review'
    case 'missing_business_identity':
      return 'Missing business name'
    case 'weak_personalization_signal':
      return 'Needs better context'
    case 'unknown':
      return 'Unknown blocker'
    default:
      return reason ? reason.replaceAll('_', ' ') : 'Needs review'
  }
}

export function LeadIntelligenceDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const [leads, setLeads] = useState<LeadQueueRow[]>([])
  const [summary, setSummary] = useState<LeadSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRescoring, setIsRescoring] = useState(false)
  const [runningOutreachFor, setRunningOutreachFor] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [offer, setOffer] = useState('all')
  const [city, setCity] = useState('all')
  const [state, setState] = useState('all')
  const [language, setLanguage] = useState('all')
  const [niche, setNiche] = useState('all')
  const [status, setStatus] = useState('all')
  const [outreachStatus, setOutreachStatus] = useState('all')
  const [deliveryStatus, setDeliveryStatus] = useState('all')
  const [emailPriority, setEmailPriority] = useState<EmailPriorityMode>('only')
  const [contactableOnly, setContactableOnly] = useState(true)
  const [minScore, setMinScore] = useState('0')
  const [campaignName, setCampaignName] = useState('')

  const fetchLeads = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/login?redirect=/admin/leads')
        return
      }

      const params = new URLSearchParams({ page: '1', limit: '200' })
      if (search) params.set('search', search)
      if (source !== 'all') params.set('source', source)
      if (offer !== 'all') params.set('offer', offer)
      if (city !== 'all') params.set('city', city)
      if (state !== 'all') params.set('state', state)
      if (niche !== 'all') params.set('niche', niche)
      if (language !== 'all') params.set('language', language)
      if (status !== 'all') params.set('status', status)
      if (outreachStatus !== 'all') params.set('outreach_status', outreachStatus)
      if (deliveryStatus !== 'all') params.set('delivery_status', deliveryStatus)
      if (emailPriority !== 'all') params.set('email_priority', emailPriority)
      if (contactableOnly) params.set('contactable_only', '1')
      if (Number(minScore) > 0) params.set('min_score', minScore)

      const response = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Failed to load leads.')

      const data = await response.json()
      setLeads(data.leads || [])
      setSummary(data.summary || null)
      setSelectedIds([])
      captureClientEvent(analyticsEvents.adminLeadsLoaded, {
        result_count: (data.leads || []).length,
        source_family: source === 'all' ? 'all' : source,
        contactable_only: contactableOnly,
        email_priority: emailPriority,
        min_score: Number(minScore || 0),
      })
    } catch (error) {
      toast({
        title: 'Unable to load leads',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [city, contactableOnly, deliveryStatus, emailPriority, language, minScore, niche, offer, outreachStatus, router, search, source, state, status, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/leads')
      return
    }
    if (isAuthenticated) queueMicrotask(() => void fetchLeads())
  }, [authLoading, fetchLeads, isAuthenticated, router])

  const cityOptions = useMemo(() => ['all', ...Array.from(new Set(leads.map((lead) => lead.city).filter(Boolean)))], [leads])
  const stateOptions = useMemo(() => ['all', ...Array.from(new Set(leads.map((lead) => lead.state).filter(Boolean)))], [leads])
  const offerOptions = useMemo(() => ['all', ...Array.from(new Set(leads.map((lead) => lead.best_offer).filter(Boolean)))], [leads])
  const languageOptions = useMemo(() => ['all', ...Array.from(new Set(leads.map((lead) => lead.language_segment).filter(Boolean)))], [leads])
  const nicheOptions = useMemo(() => ['all', ...Array.from(new Set(leads.map((lead) => lead.niche).filter(Boolean)))], [leads])
  const allSelected = leads.length > 0 && selectedIds.length === leads.length

  const toggleSelect = (leadId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, leadId])) : current.filter((id) => id !== leadId)
    )
  }

  const updateLeadStatus = async (id: string, nextStatus: LeadStatus) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status: nextStatus }),
      })
      if (!response.ok) throw new Error('Status update failed.')
      await fetchLeads()
    } catch (error) {
      toast({
        title: 'Could not update lead',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    }
  }

  const generateOutreach = async (leadId: string) => {
    setRunningOutreachFor(leadId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/leads/generate-outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ leadIds: [leadId] }),
      })
      if (!response.ok) throw new Error('Outreach generation failed.')
      toast({ title: 'Outreach ready', description: 'Draft outreach regenerated for this lead.' })
      await fetchLeads()
    } catch (error) {
      toast({
        title: 'Could not generate outreach',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setRunningOutreachFor(null)
    }
  }

  const bulkAction = async (action: string, overrideIds?: string[]) => {
    const ids = overrideIds || selectedIds
    if (ids.length === 0) {
      toast({ title: 'Select leads first', description: 'Choose at least one lead to run this action.' })
      return
    }

    setBulkLoading(action)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/admin/leads/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ leadIds: ids, action, campaignName: campaignName || undefined }),
      })
      const data = await response.json().catch(() => ({} as BulkActionResult)) as BulkActionResult
      if (!response.ok) throw new Error(data.error || 'Bulk action failed.')

      const skipped = Number(data.skipped || 0)
      const approved = Number(data.approvedMessages || 0)
      const generated = Number(data.generated || 0)
      const updated = Number(data.count || 0)
      const topSkipReason = Object.entries(data.skippedReasons || {})
        .sort((left, right) => right[1] - left[1])
        .map(([reason, value]) => `${formatAutopilotReason(reason)} (${value})`)
        .at(0)

      toast({
        title: 'Bulk action complete',
        description:
          action === 'approve_outreach'
            ? `${approved} message${approved === 1 ? '' : 's'} approved. ${skipped} skipped by guardrails${topSkipReason ? `, top reason: ${topSkipReason}` : ''}.`
            : action === 'generate_outreach'
              ? `${generated || updated} draft${(generated || updated) === 1 ? '' : 's'} generated.`
              : `${updated || ids.length} lead${(updated || ids.length) === 1 ? '' : 's'} updated.`,
      })
      await fetchLeads()
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

  const rescoreLeads = async () => {
    setIsRescoring(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/leads/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rescoreAll: true }),
      })
      if (!response.ok) throw new Error('Rescore failed.')
      toast({ title: 'Lead scores refreshed' })
      await fetchLeads()
    } catch (error) {
      toast({
        title: 'Could not rescore leads',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setIsRescoring(false)
    }
  }

  const downloadCsv = async (params: URLSearchParams) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const response = await fetch(`/api/leads/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!response.ok) throw new Error('Export failed.')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vestblock-leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportCsv = async () => {
    const params = new URLSearchParams()
    if (source !== 'all') params.set('source', source)
    if (offer !== 'all') params.set('offer', offer)
    if (city !== 'all') params.set('city', city)
    if (state !== 'all') params.set('state', state)
    if (niche !== 'all') params.set('niche', niche)
    if (status !== 'all') params.set('status', status)
    if (outreachStatus !== 'all') params.set('outreachStatus', outreachStatus)
    if (deliveryStatus !== 'all') params.set('deliveryStatus', deliveryStatus)
    if (emailPriority === 'only') params.set('emailReady', '1')
    if (contactableOnly) params.set('contactableOnly', '1')
    if (Number(minScore) > 0) params.set('minScore', minScore)
    await downloadCsv(params)
  }

  const exportSelected = async () => {
    if (selectedIds.length === 0) return
    const params = new URLSearchParams()
    params.set('preset', 'selected')
    params.set('selectedIds', selectedIds.join(','))
    await downloadCsv(params)
  }

  const exportNoEmailBacklog = async () => {
    const params = new URLSearchParams()
    params.set('preset', 'no_email')
    if (source !== 'all') params.set('source', source)
    if (offer !== 'all') params.set('offer', offer)
    if (city !== 'all') params.set('city', city)
    if (state !== 'all') params.set('state', state)
    if (niche !== 'all') params.set('niche', niche)
    if (status !== 'all') params.set('status', status)
    if (outreachStatus !== 'all') params.set('outreachStatus', outreachStatus)
    if (deliveryStatus !== 'all') params.set('deliveryStatus', deliveryStatus)
    if (Number(minScore) > 0) params.set('minScore', minScore)
    await downloadCsv(params)
    toast({
      title: 'No-email backlog exported',
      description: 'Use this CSV as your offline Google Sheet for no-email lead research and cleanup.',
    })
  }

  const importCsv = async (file: File) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const formData = new FormData()
      formData.append('file', file)
      if (campaignName) formData.append('campaignName', campaignName)
      const response = await fetch('/api/admin/leads/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Import failed.')
      toast({
        title: 'CSV imported',
        description:
          data.importedSellerInventory > 0
            ? `Imported ${data.imported} leads, including ${data.importedSellerInventory} seller-inventory rows. Skipped ${data.skipped}.`
            : `Imported ${data.imported} leads. Skipped ${data.skipped}.`,
      })
      await fetchLeads()
    } catch (error) {
      toast({
        title: 'CSV import failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    }
  }

  const getEmailReadiness = (lead: LeadRecord) => {
    const email = typeof lead.email === 'string' ? lead.email.trim() : ''
    if (!email) return { ready: false, label: 'Needs email' }
    if (lead.email_valid === false) return { ready: false, label: 'Email unverified' }
    if (lead.delivery_status === 'bounced') return { ready: false, label: 'Email bounced' }
    if (lead.outreach_status === 'do_not_contact' || lead.status === 'do_not_contact') {
      return { ready: false, label: 'Do not contact' }
    }
    return { ready: true, label: 'Email ready' }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">New today</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{summary?.newToday || 0}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Email ready</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-emerald-300">{summary?.emailReady || 0}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Average score</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{summary?.averageScore || 0}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">High intent</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{summary?.highIntent || 0}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Needs review</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{summary?.outreachReady || 0}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Sent</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold text-white">{summary?.sent || 0}</div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Filters and actions</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={fetchLeads}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
              <Button variant="outline" onClick={rescoreLeads} disabled={isRescoring}>
                {isRescoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Rescore
              </Button>
              <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
              <Button variant="outline" onClick={exportNoEmailBacklog}>
                <Download className="mr-2 h-4 w-4" />
                Export no-email backlog
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/market-expansion">Markets</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lead" />
            <Select value={source} onValueChange={setSource}><SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger><SelectContent>{SOURCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Select value={offer} onValueChange={setOffer}><SelectTrigger><SelectValue placeholder="Offer" /></SelectTrigger><SelectContent>{offerOptions.map((option) => <SelectItem key={String(option)} value={String(option)}>{option === 'all' ? 'All offers' : String(option)}</SelectItem>)}</SelectContent></Select>
            <Select value={city} onValueChange={setCity}><SelectTrigger><SelectValue placeholder="City" /></SelectTrigger><SelectContent>{cityOptions.map((option) => <SelectItem key={String(option)} value={String(option)}>{option === 'all' ? 'All cities' : String(option)}</SelectItem>)}</SelectContent></Select>
            <Select value={state} onValueChange={setState}><SelectTrigger><SelectValue placeholder="State" /></SelectTrigger><SelectContent>{stateOptions.map((option) => <SelectItem key={String(option)} value={String(option)}>{option === 'all' ? 'All states' : String(option)}</SelectItem>)}</SelectContent></Select>
            <Select value={niche} onValueChange={setNiche}><SelectTrigger><SelectValue placeholder="Niche" /></SelectTrigger><SelectContent>{nicheOptions.map((option) => <SelectItem key={String(option)} value={String(option)}>{option === 'all' ? 'All niches' : String(option)}</SelectItem>)}</SelectContent></Select>
            <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger><SelectContent>{languageOptions.map((option) => <SelectItem key={String(option)} value={String(option)}>{option === 'all' ? 'All languages' : String(option)}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Select value={outreachStatus} onValueChange={setOutreachStatus}><SelectTrigger><SelectValue placeholder="Outreach" /></SelectTrigger><SelectContent>{OUTREACH_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Select value={deliveryStatus} onValueChange={setDeliveryStatus}><SelectTrigger><SelectValue placeholder="Delivery" /></SelectTrigger><SelectContent>{DELIVERY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Select value={emailPriority} onValueChange={(value) => setEmailPriority(value as EmailPriorityMode)}><SelectTrigger><SelectValue placeholder="Email queue" /></SelectTrigger><SelectContent><SelectItem value="prioritize">Email ready first</SelectItem><SelectItem value="only">Email ready only</SelectItem><SelectItem value="all">All leads</SelectItem></SelectContent></Select>
            <Input value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Min score" inputMode="numeric" />
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign name" />
            <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm text-slate-300">
              <Checkbox
                checked={contactableOnly}
                onCheckedChange={(checked) => setContactableOnly(Boolean(checked))}
              />
              Contactable only
            </label>
            <div className="md:col-span-5 flex flex-wrap gap-2">
              <Button onClick={fetchLeads}>Apply filters</Button>
              <Button variant="outline" onClick={() => bulkAction('generate_outreach')} disabled={Boolean(bulkLoading)}>
                {bulkLoading === 'generate_outreach' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Generate drafts
              </Button>
              <Button variant="outline" onClick={() => bulkAction('approve_outreach')} disabled={Boolean(bulkLoading)}>
                {bulkLoading === 'approve_outreach' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Approve outreach
              </Button>
              <Button variant="outline" onClick={() => bulkAction('mark_interested')} disabled={Boolean(bulkLoading)}>Mark interested</Button>
              <Button variant="outline" onClick={() => bulkAction('mark_do_not_contact')} disabled={Boolean(bulkLoading)}>Do not contact</Button>
              <Button variant="outline" onClick={() => bulkAction('pause')} disabled={Boolean(bulkLoading)}>Pause</Button>
              <Button variant="outline" onClick={() => bulkAction('assign_campaign')} disabled={Boolean(bulkLoading)}>Assign campaign</Button>
              <Button variant="outline" onClick={exportSelected}>Export selected</Button>
              <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void importCsv(file)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
            <p className="md:col-span-5 text-xs text-slate-500">
              The live queue now defaults to email-ready leads only. Use “Export no-email backlog” to move website-only and missing-email records into an offline research sheet instead of keeping them in the active send queue.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader><CardTitle className="text-white">Automation health</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="space-y-2">
              <div className="font-medium text-white">Top offers in queue</div>
              {(summary?.offers || []).map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span>{item.label}</span>
                  <Badge variant="secondary">{item.value}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-white">Email blocker reasons</div>
              {summary?.emailBlockers?.length ? summary.emailBlockers.map((item) => (
                <div key={item.reason} className="flex items-center justify-between">
                  <span>{formatAutopilotReason(item.reason)}</span>
                  <Badge variant={item.reason === 'eligible' ? 'default' : 'secondary'}>{item.value}</Badge>
                </div>
              )) : <div className="text-slate-500">No blocker diagnostics yet.</div>}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-white">Recent scrape failures</div>
              {summary?.failedScrapes?.length ? summary.failedScrapes.map((run) => (
                <div key={`${run.source}-${run.startedAt}`} className="rounded border border-slate-800 p-3">
                  <div className="font-medium text-white">{run.source}</div>
                  <div className="text-xs text-slate-500">{run.startedAt ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true }) : 'Unknown time'}</div>
                  <div className="mt-1 text-xs text-rose-300">{run.error || 'Unknown failure'}</div>
                </div>
              )) : <div className="text-slate-500">No recent scrape failures.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Lead queue</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-12 text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading leads...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? leads.map((lead) => lead.id) : [])
                        }
                      />
                    </TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Niche</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Outreach</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const emailReadiness = getEmailReadiness(lead)
                    const leadAddress = formatLeadAddress(lead)
                    const contactSnapshot = getLeadContactSnapshot(lead)
                    const autopilotReason = formatAutopilotReason(lead.email_autopilot_reason)
                    return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(lead.id)}
                          onCheckedChange={(checked) => toggleSelect(lead.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">{lead.business_name || lead.name || 'Unnamed lead'}</div>
                          <div className="text-xs text-slate-400">
                            {contactSnapshot.contactName && contactSnapshot.contactName !== (lead.business_name || lead.name)
                              ? `Contact: ${contactSnapshot.contactName}`
                              : leadAddress || 'No direct contact yet'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {[contactSnapshot.email, contactSnapshot.phone].filter(Boolean).join(' · ') || 'No email or phone yet'}
                          </div>
                          {contactSnapshot.website ? (
                            <div className="text-xs text-slate-500">{contactSnapshot.website}</div>
                          ) : null}
                          <div className="text-xs text-slate-500">{formatSourceLabel(lead.source)}</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className={emailReadiness.ready ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-300'}>
                              {emailReadiness.label}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={
                                lead.email_autopilot_eligible
                                  ? 'bg-cyan-500/15 text-cyan-200'
                                  : 'bg-amber-500/15 text-amber-200'
                              }
                            >
                              {autopilotReason}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500">
                            {lead.created_at ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }) : 'Unknown time'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-200">{[lead.city, lead.state].filter(Boolean).join(', ') || '-'}</div>
                        <div className="text-xs text-slate-500">{lead.language_segment || lead.language_signal || lead.market_segment || lead.category || lead.lead_type}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{lead.best_offer || 'Unassigned'}</Badge></TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-200">{lead.niche || '-'}</div>
                        <div className="text-xs text-slate-500">{lead.campaign_name || 'No campaign'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-cyan-300">{lead.lead_score || 0}</div>
                        <div className="text-xs text-slate-500">Band {scoreBand(Number(lead.lead_score || 0))}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-200">{lead.outreach_status || 'not_started'}</div>
                        <div className="text-xs text-slate-500">{lead.outreach_angle || 'General follow-up'}</div>
                        <div className="text-xs text-slate-500">{lead.delivery_status || 'not_sent'}</div>
                      </TableCell>
                      <TableCell>
                        <Select value={lead.status} onValueChange={(value) => updateLeadStatus(lead.id, value as LeadStatus)}>
                          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/leads/${lead.id}`}>View</Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => generateOutreach(lead.id)} disabled={runningOutreachFor === lead.id}>
                            {runningOutreachFor === lead.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Draft
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => bulkAction('approve_outreach', [lead.id])}
                            disabled={Boolean(bulkLoading) || !lead.email_autopilot_eligible}
                            title={
                              lead.email_autopilot_eligible
                                ? 'Approve this safe email draft'
                                : `Blocked: ${autopilotReason}`
                            }
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Approve safe
                          </Button>
                          {lead.source_url ? (
                            <Button asChild size="sm" variant="ghost">
                              <a href={lead.source_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Source
                              </a>
                            </Button>
                          ) : null}
                          {lead.outreach_status === 'approved' ? (
                            <Button asChild size="sm">
                              <Link href={`/admin/leads/${lead.id}`}>
                                <Send className="mr-2 h-4 w-4" />
                                Send
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
