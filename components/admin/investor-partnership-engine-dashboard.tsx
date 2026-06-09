"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Handshake,
  Loader2,
  Mail,
  MessageSquareReply,
  PhoneCall,
  RefreshCw,
  Send,
  Target,
  Upload,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  investorOutreachStatuses,
  investorRelationshipStages,
  investorTypes,
  phaseOneMarkets,
  type InvestorDashboardSummary,
  type InvestorOutreachStatus,
  type InvestorProfileRecord,
  type InvestorRelationshipStage,
  type InvestorType,
} from '@/lib/investors/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type SequenceFilter = 'all' | 'A' | 'B' | 'C' | 'D'

type ApiResult = {
  investors: InvestorProfileRecord[]
  summary: InvestorDashboardSummary
}

const TYPE_OPTIONS: Array<{ value: InvestorType | 'all'; label: string }> = [
  { value: 'all', label: 'All investor types' },
  ...investorTypes.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const STAGE_OPTIONS: Array<{ value: InvestorRelationshipStage | 'all'; label: string }> = [
  { value: 'all', label: 'All stages' },
  ...investorRelationshipStages.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const OUTREACH_OPTIONS: Array<{ value: InvestorOutreachStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All outreach' },
  ...investorOutreachStatuses.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const SEQUENCE_OPTIONS: Array<{ value: SequenceFilter; label: string }> = [
  { value: 'all', label: 'All sequences' },
  { value: 'A', label: 'A Deal Flow' },
  { value: 'B', label: 'B Disposition' },
  { value: 'C', label: 'C Financing' },
  { value: 'D', label: 'D Strategic' },
]

const discoverySources = [
  'Recent flip transactions',
  'County deed records',
  'LLC ownership records',
  'DealMachine exports',
  'Public property sales',
  'LinkedIn',
  'Facebook investor groups',
  'Local REIA directories',
  'Public foreclosure buyers',
]

function sequenceLabel(code: string) {
  if (code === 'A') return 'Deal Flow'
  if (code === 'B') return 'Disposition'
  if (code === 'C') return 'Financing'
  return 'Strategic'
}

function scoreTone(score: number) {
  if (score >= 80) return 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30'
  if (score >= 60) return 'bg-cyan-400/15 text-cyan-200 border-cyan-400/30'
  if (score >= 40) return 'bg-amber-400/15 text-amber-200 border-amber-400/30'
  return 'bg-slate-700 text-slate-200 border-slate-600'
}

export function InvestorPartnershipEngineDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [investors, setInvestors] = useState<InvestorProfileRecord[]>([])
  const [summary, setSummary] = useState<InvestorDashboardSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [market, setMarket] = useState<string>('all')
  const [investorType, setInvestorType] = useState<InvestorType | 'all'>('all')
  const [relationshipStage, setRelationshipStage] = useState<InvestorRelationshipStage | 'all'>('all')
  const [outreachStatus, setOutreachStatus] = useState<InvestorOutreachStatus | 'all'>('all')
  const [sequence, setSequence] = useState<SequenceFilter>('all')
  const [agentInvestorId, setAgentInvestorId] = useState<string>('')
  const [agentMessage, setAgentMessage] = useState('')

  const fetchInvestors = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace('/login?redirect=/admin/investor-partnerships')
        return
      }

      const params = new URLSearchParams({ page: '1', limit: '200' })
      if (search) params.set('search', search)
      if (market !== 'all') params.set('market', market)
      if (investorType !== 'all') params.set('investor_type', investorType)
      if (relationshipStage !== 'all') params.set('relationship_stage', relationshipStage)
      if (outreachStatus !== 'all') params.set('outreach_status', outreachStatus)
      if (sequence !== 'all') params.set('sequence', sequence)

      const response = await fetch(`/api/admin/investor-partnerships?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ApiResult> & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Failed to load investors.')

      setInvestors(data.investors || [])
      setSummary(data.summary || null)
      setSelectedIds([])
      if (!agentInvestorId && data.investors?.[0]?.id) setAgentInvestorId(data.investors[0].id)
    } catch (error) {
      toast({
        title: 'Unable to load investor engine',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [agentInvestorId, investorType, market, outreachStatus, relationshipStage, router, search, sequence, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/investor-partnerships')
      return
    }
    if (isAuthenticated) {
      const timer = window.setTimeout(() => void fetchInvestors(), 0)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [authLoading, fetchInvestors, isAuthenticated, router])

  const allSelected = investors.length > 0 && selectedIds.length === investors.length
  const selectedInvestor = useMemo(
    () => investors.find((investor) => investor.id === agentInvestorId) || investors[0],
    [agentInvestorId, investors]
  )

  const toggleSelect = (investorId: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, investorId])) : current.filter((id) => id !== investorId)))
  }

  const runBulkAction = async (action: string) => {
    if (!selectedIds.length) {
      toast({ title: 'Select investors first', description: 'Choose profiles before running a batch action.' })
      return
    }

    setBulkLoading(action)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/investor-partnerships/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ investorIds: selectedIds, action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Bulk action failed.')

      toast({ title: 'Investor batch updated', description: `${selectedIds.length} profiles processed.` })
      await fetchInvestors()
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

  const routeFollowUp = async () => {
    const investorId = selectedInvestor?.id
    if (!investorId || !agentMessage.trim()) {
      toast({ title: 'Reply needed', description: 'Choose an investor and paste the reply to route.' })
      return
    }

    setAgentLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/admin/investor-partnerships/follow-up-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ investorId, inboundMessage: agentMessage }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Follow-up agent failed.')

      toast({ title: 'Follow-up routed', description: `${data.tasksCreated || 0} task(s) created.` })
      setAgentMessage('')
      await fetchInvestors()
    } catch (error) {
      toast({
        title: 'Agent routing failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setAgentLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading investor partnership engine...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Target} label="Investor Profiles" value={summary?.total || 0} detail={`${summary?.averageScore || 0}/100 avg score`} />
        <MetricCard icon={Building2} label="Active Buyers" value={summary?.activeBuyers || 0} detail={`${summary?.outreachReady || 0} outreach ready`} />
        <MetricCard icon={Banknote} label="Active Borrowers" value={summary?.activeBorrowers || 0} detail={`${summary?.lendingOpportunities || 0} lending opps`} />
        <MetricCard icon={Handshake} label="Revenue Opportunities" value={summary?.revenueOpportunities || 0} detail={`${summary?.partnershipOpportunities || 0} partnerships`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Market Discovery Console</CardTitle>
                <p className="mt-1 text-sm text-slate-400">Phase-one markets, source coverage, scoring, and outreach readiness.</p>
              </div>
              <Button variant="outline" onClick={() => fetchInvestors()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-5">
              {phaseOneMarkets.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMarket((current) => (current === item ? 'all' : item))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    market === item ? 'border-cyan-400/50 bg-cyan-400/10 text-white' : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, LLC, email" className="border-slate-700 bg-slate-950 md:col-span-2" />
              <Select value={investorType} onValueChange={(value) => setInvestorType(value as InvestorType | 'all')}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={relationshipStage} onValueChange={(value) => setRelationshipStage(value as InvestorRelationshipStage | 'all')}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={outreachStatus} onValueChange={(value) => setOutreachStatus(value as InvestorOutreachStatus | 'all')}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTREACH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sequence} onValueChange={(value) => setSequence(value as SequenceFilter)}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEQUENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => fetchInvestors()} variant="secondary">
                Apply Filters
              </Button>
              <Button onClick={() => runBulkAction('generate_outreach')} disabled={bulkLoading !== null}>
                {bulkLoading === 'generate_outreach' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Draft Outreach
              </Button>
              <Button onClick={() => runBulkAction('approve_outreach')} disabled={bulkLoading !== null} variant="outline">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button onClick={() => runBulkAction('queue_outreach')} disabled={bulkLoading !== null} variant="outline">
                <Send className="mr-2 h-4 w-4" />
                Queue
              </Button>
              <Button onClick={() => runBulkAction('mark_sent')} disabled={bulkLoading !== null} variant="outline">
                <PhoneCall className="mr-2 h-4 w-4" />
                Mark Sent
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 hover:bg-slate-950">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => setSelectedIds(checked ? investors.map((investor) => investor.id) : [])}
                        aria-label="Select all investor profiles"
                      />
                    </TableHead>
                    <TableHead>Investor</TableHead>
                    <TableHead>Markets</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Sequence</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investors.map((investor) => (
                    <TableRow key={investor.id} className="border-slate-800 hover:bg-slate-900/80">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(investor.id)}
                          onCheckedChange={(checked) => toggleSelect(investor.id, Boolean(checked))}
                          aria-label={`Select ${investor.display_name}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-64">
                        <div className="font-medium text-white">{investor.display_name}</div>
                        <div className="mt-1 text-xs text-slate-400">{investor.llc_name || investor.company_name || investor.contact_email || 'Contact research needed'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-60 flex-wrap gap-1">
                          {(investor.markets || []).slice(0, 3).map((item) => (
                            <Badge key={item} variant="secondary" className="bg-slate-800 text-slate-200">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize text-slate-300">{investor.primary_investor_type.replaceAll('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">{investor.assigned_sequence} {sequenceLabel(investor.assigned_sequence)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={scoreTone(investor.partnership_score)}>{investor.partnership_score}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="text-slate-200">{investor.relationship_stage.replaceAll('_', ' ')}</div>
                          <div className="text-slate-500">{investor.outreach_status.replaceAll('_', ' ')}</div>
                          <div className="text-slate-500">
                            {investor.updated_at ? formatDistanceToNow(new Date(investor.updated_at), { addSuffix: true }) : ''}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!investors.length ? (
                    <TableRow className="border-slate-800">
                      <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                        No investor profiles match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">AI Follow-Up Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedInvestor?.id || ''} onValueChange={setAgentInvestorId}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue placeholder="Choose investor" />
                </SelectTrigger>
                <SelectContent>
                  {investors.map((investor) => (
                    <SelectItem key={investor.id} value={investor.id}>
                      {investor.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={agentMessage}
                onChange={(event) => setAgentMessage(event.target.value)}
                placeholder="Paste investor reply here"
                className="min-h-32 border-slate-700 bg-slate-950"
              />
              <Button onClick={routeFollowUp} disabled={agentLoading} className="w-full">
                {agentLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareReply className="mr-2 h-4 w-4" />}
                Route Reply
              </Button>
              <p className="text-xs text-slate-500">Creates DealVault tasks for buy box, lending, disposition, deal routing, or call booking.</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">Discovery Sources</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {discoverySources.map((source) => (
                <div key={source} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                  <Upload className="h-4 w-4 text-cyan-300" />
                  {source}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">Opportunity Dashboards</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <OpportunityRow label="Active Sellers" value={summary?.activeSellers || 0} />
              <OpportunityRow label="Replies" value={summary?.replies || 0} />
              <OpportunityRow label="Calls Booked" value={summary?.callsBooked || 0} />
              <OpportunityRow label="Funding Closed" value={summary?.fundingClosed || 0} />
              <Button asChild variant="outline" className="mt-2">
                <Link href="/admin/dealvault">
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Open DealVault
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: number; detail: string }) {
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

function OpportunityRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <span className="text-slate-300">{label}</span>
      <span className="font-semibold text-white">{value.toLocaleString()}</span>
    </div>
  )
}
