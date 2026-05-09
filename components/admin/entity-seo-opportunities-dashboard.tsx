'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Opportunity = {
  id: string
  entity_type: string
  entity_name: string
  city: string | null
  state: string | null
  cluster_type: string
  opportunity_score: number
  suggested_title: string
  suggested_slug: string
  suggested_service_focus: string | null
  approval_status: string
  publish_status: string
  source_reason: string
}

export function EntitySeoOpportunitiesDashboard() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [summary, setSummary] = useState({ total: 0, published: 0, queued: 0, needsReview: 0, ready: 0 })
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [serviceFocus, setServiceFocus] = useState('all')
  const [publishStatus, setPublishStatus] = useState('all')
  const [approvalStatus, setApprovalStatus] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (city !== 'all') params.set('city', city)
    if (stateFilter !== 'all') params.set('state', stateFilter)
    if (entityType !== 'all') params.set('entityType', entityType)
    if (serviceFocus !== 'all') params.set('serviceFocus', serviceFocus)
    if (publishStatus !== 'all') params.set('publishStatus', publishStatus)
    if (approvalStatus !== 'all') params.set('approvalStatus', approvalStatus)

    const response = await fetch(`/api/admin/seo-opportunities?${params.toString()}`, { cache: 'no-store' })
    const data = await response.json()
    if (response.ok) {
      setItems(data.opportunities || [])
      setSummary(data.summary || { total: 0, published: 0, queued: 0, needsReview: 0, ready: 0 })
    }
    setLoading(false)
  }, [approvalStatus, city, entityType, publishStatus, serviceFocus, stateFilter])

  useEffect(() => {
    void load()
  }, [load])

  const states = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.state).filter((value): value is string => Boolean(value)))).sort(),
    [items]
  )
  const cities = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.city).filter((value): value is string => Boolean(value)))).sort(),
    [items]
  )
  const services = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.suggested_service_focus).filter((value): value is string => Boolean(value)))
      ).sort(),
    [items]
  )

  const runAction = async (id: string, action: string) => {
    const response = await fetch('/api/admin/seo-opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (response.ok) await load()
  }

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({ format: 'csv' })
    if (city !== 'all') params.set('city', city)
    if (stateFilter !== 'all') params.set('state', stateFilter)
    if (entityType !== 'all') params.set('entityType', entityType)
    if (serviceFocus !== 'all') params.set('serviceFocus', serviceFocus)
    if (publishStatus !== 'all') params.set('publishStatus', publishStatus)
    if (approvalStatus !== 'all') params.set('approvalStatus', approvalStatus)
    return `/api/admin/seo-opportunities?${params.toString()}`
  }, [approvalStatus, city, entityType, publishStatus, serviceFocus, stateFilter])

  const facebookExportUrl = useMemo(() => {
    const params = new URLSearchParams({ format: 'csv', channel: 'facebook_groups' })
    if (city !== 'all') params.set('city', city)
    if (stateFilter !== 'all') params.set('state', stateFilter)
    if (entityType !== 'all') params.set('entityType', entityType)
    if (serviceFocus !== 'all') params.set('serviceFocus', serviceFocus)
    if (publishStatus !== 'all') params.set('publishStatus', publishStatus)
    if (approvalStatus !== 'all') params.set('approvalStatus', approvalStatus)
    return `/api/admin/seo-opportunities?${params.toString()}`
  }, [approvalStatus, city, entityType, publishStatus, serviceFocus, stateFilter])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Total</CardTitle></CardHeader><CardContent className="text-2xl text-white">{summary.total}</CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Published</CardTitle></CardHeader><CardContent className="text-2xl text-white">{summary.published}</CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Queued</CardTitle></CardHeader><CardContent className="text-2xl text-white">{summary.queued}</CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Needs review</CardTitle></CardHeader><CardContent className="text-2xl text-white">{summary.needsReview}</CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-sm text-slate-300">Ready</CardTitle></CardHeader><CardContent className="text-2xl text-white">{summary.ready}</CardContent></Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-white">SEO opportunities</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={exportUrl}>Export CSV</a></Button>
            <Button asChild variant="outline"><a href={facebookExportUrl}>Export Facebook CSV</a></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-6">
            <Select value={city} onValueChange={setCity}><SelectTrigger><SelectValue placeholder="City" /></SelectTrigger><SelectContent><SelectItem value="all">All cities</SelectItem>{cities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger><SelectValue placeholder="State" /></SelectTrigger><SelectContent><SelectItem value="all">All states</SelectItem>{states.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Select value={entityType} onValueChange={setEntityType}><SelectTrigger><SelectValue placeholder="Entity type" /></SelectTrigger><SelectContent><SelectItem value="all">All entity types</SelectItem><SelectItem value="lead_segment">Lead</SelectItem><SelectItem value="lender_segment">Lender</SelectItem><SelectItem value="buyer_segment">Buyer</SelectItem><SelectItem value="city">City</SelectItem><SelectItem value="niche">Niche</SelectItem><SelectItem value="service">Service</SelectItem></SelectContent></Select>
            <Select value={serviceFocus} onValueChange={setServiceFocus}><SelectTrigger><SelectValue placeholder="Service" /></SelectTrigger><SelectContent><SelectItem value="all">All services</SelectItem>{services.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Select value={publishStatus} onValueChange={setPublishStatus}><SelectTrigger><SelectValue placeholder="Publish status" /></SelectTrigger><SelectContent><SelectItem value="all">All publish statuses</SelectItem><SelectItem value="not_started">Not started</SelectItem><SelectItem value="queued">Queued</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent></Select>
            <Select value={approvalStatus} onValueChange={setApprovalStatus}><SelectTrigger><SelectValue placeholder="Approval status" /></SelectTrigger><SelectContent><SelectItem value="all">All approvals</SelectItem><SelectItem value="suggested">Suggested</SelectItem><SelectItem value="ready">Ready</SelectItem><SelectItem value="needs_review">Needs review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading SEO opportunities...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[360px]">
                      <div className="font-medium text-white">{item.suggested_title}</div>
                      <div className="text-xs text-slate-400">{item.source_reason}</div>
                    </TableCell>
                    <TableCell>{[item.city, item.state].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell>{item.entity_type}</TableCell>
                    <TableCell>{item.suggested_service_focus || '—'}</TableCell>
                    <TableCell>{item.opportunity_score}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{item.approval_status}</Badge>
                        <Badge variant="secondary">{item.publish_status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => runAction(item.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => runAction(item.id, 'publish')}>Publish</Button>
                        <Button size="sm" variant="outline" onClick={() => runAction(item.id, 'regenerate')}>Regenerate</Button>
                        <Button size="sm" variant="ghost" onClick={() => runAction(item.id, 'reject')}>Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
