"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Building2, Loader2, Mail, RefreshCw, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/buyers/constants'
import { buyerCategories, buyerOutreachStatuses, buyerRelationshipStages, buyerTypes } from '@/lib/buyers/types'
import type { BuyerOutreachStatus, BuyerRecord, BuyerRelationshipStage, BuyerType } from '@/lib/buyers/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

type BuyerSummary = {
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

const TYPE_OPTIONS: Array<{ value: BuyerType | 'all'; label: string }> = [
  { value: 'all', label: 'All buyer types' },
  { value: 'local_operator', label: 'Local operator' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'specialty', label: 'Specialty' },
]

const STAGE_OPTIONS: Array<{ value: BuyerRelationshipStage | 'all'; label: string }> = [
  { value: 'all', label: 'All relationship stages' },
  ...buyerRelationshipStages.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const OUTREACH_OPTIONS: Array<{ value: BuyerOutreachStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All outreach' },
  ...buyerOutreachStatuses.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

function hasUsableEmail(buyer: BuyerRecord) {
  const email = buyer.contact_email?.trim()
  if (!email) return false
  return buyer.outreach_status !== 'do_not_contact' && buyer.relationship_stage !== 'not_a_fit'
}

export function BuyerNetworkDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const [buyers, setBuyers] = useState<BuyerRecord[]>([])
  const [summary, setSummary] = useState<BuyerSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [buyerType, setBuyerType] = useState<BuyerType | 'all'>('all')
  const [category, setCategory] = useState<string>('all')
  const [relationshipStage, setRelationshipStage] = useState<BuyerRelationshipStage | 'all'>('all')
  const [outreachStatus, setOutreachStatus] = useState<BuyerOutreachStatus | 'all'>('all')
  const [state, setState] = useState('all')
  const [spanishOnly, setSpanishOnly] = useState(false)
  const [emailPriority, setEmailPriority] = useState<EmailPriorityMode>('prioritize')

  const fetchBuyers = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/login?redirect=/admin/buyers')
        return
      }
      const params = new URLSearchParams({ page: '1', limit: '200' })
      if (search) params.set('search', search)
      if (buyerType !== 'all') params.set('buyer_type', buyerType)
      if (category !== 'all') params.set('category', category)
      if (relationshipStage !== 'all') params.set('relationship_stage', relationshipStage)
      if (outreachStatus !== 'all') params.set('outreach_status', outreachStatus)
      if (state !== 'all') params.set('state', state)
      if (spanishOnly) params.set('spanish_support', 'true')
      if (emailPriority !== 'all') params.set('email_priority', emailPriority)

      const response = await fetch(`/api/admin/buyers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) throw new Error('Failed to load buyers.')
      const data = await response.json()
      setBuyers(data.buyers || [])
      setSummary(data.summary || null)
      setSelectedIds([])
    } catch (error) {
      toast({
        title: 'Unable to load buyers',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [buyerType, category, emailPriority, outreachStatus, relationshipStage, router, search, spanishOnly, state, supabase, toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/buyers')
      return
    }
    if (isAuthenticated) void fetchBuyers()
  }, [authLoading, fetchBuyers, isAuthenticated, router])

  const marketOptions = useMemo(
    () => ['all', ...Array.from(new Set(buyers.flatMap((buyer) => [buyer.headquarters_state, ...(buyer.markets_served || [])]).filter(Boolean) as string[]))].sort(),
    [buyers]
  )

  const allSelected = buyers.length > 0 && buyers.length === selectedIds.length

  const toggleSelect = (buyerId: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, buyerId])) : current.filter((id) => id !== buyerId)))
  }

  const runBulkAction = async (action: string) => {
    if (selectedIds.length === 0) {
      toast({ title: 'Select buyers first', description: 'Choose at least one buyer to run this action.' })
      return
    }
    setBulkLoading(action)
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
        body: JSON.stringify({ buyerIds: selectedIds, action }),
      })
      if (!response.ok) throw new Error('Bulk action failed.')
      toast({ title: 'Buyer batch updated', description: `${selectedIds.length} buyers updated.` })
      await fetchBuyers()
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

  const updateBuyer = async (
    id: string,
    patch: { relationshipStage?: BuyerRelationshipStage; outreachStatus?: BuyerOutreachStatus }
  ) => {
    setRowLoadingId(id)
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
        body: JSON.stringify({ id, ...patch }),
      })
      if (!response.ok) throw new Error('Update failed.')
      await fetchBuyers()
    } catch (error) {
      toast({
        title: 'Buyer update failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setRowLoadingId(null)
    }
  }

  const regenerateOutreach = async (buyerId: string) => {
    setRowLoadingId(buyerId)
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
      if (!response.ok) throw new Error('Could not generate buyer outreach.')
      toast({ title: 'Buyer outreach ready', description: 'Draft buyer outreach has been regenerated.' })
      await fetchBuyers()
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading buyer network...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total buyers', value: summary?.total || 0 },
          { label: 'Email ready', value: summary?.emailReady || 0 },
          { label: 'Outreach ready', value: summary?.outreachReady || 0 },
          { label: 'Active buyers', value: summary?.activePartners || 0 },
          { label: 'Responded', value: summary?.responded || 0 },
          { label: 'Avg confidence', value: `${summary?.averageConfidence || 0} / 100` },
        ].map((item) => (
          <Card key={item.label} className="border-slate-800 bg-slate-950/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Input placeholder="Search buyers" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={buyerType} onValueChange={(value: BuyerType | 'all') => setBuyerType(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {buyerCategories.map((option) => <SelectItem key={option} value={option}>{CATEGORY_LABELS[option]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={relationshipStage} onValueChange={(value: BuyerRelationshipStage | 'all') => setRelationshipStage(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STAGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={outreachStatus} onValueChange={(value: BuyerOutreachStatus | 'all') => setOutreachStatus(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OUTREACH_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{marketOptions.map((option) => <SelectItem key={option} value={option}>{option === 'all' ? 'All markets' : option}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={emailPriority} onValueChange={(value: EmailPriorityMode) => setEmailPriority(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buyers</SelectItem>
              <SelectItem value="prioritize">Email ready first</SelectItem>
              <SelectItem value="only">Email ready only</SelectItem>
            </SelectContent>
          </Select>
          <label className="col-span-full flex items-center gap-3 text-sm text-slate-300">
            <Checkbox checked={spanishOnly} onCheckedChange={(checked) => setSpanishOnly(checked === true)} />
            Spanish support only
          </label>
          <div className="col-span-full flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void fetchBuyers()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" disabled={bulkLoading !== null} onClick={() => void runBulkAction('generate_outreach')}>Generate outreach</Button>
            <Button variant="outline" disabled={bulkLoading !== null} onClick={() => void runBulkAction('approve_outreach')}>Approve outreach</Button>
            <Button variant="outline" disabled={bulkLoading !== null} onClick={() => void runBulkAction('mark_contacted')}>Mark contacted</Button>
            <Button variant="outline" disabled={bulkLoading !== null} onClick={() => void runBulkAction('mark_active_buyer')}>Mark active buyer</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Buyer queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelectedIds(checked === true ? buyers.map((buyer) => buyer.id) : [])} />
                  </TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Markets</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Outreach</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-400">No buyers match these filters yet.</TableCell>
                  </TableRow>
                ) : (
                  buyers.map((buyer) => (
                    <TableRow key={buyer.id} className="border-slate-800">
                      <TableCell>
                        <Checkbox checked={selectedIds.includes(buyer.id)} onCheckedChange={(checked) => toggleSelect(buyer.id, checked === true)} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/buyers/${buyer.id}`} className="font-medium text-white hover:text-cyan-300">{buyer.name}</Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {hasUsableEmail(buyer) ? <Badge variant="secondary">Email ready</Badge> : <Badge variant="outline">Needs email</Badge>}
                          {buyer.buyer_type === 'institutional' ? <Badge variant="outline">Institutional</Badge> : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{buyer.contact_email || buyer.contact_phone || 'No direct contact yet'}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{CATEGORY_LABELS[buyer.category] || buyer.category}</TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-500" />
                          <span>{buyer.markets_served.slice(0, 3).join(', ') || buyer.headquarters_state || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{Math.round(Number(buyer.confidence_score || 0))} / 100</Badge></TableCell>
                      <TableCell className="text-slate-300">{buyer.outreach_status.replaceAll('_', ' ')}</TableCell>
                      <TableCell className="text-slate-400">{formatDistanceToNow(new Date(buyer.updated_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={rowLoadingId === buyer.id} onClick={() => void regenerateOutreach(buyer.id)}>
                            {rowLoadingId === buyer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="outline" disabled={rowLoadingId === buyer.id || !hasUsableEmail(buyer)} onClick={() => void updateBuyer(buyer.id, { outreachStatus: 'approved' })}>
                            <Send className="h-3.5 w-3.5" />
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
