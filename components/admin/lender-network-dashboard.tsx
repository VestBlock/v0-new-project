"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Building2, Globe2, Loader2, Mail, RefreshCw, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/lenders/constants'
import { lenderCategories, lenderOutreachStatuses, lenderRelationshipStages, lenderTypes } from '@/lib/lenders/types'
import type { LenderOutreachStatus, LenderRecord, LenderRelationshipStage, LenderType } from '@/lib/lenders/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

type LenderSummary = {
  total: number
  emailReady: number
  outreachReady: number
  activePartners: number
  responded: number
  spanishReady: number
  averageConfidence: number
  categories: Array<{ label: string; value: number }>
}

type EmailPriorityMode = 'all' | 'prioritize' | 'only'

const TYPE_OPTIONS: Array<{ value: LenderType | 'all'; label: string }> = [
  { value: 'all', label: 'All lender types' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'business', label: 'Business' },
  { value: 'personal', label: 'Personal' },
  { value: 'specialty', label: 'Specialty / Community' },
]

const STAGE_OPTIONS: Array<{ value: LenderRelationshipStage | 'all'; label: string }> = [
  { value: 'all', label: 'All relationship stages' },
  ...lenderRelationshipStages.map((value) => ({
    value,
    label: value.replaceAll('_', ' '),
  })),
]

const OUTREACH_OPTIONS: Array<{ value: LenderOutreachStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All outreach' },
  ...lenderOutreachStatuses.map((value) => ({
    value,
    label: value.replaceAll('_', ' '),
  })),
]

function hasUsableEmail(lender: LenderRecord) {
  const email = lender.contact_email?.trim()
  if (!email) return false
  return lender.outreach_status !== 'do_not_contact' && lender.relationship_stage !== 'not_a_fit'
}

