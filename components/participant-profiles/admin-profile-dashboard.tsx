'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Check, CircleAlert, Loader2, Pause, RefreshCw, Search, UserRoundCheck, X } from 'lucide-react'
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_DEFINITIONS,
  PARTICIPANT_STATUSES,
  PARTICIPANT_STATUS_LABELS,
  type ParticipantRole,
  type ParticipantStatus,
} from '@/lib/participant-profiles/config'
import styles from './participant-profiles.module.css'

type Operator = { id: string; email: string; name: string }
type AdminProfile = {
  id: string
  owner_user_id: string
  role: ParticipantRole
  origin: string
  status: ParticipantStatus
  display_name: string
  organization_name: string
  contact_email: string
  contact_phone: string
  summary: string
  criteria_json: Record<string, unknown>
  communication_preferences_json: Record<string, unknown>
  marketing_consent: boolean
  matching_consent: boolean
  outreach_consent: boolean
  public_visibility_consent: boolean
  public_field_keys: string[]
  last_verified_at: string | null
  assigned_to: string | null
  legacy_entity_type: string | null
  legacy_entity_id: string | null
  legacy_claim_status: string
  account_profile_id: string | null
  crm_lead_id: string | null
  operator_task_id: string | null
  profile_version: number
  safe_failure_state: string | null
  safe_failure_message: string | null
  last_review_reason: string | null
  updated_at: string
  owner?: { name: string; email: string }
  assignedOperator?: { name: string; email: string } | null
}

