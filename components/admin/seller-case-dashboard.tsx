'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCcw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase/client'
import { sellerCaseStatuses, sellerCaseTransitions, type SellerCaseRecord, type SellerCaseStatus } from '@/lib/seller/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Detail = {
  case: SellerCaseRecord
  events: Array<{ id: string; event_type: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string }>
  tasks: Array<{ id: string; title: string; status: string; priority: string; due_at: string | null }>
}
type OperatorOption = { id: string; name: string; email: string | null }

function label(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) }
function money(value: number | null) { return value === null ? 'Not provided' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) }

export function SellerCaseDashboard() {
  const { isLoading: authLoading } = useAuth()
  const supabase = getSupabaseClient()
  const [cases, setCases] = useState<SellerCaseRecord[]>([])
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [currentOperatorId, setCurrentOperatorId] = useState('')
  const [selected, setSelected] = useState<Detail | null>(null)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [nextStatus, setNextStatus] = useState<SellerCaseStatus | ''>('')
  const [note, setNote] = useState('')
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
      const response = await fetch(`/api/admin/seller/cases?${params}`, { headers: await authHeaders(), cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load seller cases.')
      setCases(payload.cases || [])
      setOperators(payload.operators || [])
      setCurrentOperatorId(payload.currentOperatorId || '')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load seller cases.') }
    finally { setLoading(false) }
  }, [authHeaders, authLoading, status])

  const loadDetail = useCallback(async (id: string) => {
    setMessage('')
    const response = await fetch(`/api/admin/seller/cases?id=${encodeURIComponent(id)}`, { headers: await authHeaders(), cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load seller case detail.')
    setSelected(payload)
    setAssignedTo(payload.case.assigned_to || '')
    setNextStatus('')
    setNote('')
  }, [authHeaders])

  useEffect(() => { const timeout = window.setTimeout(() => void loadCases(), 0); return () => window.clearTimeout(timeout) }, [loadCases])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return cases
    return cases.filter((item) => [item.seller_name,item.email,item.phone,item.property_address,item.city,item.state].some((value) => String(value || '').toLowerCase().includes(needle)))
  }, [cases, search])

  async function saveUpdate() {
    if (!selected) return
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/admin/seller/cases', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ id: selected.case.id, status: nextStatus || undefined, assignedTo: assignedTo || null, note }) })
      const payload = await response.json()
      if (!response.ok && response.status !== 202) throw new Error(payload.error || 'Unable to update the seller case.')
      setMessage(payload.operationPending ? payload.message : 'Seller case updated and status history recorded.')
      await Promise.all([loadCases(), loadDetail(selected.case.id)])
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update the seller case.') }
    finally { setSaving(false) }
  }

  return <div className="vb-seller-admin grid gap-6 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
    <section className={`${selected ? 'hidden xl:block' : ''} min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5`}>
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-[13rem] flex-1"><Label htmlFor="seller-case-search">Search</Label><Input id="seller-case-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Seller, email, address, market…" /></div><div><Label htmlFor="seller-status-filter">Status</Label><select id="seller-status-filter" value={status} onChange={(event) => setStatus(event.target.value)} className="vb-admin-select"><option value="all">All statuses</option>{sellerCaseStatuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div><Button variant="outline" size="icon" onClick={() => void loadCases()} aria-label="Refresh seller cases"><RefreshCcw className="h-4 w-4" /></Button></div>
      {message ? <p role="status" className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] p-3 text-sm text-cyan-100">{message}</p> : null}
      <div className="mt-5 space-y-2">{loading ? <div className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading cases…</div> : filtered.length ? filtered.map((item) => <button key={item.id} data-seller-case-id={item.id} type="button" onClick={() => void loadDetail(item.id)} className="w-full rounded-xl border border-white/[0.07] bg-slate-950/50 p-4 text-left transition hover:border-cyan-300/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><div className="flex items-start justify-between gap-3"><strong className="text-sm text-white">{item.seller_name || item.email}</strong><span className="rounded-full border border-white/10 px-2 py-1 text-[.65rem] uppercase tracking-[.08em] text-slate-300">{label(item.status)}</span></div><p className="mt-1 text-xs text-cyan-200">{item.property_address || 'Address pending'} · {item.city || 'City pending'}, {item.state || 'State pending'}</p><p className="mt-2 text-xs leading-5 text-slate-400">{item.timeline_to_sell || 'Timeline pending'} · {item.completeness_score}% complete</p></button>) : <p className="p-4 text-sm text-slate-400">No seller cases match these filters.</p>}</div>
    </section>
    <section className={`${selected ? '' : 'hidden xl:block'} min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5`}>
      {!selected ? <div className="grid min-h-72 place-items-center text-center text-sm text-slate-400">Select a seller case to review the property, priorities, permissions, CRM record, task, assignment, and status history.</div> : <div className="space-y-6">
        <Button type="button" variant="outline" className="xl:hidden" onClick={() => setSelected(null)}>Back to seller cases</Button>
        <div><p className="text-xs uppercase tracking-[.15em] text-cyan-200">Private seller case</p><h2 className="mt-2 text-2xl font-semibold text-white">{selected.case.property_address}</h2><p className="mt-1 text-sm text-slate-400">{selected.case.seller_name} · {selected.case.email} · {selected.case.phone}</p></div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-3"><small className="text-slate-500">Status</small><p className="mt-1 text-sm text-white">{label(selected.case.status)}</p></div><div className="rounded-xl border border-white/10 p-3"><small className="text-slate-500">Completeness</small><p className="mt-1 text-sm text-white">{selected.case.completeness_score}%</p></div><div className="rounded-xl border border-white/10 p-3"><small className="text-slate-500">Updated</small><p className="mt-1 text-sm text-white">{new Date(selected.case.updated_at).toLocaleString()}</p></div></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Location</dt><dd className="mt-1 text-slate-200">{selected.case.city}, {selected.case.state} {selected.case.postal_code}</dd></div><div><dt className="text-slate-500">Property</dt><dd className="mt-1 text-slate-200">{selected.case.property_type} · {selected.case.bedrooms ?? '–'} bd · {selected.case.bathrooms ?? '–'} ba</dd></div><div><dt className="text-slate-500">Condition / occupancy</dt><dd className="mt-1 text-slate-200">{selected.case.property_condition} · {selected.case.occupancy_status}</dd></div><div><dt className="text-slate-500">Timeline</dt><dd className="mt-1 text-slate-200">{selected.case.timeline_to_sell}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Seller objective</dt><dd className="mt-1 text-slate-200">{selected.case.reason_for_selling}</dd></div><div><dt className="text-slate-500">Estimated value</dt><dd className="mt-1 text-slate-200">{money(selected.case.estimated_value)}</dd></div><div><dt className="text-slate-500">Price expectation</dt><dd className="mt-1 text-slate-200">{money(selected.case.asking_price)}</dd></div><div><dt className="text-slate-500">Mortgage estimate</dt><dd className="mt-1 text-slate-200">{money(selected.case.mortgage_balance)}</dd></div><div><dt className="text-slate-500">Liens / taxes / title</dt><dd className="mt-1 text-slate-200">{selected.case.liens_or_taxes || 'None stated'}</dd></div></dl>
        <div className="rounded-xl border border-white/10 p-4"><h3 className="text-sm font-medium text-white">Permissions and contact</h3><p className="mt-2 text-sm text-slate-300">Case analysis: {selected.case.analysis_consent ? 'Yes' : 'No'} · Case contact: {selected.case.contact_consent ? 'Yes' : 'No'} · Optional marketing: {selected.case.marketing_consent ? 'Yes' : 'No'}</p><p className="mt-1 text-xs text-slate-500">{label(selected.case.communication_preference)} · {selected.case.best_time_to_contact || 'No preferred time stated'}</p></div>
        <div className="flex flex-wrap gap-2">{selected.case.lead_id ? <Button asChild size="sm" variant="outline"><Link href={`/admin/leads/${selected.case.lead_id}`}>Open CRM lead</Link></Button> : <span className="text-xs text-amber-200">CRM routing pending</span>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="seller-assignee">Assigned operator</Label><select id="seller-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="vb-admin-select w-full"><option value="">Unassigned</option>{currentOperatorId ? <option value={currentOperatorId}>Assign to me</option> : null}{assignedTo && !operators.some((operator) => operator.id === assignedTo) && assignedTo !== currentOperatorId ? <option value={assignedTo}>Current assignee</option> : null}{operators.filter((operator) => operator.id !== currentOperatorId).map((operator) => <option key={operator.id} value={operator.id}>{operator.name}{operator.email ? ` · ${operator.email}` : ''}</option>)}</select></div><div><Label htmlFor="seller-next-status">Next status</Label><select id="seller-next-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as SellerCaseStatus | '')} className="vb-admin-select w-full"><option value="">Keep current</option>{sellerCaseTransitions[selected.case.status].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div><div className="sm:col-span-2"><Label htmlFor="seller-operator-note">Operator note</Label><Textarea id="seller-operator-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed, what is missing, or why the case was declined…" /></div></div>
        <Button onClick={() => void saveUpdate()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save operator update</Button>
        <div className="grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-medium text-white">Tasks</h3><ul className="mt-2 space-y-2">{selected.tasks.map((task) => <li key={task.id} className="rounded-lg border border-white/10 p-3 text-xs text-slate-300"><strong>{task.title}</strong><span className="mt-1 block text-slate-500">{label(task.status)} · {label(task.priority)}</span></li>)}</ul></div><div><h3 className="text-sm font-medium text-white">Status history</h3><ol className="mt-2 space-y-2">{selected.events.map((event) => <li key={event.id} className="border-l border-cyan-400/30 pl-3 text-xs text-slate-300"><strong>{label(event.event_type)}</strong><span className="mt-1 block text-slate-500">{new Date(event.created_at).toLocaleString()}</span>{event.note ? <p className="mt-1 text-slate-400">{event.note}</p> : null}</li>)}</ol></div></div>
      </div>}
    </section>
  </div>
}
