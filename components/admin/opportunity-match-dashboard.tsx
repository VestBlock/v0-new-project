'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Clock3, RefreshCw, SearchCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

type MatchRow = {
  id: string
  status: string
  score: number
  uncertainty: string
  customer_safe_summary: string
  target_entity_type: string
  target_entity_id: string
  score_explanation_json: Record<string, unknown>
  exclusion_reasons_json: unknown[]
  source_provenance_json: Array<Record<string, unknown>>
  source_observed_at: string | null
  created_at: string
  participant_profiles: { display_name: string; organization_name: string; role: string; matching_consent: boolean; outreach_consent: boolean; last_verified_at: string | null }
  strategy_lane_versions: { lane_key: string; version: number; title: string } | null
}

function dateTime(value: string | null) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function evidenceLabel(value: Record<string, unknown>) {
  const source = String(value.sourceTitle || value.source || value.provider || value.url || 'Recorded source')
  const detail = String(value.observedAt || value.publishedAt || value.checkedAt || '')
  return detail ? `${source} · ${detail}` : source
}

export function OpportunityMatchDashboard() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/opportunity-matches', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load matches.')
      setMatches(payload.matches || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load matches.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const decide = async (id: string, status: 'approved' | 'dismissed' | 'deferred' | 'needs_information') => {
    const note = notes[id]?.trim() || ''
    if (status === 'needs_information' && note.length < 10) {
      setMessage('Write a clear customer-facing question before requesting information.')
      return
    }
    setWorking(id)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/opportunity-matches/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, note: note || undefined }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save the decision.')
      setMessage('Match decision saved. Outreach remains separately controlled.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the decision.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="vb-mono text-xs uppercase tracking-[0.2em] text-cyan-300">Controlled matching</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Opportunity match review</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Review fit, source freshness, uncertainty, and consent boundaries. Approving a match never authorizes outreach.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button asChild variant="outline"><Link href="/admin/command-center">Command Center</Link></Button>
        </div>
      </div>
      {message ? <p role="status" className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{message}</p> : null}
      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-slate-400">Loading review queue…</p> : null}
        {!loading && !matches.length ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">No matches are waiting for review.</p> : null}
        {matches.map((match) => (
          <article key={match.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{match.strategy_lane_versions?.title || 'Unassigned lane'}</span><span>·</span>
                  <span>v{match.strategy_lane_versions?.version || '—'}</span><span>·</span><span>{match.status}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{match.participant_profiles.organization_name || match.participant_profiles.display_name}</h2>
                <p className="mt-1 text-sm text-slate-300">{match.customer_safe_summary}</p>
                <p className="mt-2 text-xs text-slate-500">Score {match.score} · {match.uncertainty} uncertainty · matching consent {match.participant_profiles.matching_consent ? 'active' : 'inactive'} · outreach consent {match.participant_profiles.outreach_consent ? 'active' : 'inactive'}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-px overflow-hidden border border-white/10 bg-white/10 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-[#0a0e11] p-3"><dt className="text-xs text-slate-500">Target</dt><dd className="mt-1 text-slate-200">{match.target_entity_type.replaceAll('_', ' ')}</dd><dd className="mt-1 break-all font-mono text-[0.65rem] text-slate-500">{match.target_entity_id}</dd></div>
              <div className="bg-[#0a0e11] p-3"><dt className="text-xs text-slate-500">Source observed</dt><dd className="mt-1 text-slate-200">{dateTime(match.source_observed_at)}</dd></div>
              <div className="bg-[#0a0e11] p-3"><dt className="text-xs text-slate-500">Profile verified</dt><dd className="mt-1 text-slate-200">{dateTime(match.participant_profiles.last_verified_at)}</dd></div>
              <div className="bg-[#0a0e11] p-3"><dt className="text-xs text-slate-500">Customer boundary</dt><dd className="mt-1 text-slate-200">Matching only · outreach disabled</dd></div>
            </dl>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <details className="border border-white/10 p-3 text-sm"><summary className="cursor-pointer font-medium text-white">Score explanation</summary><dl className="mt-3 space-y-2">{Object.entries(match.score_explanation_json || {}).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{key.replaceAll('_', ' ')}</dt><dd className="break-words text-slate-300">{typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}</dd></div>)}</dl></details>
              <details className="border border-white/10 p-3 text-sm"><summary className="cursor-pointer font-medium text-white">Exclusions</summary><ul className="mt-3 space-y-2 text-slate-300">{match.exclusion_reasons_json?.length ? match.exclusion_reasons_json.map((value, index) => <li key={index}>• {String(value)}</li>) : <li>No exclusions recorded.</li>}</ul></details>
              <details className="border border-white/10 p-3 text-sm"><summary className="cursor-pointer font-medium text-white">Source provenance</summary><ul className="mt-3 space-y-2 text-slate-300">{match.source_provenance_json?.length ? match.source_provenance_json.map((value, index) => <li key={index}>• {evidenceLabel(value)}</li>) : <li>No source provenance recorded.</li>}</ul></details>
            </div>
            <label className="mt-5 block text-sm text-slate-300">
              <span>Decision note <small className="text-slate-500">(required for a customer information request)</small></span>
              <textarea className="mt-2 min-h-24 w-full border border-white/15 bg-black/20 p-3 text-sm text-white outline-none focus:border-[#d7f80b]" value={notes[match.id] || ''} maxLength={2000} onChange={(event) => setNotes((current) => ({ ...current, [match.id]: event.target.value }))} placeholder="Record the decision rationale or write the exact customer-facing question." />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void decide(match.id, 'approved')} disabled={working === match.id}><Check className="mr-1.5 h-4 w-4" />Approve match</Button>
              <Button size="sm" variant="outline" onClick={() => void decide(match.id, 'needs_information')} disabled={working === match.id}><SearchCheck className="mr-1.5 h-4 w-4" />Request info</Button>
              <Button size="sm" variant="outline" onClick={() => void decide(match.id, 'deferred')} disabled={working === match.id}><Clock3 className="mr-1.5 h-4 w-4" />Defer</Button>
              <Button size="sm" variant="outline" onClick={() => void decide(match.id, 'dismissed')} disabled={working === match.id}><X className="mr-1.5 h-4 w-4" />Dismiss</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