type Detail = {
  profile: AdminProfile
  events: Array<{ id: string; event_type: string; actor_kind: string; note: string | null; customer_visible: boolean; created_at: string }>
  operators: Operator[]
  owner: { id: string; email: string; name: string; accountHref: string }
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ParticipantProfileAdminDashboard() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [detail, setDetail] = useState<Detail | null>(null)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [origin, setOrigin] = useState('all')
  const [reason, setReason] = useState('')
  const [assignedEmail, setAssignedEmail] = useState('')
  const [legacyType, setLegacyType] = useState('buyers')
  const [legacyId, setLegacyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ search, role, status, origin })
      const response = await fetch('/api/admin/participant-profiles?' + query.toString(), { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load participant profiles.')
      setProfiles(payload.profiles || [])
      setOperators(payload.operators || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load participant profiles.')
    } finally {
      setLoading(false)
    }
  }, [origin, role, search, status])

  const loadDetail = useCallback(async (id: string) => {
    setError('')
    try {
      const response = await fetch('/api/admin/participant-profiles/' + id, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load this participant profile.')
      setDetail(payload)
      setOperators(payload.operators || operators)
      setAssignedEmail(payload.profile.assignedOperator?.email || '')
      setReason('')
      setLegacyType(payload.profile.legacy_entity_type || 'buyers')
      setLegacyId(payload.profile.legacy_entity_id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this participant profile.')
    }
  }, [operators])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 0)
    return () => window.clearTimeout(timer)
  }, [loadList])

  const act = async (action: 'assign' | 'request_information' | 'approve' | 'decline' | 'pause' | 'archive' | 'link_legacy') => {
    if (!detail) return
    setActing(true)
    setError('')
    setMessage('Saving operator action…')
    try {
      const response = await fetch('/api/admin/participant-profiles/' + detail.profile.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason,
          assignedOperatorEmail: action === 'assign' ? assignedEmail : undefined,
          legacyEntityType: action === 'link_legacy' ? legacyType : undefined,
          legacyEntityId: action === 'link_legacy' ? legacyId : undefined,
          expectedVersion: detail.profile.profile_version,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The operator action could not be saved.')
      setMessage('Operator action saved.')
      await Promise.all([loadDetail(detail.profile.id), loadList()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The operator action could not be saved.')
      setMessage('')
    } finally {
      setActing(false)
    }
  }

  const selected = detail?.profile
  const fieldLabels = selected
    ? new Map(PARTICIPANT_ROLE_DEFINITIONS[selected.role].fields.map((field) => [field.key, field.label]))
    : new Map<string, string>()

  return (
    <div className={styles.adminSurface}>
      <header className={styles.adminHeader}>
        <div><p className={styles.kicker}>Participant operations</p><h1>Profile review desk</h1><span>Customer-controlled role profiles, consent boundaries, review tasks, and account linkage. Existing discovered prospects remain separate.</span></div>
        <button className={styles.secondaryButton} type="button" onClick={() => void loadList()} disabled={loading}><RefreshCw className={loading ? styles.spin : undefined} />Refresh</button>
      </header>

      {error ? <div className={styles.alert} role="alert"><CircleAlert /><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div> : null}
      <p className={styles.adminStatus} role="status" aria-live="polite">{message}</p>

      <form className={styles.adminFilters} onSubmit={(event) => { event.preventDefault(); void loadList() }}>
        <label><span>Search</span><div><Search /><input value={search} maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, organization, role" /></div></label>
        <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option>{PARTICIPANT_ROLES.map((item) => <option value={item} key={item}>{PARTICIPANT_ROLE_DEFINITIONS[item].shortLabel}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{PARTICIPANT_STATUSES.map((item) => <option value={item} key={item}>{PARTICIPANT_STATUS_LABELS[item]}</option>)}</select></label>
        <label><span>Source</span><select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="all">All sources</option>{['customer', 'operator', 'imported', 'discovered', 'legacy'].map((item) => <option value={item} key={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
        <button className={styles.primaryButton} type="submit">Apply filters</button>
      </form>

      <div className={styles.adminLayout}>
        <section className={styles.adminQueue} aria-labelledby="queue-title">
          <header><h2 id="queue-title">Review queue</h2><span>{profiles.length} profiles</span></header>
          {loading ? <div className={styles.loading}><Loader2 className={styles.spin} />Loading queue…</div> : profiles.map((profile) => (
            <button type="button" key={profile.id} data-active={selected?.id === profile.id || undefined} onClick={() => void loadDetail(profile.id)}>
              <span className={styles.status} data-status={profile.status}>{PARTICIPANT_STATUS_LABELS[profile.status]}</span>
              <strong>{profile.organization_name || profile.display_name}</strong>
              <small>{PARTICIPANT_ROLE_DEFINITIONS[profile.role].shortLabel} · {profile.origin} · {profile.owner?.email || profile.contact_email}</small>
              <small>{profile.assignedOperator ? 'Assigned to ' + profile.assignedOperator.name : 'Unassigned'} · {dateTime(profile.updated_at)}</small>
            </button>
          ))}
          {!loading && !profiles.length ? <div className={styles.emptyState}><p>No profiles match these filters.</p></div> : null}
        </section>

        <section className={styles.adminDetail} aria-live="polite">
          {!detail ? (
            <div className={styles.emptyState}><UserRoundCheck /><h2>Select a profile</h2><p>Review identity, criteria, permissions, account linkage, and customer-safe history before taking an operator action.</p></div>
          ) : (
            <>
              <header className={styles.adminDetailHeader}>
                <div><p>{PARTICIPANT_ROLE_DEFINITIONS[detail.profile.role].label}</p><h2>{detail.profile.organization_name || detail.profile.display_name}</h2><span>{detail.profile.summary || 'No summary supplied.'}</span></div>
                <span className={styles.status} data-status={detail.profile.status}>{PARTICIPANT_STATUS_LABELS[detail.profile.status]}</span>
              </header>

              <div className={styles.operatorFacts}>
                <dl>
                  <div><dt>Owner</dt><dd>{detail.owner.name}<br />{detail.owner.email}</dd></div>
                  <div><dt>Source</dt><dd>{detail.profile.origin}</dd></div>
                  <div><dt>Last verified</dt><dd>{dateTime(detail.profile.last_verified_at)}</dd></div>
                  <div><dt>Legacy link</dt><dd>{detail.profile.legacy_claim_status === 'verified' ? detail.profile.legacy_entity_type + ' · verified' : 'None verified'}</dd></div>
                  <div><dt>Review task</dt><dd>{detail.profile.operator_task_id ? 'Connected' : 'Not created'}</dd></div>
                  <div><dt>CRM or account</dt><dd>{detail.profile.crm_lead_id ? 'CRM lead connected' : 'Account connected'}</dd></div>
                </dl>
                <Link href={detail.owner.accountHref}>Open account record</Link>
              </div>

              {detail.profile.safe_failure_state ? <div className={styles.notice}><Pause /><span>{detail.profile.safe_failure_message || 'A recoverable downstream step needs operator attention.'}</span></div> : null}

              <section className={styles.adminSection}>
                <h3>Criteria supplied for review</h3>
                <dl className={styles.reviewGrid}>{Object.entries(detail.profile.criteria_json || {}).map(([key, value]) => <div key={key}><dt>{fieldLabels.get(key) || key}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}</dl>
              </section>

              <section className={styles.adminSection}>
                <h3>Consent and visibility</h3>
                <dl className={styles.reviewGrid}>
                  <div><dt>Account email</dt><dd>{detail.profile.communication_preferences_json.email ? 'Allowed' : 'Off'}</dd></div>
                  <div><dt>Account phone</dt><dd>{detail.profile.communication_preferences_json.phone ? 'Allowed' : 'Off'}</dd></div>
                  <div><dt>Marketing</dt><dd>{detail.profile.marketing_consent ? 'Allowed' : 'Not allowed'}</dd></div>
                  <div><dt>Future matching</dt><dd>{detail.profile.matching_consent ? 'Permission recorded; inactive' : 'Not allowed'}</dd></div>
                  <div><dt>Future outreach</dt><dd>{detail.profile.outreach_consent ? 'Permission recorded; inactive' : 'Not allowed'}</dd></div>
                  <div><dt>Public display</dt><dd>{detail.profile.public_visibility_consent ? detail.profile.public_field_keys.length + ' allowlisted fields' : 'Private'}</dd></div>
                </dl>
              </section>

              <section className={styles.adminSection}>
                <h3>Operator controls</h3>
                <div className={styles.operatorControls}>
                  <label><span>Assign operator</span><select value={assignedEmail} onChange={(event) => setAssignedEmail(event.target.value)}><option value="">Choose by name or email</option>{operators.map((operator) => <option value={operator.email} key={operator.id}>{operator.name} · {operator.email}</option>)}</select></label>
                  <button className={styles.secondaryButton} type="button" disabled={acting || !assignedEmail} onClick={() => void act('assign')}>Assign</button>
                  <label className={styles.operatorReason}><span>Reason or customer-facing request</span><textarea rows={4} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for information requests, decline, pause, archive, and verified legacy linkage." /></label>
                  <div className={styles.actionRow}>
                    <button className={styles.primaryButton} type="button" disabled={acting} onClick={() => void act('approve')}><Check />Approve</button>
                    <button className={styles.secondaryButton} type="button" disabled={acting || reason.length < 5} onClick={() => void act('request_information')}>Request information</button>
                    <button className={styles.secondaryButton} type="button" disabled={acting || reason.length < 5} onClick={() => void act('pause')}><Pause />Pause</button>
                    <button className={styles.dangerButton} type="button" disabled={acting || reason.length < 5} onClick={() => void act('decline')}><X />Decline</button>
                    <button className={styles.dangerButton} type="button" disabled={acting || reason.length < 5} onClick={() => void act('archive')}>Archive</button>
                  </div>
                  <details className={styles.legacyControl}>
                    <summary>Link a securely verified legacy record</summary>
                    <p>Email matching is never accepted as proof of ownership. Complete external verification and record the reason above first.</p>
                    <label><span>Existing record type</span><select value={legacyType} onChange={(event) => setLegacyType(event.target.value)}><option value="buyers">Buyer network</option><option value="lenders">Lender network</option><option value="investor_profiles">Investor network</option></select></label>
                    <label><span>Verified record ID</span><input value={legacyId} onChange={(event) => setLegacyId(event.target.value)} /></label>
                    <button className={styles.secondaryButton} type="button" disabled={acting || reason.length < 5 || !legacyId} onClick={() => void act('link_legacy')}>Record verified link</button>
                  </details>
                </div>
              </section>

              <section className={styles.adminSection}>
                <h3>Complete internal history</h3>
                <ol className={styles.timeline}>{detail.events.slice().reverse().map((event) => <li key={event.id}><span>{event.note || event.event_type.replaceAll('_', ' ')}</span><small>{event.actor_kind} · {event.customer_visible ? 'customer visible' : 'internal'} · {dateTime(event.created_at)}</small></li>)}</ol>
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
