'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCcw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { CapitalCaseRecord, CapitalCaseStatus } from '@/lib/capital/types'
import { capitalCaseStatuses, capitalCaseTransitions, capitalCaseTypes } from '@/lib/capital/types'
import { capitalPathCatalog } from '@/lib/capital/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type DetailResponse = {
  case: CapitalCaseRecord
  events: Array<{ id: string; event_type: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string }>
  tasks: Array<{ id: string; title: string; status: string; priority: string; due_at: string | null }>
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function CapitalCaseDashboard() {
  const { isLoading: authLoading } = useAuth()
  const supabase = getSupabaseClient()
  const [cases, setCases] = useState<CapitalCaseRecord[]>([])
  const [selected, setSelected] = useState<DetailResponse | null>(null)
  const [status, setStatus] = useState('all')
  const [caseType, setCaseType] = useState('all')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [nextStatus, setNextStatus] = useState<CapitalCaseStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Admin session is required.')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  const loadCases = useCallback(async () => {
    if (authLoading) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (caseType !== 'all') params.set('case_type', caseType)
      const response = await fetch(`/api/admin/capital/cases?${params}`, { headers: await authHeaders(), cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load Capital cases.')
      setCases(payload.cases || [])
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load Capital cases.') }
    finally { setLoading(false) }
  }, [authHeaders, authLoading, caseType, status])

  const loadDetail = useCallback(async (id: string) => {
    setMessage('')
    const response = await fetch(`/api/admin/capital/cases?id=${encodeURIComponent(id)}`, { headers: await authHeaders(), cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load case detail.')
    setSelected(payload)
    setAssignedTo(payload.case.assigned_to || '')
    setNextStatus('')
    setNote('')
  }, [authHeaders])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadCases(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadCases])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return cases
    return cases.filter((item) => [item.full_name, item.email, item.organization_name, item.purpose].some((value) => String(value || '').toLowerCase().includes(needle)))
  }, [cases, search])

  async function saveUpdate() {
    if (!selected) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/capital/cases', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ id: selected.case.id, status: nextStatus || undefined, assignedTo: assignedTo || null, note }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to update the Capital case.')
      setMessage('Capital case updated and status history recorded.')
      await Promise.all([loadCases(), loadDetail(selected.case.id)])
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update the Capital case.') }
    finally { setSaving(false) }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[13rem] flex-1"><Label htmlFor="capital-search">Search</Label><Input id="capital-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, organization…" /></div>
          <div><Label htmlFor="capital-type-filter">Path</Label><select id="capital-type-filter" value={caseType} onChange={(event) => setCaseType(event.target.value)} className="vb-admin-select"><option value="all">All paths</option>{capitalCaseTypes.map((item) => <option key={item} value={item}>{capitalPathCatalog[item].title}</option>)}</select></div>
          <div><Label htmlFor="capital-status-filter">Status</Label><select id="capital-status-filter" value={status} onChange={(event) => setStatus(event.target.value)} className="vb-admin-select"><option value="all">All statuses</option>{capitalCaseStatuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div>
          <Button variant="outline" size="icon" onClick={() => void loadCases()} aria-label="Refresh Capital cases"><RefreshCcw className="h-4 w-4" /></Button>
        </div>
        {message ? <p role="status" className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] p-3 text-sm text-cyan-100">{message}</p> : null}
        <div className="mt-5 space-y-2">
          {loading ? <div className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading cases…</div> : filtered.length ? filtered.map((item) => (
            <button key={item.id} type="button" onClick={() => void loadDetail(item.id)} className="w-full rounded-xl border border-white/[0.07] bg-slate-950/50 p-4 text-left transition hover:border-cyan-300/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              <div className="flex items-start justify-between gap-3"><strong className="text-sm text-white">{item.full_name || item.email}</strong><span className="rounded-full border border-white/10 px-2 py-1 text-[.65rem] uppercase tracking-[.08em] text-slate-300">{label(item.status)}</span></div>
              <p className="mt-1 text-xs text-cyan-200">{capitalPathCatalog[item.case_type].title} · {item.readiness_score}/100</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.organization_name || 'Organization pending'} · {item.purpose || 'Purpose pending'}</p>
            </button>
          )) : <p className="p-4 text-sm text-slate-400">No cases match these filters.</p>}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
        {!selected ? <div className="grid min-h-72 place-items-center text-center text-sm text-slate-400">Select a Capital case to review facts, documents, CRM links, tasks, and status history.</div> : (
          <div className="space-y-6">
            <div><p className="text-xs uppercase tracking-[.15em] text-cyan-200">{capitalPathCatalog[selected.case.case_type].title}</p><h2 className="mt-2 text-2xl font-semibold text-white">{selected.case.full_name}</h2><p className="mt-1 text-sm text-slate-400">{selected.case.email} · {selected.case.organization_name || 'Organization pending'}</p></div>
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-3"><small className="text-slate-500">Status</small><p className="mt-1 text-sm text-white">{label(selected.case.status)}</p></div><div className="rounded-xl border border-white/10 p-3"><small className="text-slate-500">Readiness</small><p className="mt-1 text-sm text-white">{selected.case.readiness_score}/100 · {label(selected.case.readiness_tier)}</p></div><div className="rounded-xl border border-white/10 p-3"><small className="text-slate-500">Updated</small><p className="mt-1 text-sm text-white">{new Date(selected.case.updated_at).toLocaleString()}</p></div></div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Purpose</dt><dd className="mt-1 text-slate-200">{selected.case.purpose || 'Pending'}</dd></div><div><dt className="text-slate-500">Amount</dt><dd className="mt-1 text-slate-200">{selected.case.amount_requested ? new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(selected.case.amount_requested) : 'Pending'}</dd></div><div><dt className="text-slate-500">Timing / geography</dt><dd className="mt-1 text-slate-200">{selected.case.timing || 'Pending'} · {selected.case.geography || 'Pending'}</dd></div><div><dt className="text-slate-500">Sharing permission</dt><dd className="mt-1 text-slate-200">{selected.case.provider_sharing_consent ? 'Controlled provider review permitted' : 'VestBlock review only'}</dd></div></dl>
            <div className="rounded-xl border border-white/10 p-4"><h3 className="text-sm font-medium text-white">Missing documents</h3>{selected.case.missing_documents.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{selected.case.missing_documents.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">Customer marked the standard checklist available. Verify before provider review.</p>}</div>
            <div className="flex flex-wrap gap-2">{selected.case.lead_id ? <Button asChild size="sm" variant="outline"><Link href={`/admin/leads/${selected.case.lead_id}`}>Open CRM lead</Link></Button> : null}{selected.case.lender_id ? <Button asChild size="sm" variant="outline"><Link href={`/admin/lenders/${selected.case.lender_id}`}>Open lender profile</Link></Button> : null}</div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="capital-assignee">Operator user ID</Label><Input id="capital-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Optional UUID" /></div><div><Label htmlFor="capital-next-status">Next status</Label><select id="capital-next-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as CapitalCaseStatus | '')} className="vb-admin-select w-full"><option value="">Keep current</option>{capitalCaseTransitions[selected.case.status].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div><div className="sm:col-span-2"><Label htmlFor="capital-note">Operator note / provider evidence</Label><Textarea id="capital-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why the status changed, what is missing, or which provider decision was received…" /></div></div>
            <Button onClick={() => void saveUpdate()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save operator update</Button>
            <div className="grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-medium text-white">Tasks</h3><ul className="mt-2 space-y-2">{selected.tasks.map((task) => <li key={task.id} className="rounded-lg border border-white/10 p-3 text-xs text-slate-300"><strong>{task.title}</strong><span className="mt-1 block text-slate-500">{label(task.status)} · {label(task.priority)}</span></li>)}</ul></div><div><h3 className="text-sm font-medium text-white">Status history</h3><ol className="mt-2 space-y-2">{selected.events.map((event) => <li key={event.id} className="border-l border-cyan-400/30 pl-3 text-xs text-slate-300"><strong>{label(event.event_type)}</strong><span className="mt-1 block text-slate-500">{new Date(event.created_at).toLocaleString()}</span>{event.note ? <p className="mt-1 text-slate-400">{event.note}</p> : null}</li>)}</ol></div></div>
          </div>
        )}
      </section>
    </div>
  )
}