export function LenderNetworkDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [lenders, setLenders] = useState<LenderRecord[]>([])
  const [summary, setSummary] = useState<LenderSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [lenderType, setLenderType] = useState<LenderType | 'all'>('all')
  const [category, setCategory] = useState<string>('all')
  const [relationshipStage, setRelationshipStage] = useState<LenderRelationshipStage | 'all'>('all')
  const [outreachStatus, setOutreachStatus] = useState<LenderOutreachStatus | 'all'>('all')
  const [state, setState] = useState('all')
  const [spanishOnly, setSpanishOnly] = useState(false)
  const [emailPriority, setEmailPriority] = useState<EmailPriorityMode>('prioritize')

  const fetchLenders = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace('/login?redirect=/admin/lenders')
        return
      }

      const params = new URLSearchParams({ page: '1', limit: '200' })
      if (search) params.set('search', search)
      if (lenderType !== 'all') params.set('lender_type', lenderType)
      if (category !== 'all') params.set('category', category)
      if (relationshipStage !== 'all') params.set('relationship_stage', relationshipStage)
      if (outreachStatus !== 'all') params.set('outreach_status', outreachStatus)
      if (state !== 'all') params.set('state', state)
      if (spanishOnly) params.set('spanish_support', 'true')
      if (emailPriority !== 'all') params.set('email_priority', emailPriority)

      const response = await fetch(`/api/admin/lenders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Failed to load lenders.')

      const data = await response.json()
      setLenders(data.lenders || [])
      setSummary(data.summary || null)
      setSelectedIds([])
    } catch (error) {
      toast({
        title: 'Unable to load lenders',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [category, emailPriority, lenderType, outreachStatus, relationshipStage, router, search, spanishOnly, state, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/lenders')
      return
    }
    if (isAuthenticated) void fetchLenders()
  }, [authLoading, fetchLenders, isAuthenticated, router])

  const stateOptions = useMemo(
    () => ['all', ...Array.from(new Set(lenders.flatMap((lender) => [lender.headquarters_state, ...(lender.states_served || [])]).filter(Boolean) as string[]))].sort(),
    [lenders]
  )

  const allSelected = lenders.length > 0 && lenders.length === selectedIds.length

  const toggleSelect = (lenderId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, lenderId])) : current.filter((id) => id !== lenderId)
    )
  }

  const runBulkAction = async (action: string) => {
    if (selectedIds.length === 0) {
      toast({ title: 'Select lenders first', description: 'Choose at least one lender to run this action.' })
      return
    }

    setBulkLoading(action)
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
        body: JSON.stringify({ lenderIds: selectedIds, action }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Bulk action failed.')
      }

      toast({ title: 'Lender batch updated', description: `${selectedIds.length} lenders updated.` })
      await fetchLenders()
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

  const updateLender = async (
    id: string,
    patch: { relationshipStage?: LenderRelationshipStage; outreachStatus?: LenderOutreachStatus }
  ) => {
    setRowLoadingId(id)
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
        body: JSON.stringify({ id, ...patch }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Update failed.')
      }

      await fetchLenders()
    } catch (error) {
      toast({
        title: 'Lender update failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setRowLoadingId(null)
    }
  }

  const regenerateOutreach = async (lenderId: string) => {
    setRowLoadingId(lenderId)
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
        throw new Error(data.error || 'Could not generate lender outreach.')
      }

      toast({ title: 'Lender outreach ready', description: 'Draft partner outreach has been regenerated.' })
      await fetchLenders()
    } catch (error) {
      toast({
        title: 'Outreach generation failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setRowLoadingId(null)
    }
  }

  const refreshNow = async () => {
    setIsRefreshing(true)
    await fetchLenders()
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Lenders tracked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{summary?.total || 0}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Email ready</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{summary?.emailReady || 0}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Outreach ready</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{summary?.outreachReady || 0}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Active partners</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{summary?.activePartners || 0}</CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Lender network</CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              Work partner outreach first, then move lenders into active coverage by state, category, and borrower fit.
            </p>
          </div>
          <Button variant="outline" onClick={refreshNow} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lender, site, email, state" />
            <Select value={lenderType} onValueChange={(value) => setLenderType(value as LenderType | 'all')}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {lenderCategories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CATEGORY_LABELS[value] || value.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                {stateOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'all' ? 'All states' : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={relationshipStage} onValueChange={(value) => setRelationshipStage(value as LenderRelationshipStage | 'all')}>
              <SelectTrigger><SelectValue placeholder="Relationship stage" /></SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={outreachStatus} onValueChange={(value) => setOutreachStatus(value as LenderOutreachStatus | 'all')}>
              <SelectTrigger><SelectValue placeholder="Outreach status" /></SelectTrigger>
              <SelectContent>
                {OUTREACH_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={emailPriority} onValueChange={(value) => setEmailPriority(value as EmailPriorityMode)}>
              <SelectTrigger><SelectValue placeholder="Email priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prioritize">Email ready first</SelectItem>
                <SelectItem value="only">Email ready only</SelectItem>
                <SelectItem value="all">All lenders</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-3 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-300">
              <Checkbox checked={spanishOnly} onCheckedChange={(checked) => setSpanishOnly(Boolean(checked))} />
              Spanish / bilingual only
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={bulkLoading === 'generate_outreach'} onClick={() => void runBulkAction('generate_outreach')}>
              {bulkLoading === 'generate_outreach' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Generate outreach
            </Button>
            <Button variant="outline" disabled={bulkLoading === 'approve_outreach'} onClick={() => void runBulkAction('approve_outreach')}>
              {bulkLoading === 'approve_outreach' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Approve outreach
            </Button>
            <Button variant="outline" disabled={bulkLoading === 'mark_active_partner'} onClick={() => void runBulkAction('mark_active_partner')}>
              {bulkLoading === 'mark_active_partner' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
              Mark active partner
            </Button>
            <Button variant="outline" disabled={bulkLoading === 'pause'} onClick={() => void runBulkAction('pause')}>
              Pause selected
            </Button>
          </div>

          {summary?.categories?.length ? (
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              {summary.categories.map((item) => (
                <Badge key={item.label} variant="secondary">
                  {CATEGORY_LABELS[item.label] || item.label.replaceAll('_', ' ')}: {item.value}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        setSelectedIds(checked ? lenders.map((lender) => lender.id) : [])
                      }}
                    />
                  </TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead>Type / category</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Email status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading lenders...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : lenders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-400">
                      No lenders match this filter set yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  lenders.map((lender) => (
                    <TableRow key={lender.id} className="border-slate-800">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(lender.id)}
                          onCheckedChange={(checked) => toggleSelect(lender.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Link href={`/admin/lenders/${lender.id}`} className="font-medium text-white hover:text-cyan-300">
                            {lender.name}
                          </Link>
                          <div className="text-xs text-slate-400">
                            {[lender.headquarters_city, lender.headquarters_state].filter(Boolean).join(', ') || 'Location pending'}
                          </div>
                          {lender.website ? (
                            <a href={lender.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">
                              <Globe2 className="h-3 w-3" />
                              Open site
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Badge variant="secondary">{lender.lender_type.replaceAll('_', ' ')}</Badge>
                          <div className="text-xs text-slate-300">{CATEGORY_LABELS[lender.category] || lender.category.replaceAll('_', ' ')}</div>
                          {lender.spanish_support || lender.bilingual_support ? (
                            <div className="text-xs text-emerald-300">Spanish-friendly</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-xs text-slate-300">
                          <div>{(lender.states_served || []).slice(0, 4).join(', ') || lender.headquarters_state || 'State coverage pending'}</div>
                          <div>{lender.national_or_regional.replaceAll('_', ' ')}</div>
                          {typeof lender.loan_amount_max === 'number' ? (
                            <div>Max: ${Math.round(lender.loan_amount_max).toLocaleString()}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm text-slate-200">
                          <div>{Math.round(lender.confidence_score || 0)} / 100</div>
                          <div className="text-xs text-slate-400">
                            {lender.last_scored_at ? `Scored ${formatDistanceToNow(new Date(lender.last_scored_at), { addSuffix: true })}` : 'Not scored yet'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <Select
                            value={lender.relationship_stage}
                            onValueChange={(value) => void updateLender(lender.id, { relationshipStage: value as LenderRelationshipStage })}
                            disabled={rowLoadingId === lender.id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {lenderRelationshipStages.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value.replaceAll('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={lender.outreach_status}
                            onValueChange={(value) => void updateLender(lender.id, { outreachStatus: value as LenderOutreachStatus })}
                            disabled={rowLoadingId === lender.id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {lenderOutreachStatuses.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value.replaceAll('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Badge variant={hasUsableEmail(lender) ? 'default' : 'secondary'}>
                            {hasUsableEmail(lender) ? 'Email ready' : 'Needs email'}
                          </Badge>
                          <div className="text-xs text-slate-400">{lender.contact_email || 'No public email saved yet'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => void regenerateOutreach(lender.id)} disabled={rowLoadingId === lender.id}>
                            {rowLoadingId === lender.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Draft outreach'}
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/lenders/${lender.id}`}>Open</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
