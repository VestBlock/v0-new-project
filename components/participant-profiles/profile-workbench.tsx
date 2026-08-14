'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Eye,
  Loader2,
  Pause,
  Play,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_DEFINITIONS,
  PARTICIPANT_STATUS_LABELS,
  rolePublicKeys,
  type ParticipantRole,
  type ParticipantStatus,
} from '@/lib/participant-profiles/config'
import styles from './participant-profiles.module.css'

type Profile = {
  id: string
  role: ParticipantRole
  status: ParticipantStatus
  identity_type: 'individual' | 'organization'
  display_name: string
  organization_name: string
  contact_email: string
  contact_phone: string
  summary: string
  criteria_json: Record<string, unknown>
  communication_preferences_json: { email?: boolean; phone?: boolean }
  marketing_consent: boolean
  matching_consent: boolean
  outreach_consent: boolean
  public_visibility_consent: boolean
  public_slug: string | null
  public_field_keys: string[]
  last_verified_at: string | null
  last_review_reason: string | null
  profile_version: number
  safe_failure_state: string | null
  updated_at: string
}

type ProfileEvent = {
  id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
}

type Normalization = {
  id: string
  original_text: string
  proposed_json: { summary?: string; criteria?: Record<string, unknown> } | null
  provider_model: string | null
  status: 'proposed' | 'approved' | 'rejected' | 'failed'
  failure_message: string | null
  proposed_at: string
}

type EditableProfile = {
  role: ParticipantRole
  identityType: 'individual' | 'organization'
  displayName: string
  organizationName: string
  contactEmail: string
  contactPhone: string
  summary: string
  criteria: Record<string, unknown>
  communicationPreferences: { email: boolean; phone: boolean }
  marketingConsent: boolean
  matchingConsent: boolean
  outreachConsent: boolean
  publicVisibilityConsent: boolean
  publicFieldKeys: string[]
}

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'criteria', label: 'Criteria' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'review', label: 'Review' },
] as const

function toEditable(profile: Profile): EditableProfile {
  return {
    role: profile.role,
    identityType: profile.identity_type,
    displayName: profile.display_name,
    organizationName: profile.organization_name,
    contactEmail: profile.contact_email,
    contactPhone: profile.contact_phone,
    summary: profile.summary,
    criteria: { ...profile.criteria_json },
    communicationPreferences: {
      email: profile.communication_preferences_json.email !== false,
      phone: profile.communication_preferences_json.phone === true,
    },
    marketingConsent: profile.marketing_consent,
    matchingConsent: profile.matching_consent,
    outreachConsent: profile.outreach_consent,
    publicVisibilityConsent: profile.public_visibility_consent,
    publicFieldKeys: [...profile.public_field_keys],
  }
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function listValue(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : String(value || '')
}

function parseList(value: string) {
  return Array.from(new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))).slice(0, 120)
}

export function ParticipantProfileWorkbench(props: {
  profileId?: string
  initialRole: ParticipantRole
  initialEmail: string
  initialName: string
}) {
  const router = useRouter()
  const idempotencyKey = useRef('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<EditableProfile>({
    role: props.initialRole,
    identityType: 'individual',
    displayName: props.initialName,
    organizationName: '',
    contactEmail: props.initialEmail,
    contactPhone: '',
    summary: '',
    criteria: {},
    communicationPreferences: { email: true, phone: false },
    marketingConsent: false,
    matchingConsent: false,
    outreachConsent: false,
    publicVisibilityConsent: false,
    publicFieldKeys: [],
  })
  const [events, setEvents] = useState<ProfileEvent[]>([])
  const [normalizations, setNormalizations] = useState<Normalization[]>([])
  const [activeStep, setActiveStep] = useState<(typeof STEPS)[number]['id']>('identity')
  const [loading, setLoading] = useState(Boolean(props.profileId))
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [freeText, setFreeText] = useState('')
  const [normalizing, setNormalizing] = useState(false)
  const [proposalEdits, setProposalEdits] = useState<Record<string, unknown>>({})

  useEffect(() => {
    idempotencyKey.current = globalThis.crypto?.randomUUID?.() || props.initialRole + '-' + Date.now()
  }, [props.initialRole])

  const load = useCallback(async () => {
    if (!props.profileId) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/participant-profiles/' + props.profileId, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load this profile.')
      setProfile(payload.profile)
      setForm(toEditable(payload.profile))
      setEvents(payload.events || [])
      setNormalizations(payload.normalizations || [])
      const proposal = (payload.normalizations || []).find((item: Normalization) => item.status === 'proposed')
      if (proposal?.proposed_json?.criteria) setProposalEdits(proposal.proposed_json.criteria)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this profile.')
    } finally {
      setLoading(false)
    }
  }, [props.profileId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const definition = PARTICIPANT_ROLE_DEFINITIONS[form.role]
  const latestProposal = normalizations.find((item) => item.status === 'proposed')
  const publicKeys = useMemo(() => new Set(rolePublicKeys(form.role)), [form.role])
  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep)

  const save = async () => {
    setSaving(true)
    setError('')
    setStatusMessage('Saving your private profile…')
    try {
      const endpoint = profile ? '/api/participant-profiles/' + profile.id : '/api/participant-profiles'
      const editableProfile = {
        identityType: form.identityType,
        displayName: form.displayName,
        organizationName: form.organizationName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        summary: form.summary,
        criteria: form.criteria,
        communicationPreferences: form.communicationPreferences,
        marketingConsent: form.marketingConsent,
        matchingConsent: form.matchingConsent,
        outreachConsent: form.outreachConsent,
        publicVisibilityConsent: form.publicVisibilityConsent,
        publicFieldKeys: form.publicFieldKeys,
      }
      const response = await fetch(endpoint, {
        method: profile ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile
          ? { ...editableProfile, expectedVersion: profile.profile_version }
          : { ...editableProfile, role: form.role, idempotencyKey: idempotencyKey.current }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your profile could not be saved.')
      setProfile(payload.profile)
      setForm(toEditable(payload.profile))
      setStatusMessage('Saved. Your private profile is up to date.')
      if (!props.profileId) router.replace('/workspace/profiles/' + payload.profile.id)
      return payload.profile as Profile
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your profile could not be saved.')
      setStatusMessage('')
      return null
    } finally {
      setSaving(false)
    }
  }

  const runLifecycle = async (action: 'submit' | 'pause' | 'reactivate' | 'withdraw') => {
    if (!profile) {
      setError('Save the draft before changing its review status.')
      return
    }
    if (action === 'withdraw' && !window.confirm('Withdraw this profile? It will no longer be eligible for review or public display.')) return
    const lifecycleProfile = action === 'submit' || action === 'reactivate' ? await save() : profile
    if (!lifecycleProfile) return
    setSaving(true)
    setError('')
    setStatusMessage(action === 'submit' ? 'Submitting for operator review…' : 'Updating profile status…')
    try {
      const response = await fetch('/api/participant-profiles/' + lifecycleProfile.id + '/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, expectedVersion: lifecycleProfile.profile_version }),
      })
      const payload = await response.json()
      if (!response.ok && response.status !== 202) throw new Error(payload.error || 'The profile status could not be changed.')
      setProfile(payload.profile)
      setForm(toEditable(payload.profile))
      setStatusMessage(payload.warning || (action === 'submit' ? 'Submitted. VestBlock will review the criteria and permissions.' : 'Profile status updated.'))
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The profile status could not be changed.')
      setStatusMessage('')
    } finally {
      setSaving(false)
    }
  }

  const normalize = async () => {
    if (!profile) {
      setError('Save the draft before asking the assistant to organize your notes.')
      return
    }
    setNormalizing(true)
    setError('')
    setStatusMessage('Preparing a proposal for your review…')
    try {
      const response = await fetch('/api/participant-profiles/' + profile.id + '/normalizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText: freeText }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The assistant could not organize this text.')
      setNormalizations((current) => [payload.normalization, ...current])
      setProposalEdits(payload.normalization.proposed_json?.criteria || {})
      setStatusMessage('Proposal ready. Review every field before approving it.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assistant could not organize this text.')
      setStatusMessage('')
      await load()
    } finally {
      setNormalizing(false)
    }
  }

  const decideProposal = async (action: 'approve' | 'reject') => {
    if (!profile || !latestProposal) return
    setNormalizing(true)
    setError('')
    try {
      const response = await fetch('/api/participant-profiles/' + profile.id + '/normalizations/' + latestProposal.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, corrections: proposalEdits, expectedVersion: profile.profile_version }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The proposal decision could not be saved.')
      if (payload.profile) {
        setProfile(payload.profile)
        setForm(toEditable(payload.profile))
      }
      setStatusMessage(action === 'approve' ? 'Approved. The reviewed structure is now in your draft.' : 'Rejected. Your profile fields were not changed.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The proposal decision could not be saved.')
    } finally {
      setNormalizing(false)
    }
  }

  const updateCriterion = (key: string, value: unknown) => {
    const criteria = { ...form.criteria }
    if (value === '' || (Array.isArray(value) && value.length === 0)) delete criteria[key]
    else criteria[key] = value
    setForm({ ...form, criteria })
  }

  if (loading) return <main className={styles.shell}><div className={styles.loading}><Loader2 className={styles.spin} />Loading your private profile…</div></main>

  return (
    <main className={styles.shell}>
      <section className={styles.workbenchHeader}>
        <div>
          <Link href="/workspace/profiles"><ArrowLeft aria-hidden="true" />All profiles</Link>
          <p className={styles.kicker}>{profile ? PARTICIPANT_STATUS_LABELS[profile.status] : 'New private draft'}</p>
          <h1>{definition.label}</h1>
          <p>{definition.description}</p>
        </div>
        <div className={styles.saveCluster}>
          <p role="status" aria-live="polite">{statusMessage || (profile ? 'Last saved ' + dateTime(profile.updated_at) : 'Not saved yet')}</p>
          <button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className={styles.spin} /> : <Save />}Save draft
          </button>
        </div>
      </section>

      <section className={styles.boundaryBar}>
        <ShieldCheck aria-hidden="true" />
        <div><strong>{definition.use}</strong><span>{definition.boundary}</span></div>
      </section>

      {error ? <div className={styles.alert} role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div> : null}
      {profile?.safe_failure_state ? <div className={styles.notice}><Pause aria-hidden="true" /><span>Your information is saved, but we could not send it to review yet. Try submitting again. No matching or outreach started.</span></div> : null}

      <nav className={styles.stepNav} aria-label="Profile steps">
        {STEPS.map((step, index) => (
          <button type="button" key={step.id} data-active={activeStep === step.id || undefined} onClick={() => setActiveStep(step.id)}>
            <span>{index + 1}</span>{step.label}
          </button>
        ))}
      </nav>

      <div className={styles.workbenchGrid}>
        <div className={styles.workbenchMain}>
          {activeStep === 'identity' ? (
            <section className={styles.formSection} aria-labelledby="identity-title">
              <header><p>Who this profile represents</p><h2 id="identity-title">Identity and account contact</h2><span>Contact information stays private and is used for account service and operator review.</span></header>
              {!profile ? (
                <label className={styles.field}><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ParticipantRole, criteria: {}, publicFieldKeys: [] })}>{PARTICIPANT_ROLES.map((role) => <option key={role} value={role}>{PARTICIPANT_ROLE_DEFINITIONS[role].label}</option>)}</select></label>
              ) : null}
              <div className={styles.fieldGrid}>
                <label className={styles.field}><span>Profile represents</span><select value={form.identityType} onChange={(event) => setForm({ ...form, identityType: event.target.value as 'individual' | 'organization' })}><option value="individual">An individual</option><option value="organization">An organization</option></select></label>
                <label className={styles.field}><span>Contact name *</span><input value={form.displayName} maxLength={200} onChange={(event) => setForm({ ...form, displayName: event.target.value })} autoComplete="name" /></label>
                <label className={styles.field}><span>Organization name</span><input value={form.organizationName} maxLength={200} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} autoComplete="organization" /></label>
                <label className={styles.field}><span>Contact email *</span><input type="email" value={form.contactEmail} maxLength={320} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} autoComplete="email" /></label>
                <label className={styles.field}><span>Contact phone</span><input type="tel" value={form.contactPhone} maxLength={80} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} autoComplete="tel" /></label>
              </div>
              <label className={styles.field}><span>Profile summary</span><textarea value={form.summary} maxLength={2000} rows={5} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="A concise description of what you do, seek, fund, build, sell, or provide." /><small>This summary remains private unless you separately enable public display and the profile becomes active.</small></label>
            </section>
          ) : null}

          {activeStep === 'criteria' ? (
            <>
              <section className={styles.formSection} aria-labelledby="criteria-title">
                <header><p>Structured criteria</p><h2 id="criteria-title">Make the profile useful and reviewable</h2><span>Required fields are marked. Save at any time and return from your workspace.</span></header>
                <div className={styles.fieldGrid}>
                  {definition.fields.map((field) => {
                    const value = form.criteria[field.key]
                    const inputId = 'criteria-' + field.key
                    return (
                      <label className={field.type === 'textarea' || field.type === 'list' ? styles.fieldWide : styles.field} key={field.key} htmlFor={inputId}>
                        <span>{field.label}{field.required ? ' *' : ''}</span>
                        {field.type === 'textarea' || field.type === 'list' ? (
                          <textarea id={inputId} rows={field.type === 'textarea' ? 5 : 3} value={listValue(value)} onChange={(event) => updateCriterion(field.key, field.type === 'list' ? parseList(event.target.value) : event.target.value)} />
                        ) : field.type === 'select' ? (
                          <select id={inputId} value={String(value || '')} onChange={(event) => updateCriterion(field.key, event.target.value)}><option value="">Choose one</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                        ) : (
                          <input id={inputId} type={field.type} value={String(value ?? '')} onChange={(event) => updateCriterion(field.key, field.type === 'number' ? (event.target.value ? Number(event.target.value) : '') : event.target.value)} />
                        )}
                        <small>{field.help}</small>
                      </label>
                    )
                  })}
                </div>
              </section>

              <section className={styles.assistantSection} aria-labelledby="assistant-title">
                <header><Sparkles aria-hidden="true" /><div><p>Optional AI organizer</p><h2 id="assistant-title">Turn your notes into a proposal—not an automatic decision</h2><span>The assistant may propose structured criteria. Nothing changes until you review and explicitly approve every field.</span></div></header>
                <label className={styles.field}><span>Your own words</span><textarea rows={6} maxLength={8000} value={freeText} onChange={(event) => setFreeText(event.target.value)} placeholder="Describe your markets, criteria, capacity, exclusions, timing, and current objective." /></label>
                <button className={styles.secondaryButton} type="button" disabled={!profile || freeText.trim().length < 20 || normalizing} onClick={() => void normalize()}>{normalizing ? <Loader2 className={styles.spin} /> : <Sparkles />}Prepare proposal</button>
                {!profile ? <p className={styles.inlineHelp}>Save the draft first. The manual fields above remain the complete path.</p> : null}
                {latestProposal?.proposed_json ? (
                  <div className={styles.proposal}>
                    <div><h3>Review the proposed interpretation</h3><p>{latestProposal.proposed_json.summary}</p><span>{latestProposal.provider_model} · proposed {dateTime(latestProposal.proposed_at)}</span></div>
                    <div className={styles.fieldGrid}>
                      {Object.entries(proposalEdits).map(([key, value]) => {
                        const field = definition.fields.find((item) => item.key === key)
                        if (!field) return null
                        return (
                          <label className={styles.field} key={key}><span>{field.label}</span><small>Current: {listValue(form.criteria[key]) || 'Not set'}</small><textarea aria-label={'Proposed ' + field.label} rows={3} value={listValue(value)} onChange={(event) => setProposalEdits({ ...proposalEdits, [key]: field.type === 'list' ? parseList(event.target.value) : event.target.value })} /></label>
                        )
                      })}
                    </div>
                    <div className={styles.actionRow}><button type="button" className={styles.primaryButton} disabled={normalizing} onClick={() => void decideProposal('approve')}><Check />Approve proposal</button><button type="button" className={styles.secondaryButton} disabled={normalizing} onClick={() => void decideProposal('reject')}><X />Reject proposal</button></div>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {activeStep === 'permissions' ? (
            <section className={styles.formSection} aria-labelledby="permissions-title">
              <header><p>Independent permissions</p><h2 id="permissions-title">You control each use separately</h2><span>Account service, marketing, future matching, future outreach, and public display are not bundled together.</span></header>
              <div className={styles.permissionStack}>
                <label className={styles.permission}><span><strong>Account email</strong><small>Allow status and service communication about this profile. This is not marketing permission.</small></span><Switch aria-label="Allow account email" checked={form.communicationPreferences.email} onCheckedChange={(checked) => setForm({ ...form, communicationPreferences: { ...form.communicationPreferences, email: checked } })} /></label>
                <label className={styles.permission}><span><strong>Account phone contact</strong><small>Allow an operator to call about this profile. Text messaging is not enabled here.</small></span><Switch aria-label="Allow account phone contact" checked={form.communicationPreferences.phone} onCheckedChange={(checked) => setForm({ ...form, communicationPreferences: { ...form.communicationPreferences, phone: checked } })} /></label>
                <label className={styles.permission}><span><strong>Optional marketing</strong><small>Receive educational or promotional updates. Turning this off does not stop necessary account service.</small></span><Switch aria-label="Allow optional marketing" checked={form.marketingConsent} onCheckedChange={(checked) => setForm({ ...form, marketingConsent: checked })} /></label>
                <label className={styles.permission}><span><strong>Future matching permission</strong><small>Record whether you may want criteria considered in a later matching system. No matching is active from this profile today.</small></span><Switch aria-label="Record future matching permission" checked={form.matchingConsent} onCheckedChange={(checked) => setForm({ ...form, matchingConsent: checked })} /></label>
                <label className={styles.permission}><span><strong>Future outreach permission</strong><small>Record whether you may want approved outreach in a later workflow. No email, phone, social, or direct-mail outreach starts here.</small></span><Switch aria-label="Record future outreach permission" checked={form.outreachConsent} onCheckedChange={(checked) => setForm({ ...form, outreachConsent: checked })} /></label>
                <label className={styles.permission}><span><strong>Public profile permission</strong><small>Allow an approved active profile to display its role, profile name, optional summary, and only the criteria fields you select below. Contact and internal account details are never included.</small></span><Switch aria-label="Allow public profile display" checked={form.publicVisibilityConsent} onCheckedChange={(checked) => setForm({ ...form, publicVisibilityConsent: checked, publicFieldKeys: checked ? form.publicFieldKeys : [] })} /></label>
              </div>
              {form.publicVisibilityConsent ? (
                <div className={styles.publicFields}>
                  <h3>Choose fields eligible for public display</h3>
                  <p>Public display still requires operator approval and active status. Choose only the criteria fields you want shown with the profile name and summary. You can revoke permission at any time.</p>
                  <div>{definition.fields.filter((field) => publicKeys.has(field.key)).map((field) => <label key={field.key}><input type="checkbox" checked={form.publicFieldKeys.includes(field.key)} onChange={(event) => setForm({ ...form, publicFieldKeys: event.target.checked ? [...form.publicFieldKeys, field.key] : form.publicFieldKeys.filter((key) => key !== field.key) })} /><span>{field.label}</span></label>)}</div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeStep === 'review' ? (
            <section className={styles.formSection} aria-labelledby="review-title">
              <header><p>Review before submission</p><h2 id="review-title">Confirm the structure and the boundaries</h2><span>Saving creates a private draft. Submitting creates an operator review task; it does not start sourcing, matching, or outreach.</span></header>
              <dl className={styles.reviewGrid}>
                <div><dt>Role</dt><dd>{definition.label}</dd></div>
                <div><dt>Represents</dt><dd>{form.organizationName || form.displayName || 'Not completed'}</dd></div>
                <div><dt>Criteria completed</dt><dd>{Object.keys(form.criteria).length} structured fields</dd></div>
                <div><dt>Public display</dt><dd>{form.publicVisibilityConsent ? form.publicFieldKeys.length + ' selected public fields' : 'Private'}</dd></div>
                <div><dt>Matching</dt><dd>{form.matchingConsent ? 'Permission recorded for a later workflow' : 'Not permitted'}</dd></div>
                <div><dt>Outreach</dt><dd>{form.outreachConsent ? 'Permission recorded for a later workflow' : 'Not permitted'}</dd></div>
              </dl>
              <div className={styles.reviewBoundary}><ShieldCheck /><p><strong>What happens next</strong><span>VestBlock reviews completeness, criteria, permission boundaries, and any verification needs. An active profile is not a guarantee of capital, property, customers, referrals, projects, contracts, revenue, or a transaction.</span></p></div>
              <div className={styles.actionRow}>
                <button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void save()}><Save />Save draft</button>
                {profile && ['draft', 'needs_information', 'pending_review', 'declined'].includes(profile.status) ? <button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void runLifecycle('submit')}><Send />Submit for review</button> : null}
                {profile && ['draft', 'pending_review', 'active', 'needs_information'].includes(profile.status) ? <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => void runLifecycle('pause')}><Pause />Pause profile</button> : null}
                {profile?.status === 'paused' ? <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => void runLifecycle('reactivate')}><Play />Reactivate</button> : null}
                {profile && !['withdrawn', 'archived'].includes(profile.status) ? <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => void runLifecycle('withdraw')}><Undo2 />Withdraw</button> : null}
              </div>
              {profile?.public_slug && profile.status === 'active' && profile.public_visibility_consent ? <Link className={styles.publicLink} href={'/profiles/public/' + profile.public_slug}><Eye />View public profile</Link> : null}
            </section>
          ) : null}

          <nav className={styles.stepActions} aria-label="Continue through profile steps">
            {activeStepIndex > 0 ? <button className={styles.secondaryButton} type="button" onClick={() => setActiveStep(STEPS[activeStepIndex - 1].id)}><ArrowLeft aria-hidden="true" />Previous step</button> : <span />}
            {activeStepIndex < STEPS.length - 1 ? <button className={styles.primaryButton} type="button" onClick={() => setActiveStep(STEPS[activeStepIndex + 1].id)}>Continue to {STEPS[activeStepIndex + 1].label}</button> : null}
          </nav>
        </div>

        <aside className={styles.workbenchAside}>
          <section><p>Status</p><h2>{profile ? PARTICIPANT_STATUS_LABELS[profile.status] : 'Private draft'}</h2><span>{profile?.last_review_reason || 'Save freely. Submit only when the criteria and permissions are ready for operator review.'}</span></section>
          <section><p>Privacy</p><h2>{form.publicVisibilityConsent ? 'Public permission selected' : 'Private by default'}</h2><span>{form.publicVisibilityConsent ? 'Nothing is public until approval and active status. Only selected fields may display.' : 'Contact details, criteria, activity, and internal review remain private.'}</span></section>
          <section><p>Verification</p><h2>{profile?.last_verified_at ? 'Reviewed ' + dateTime(profile.last_verified_at) : 'Not yet verified'}</h2><span>Profile review does not automatically verify funds, licenses, insurance, pricing, capacity, or availability.</span></section>
          <section><p>History</p><h2>{events.length} profile {events.length === 1 ? 'update' : 'updates'}</h2>{events.length ? <ol className={styles.timeline}>{events.slice(-8).reverse().map((event) => <li key={event.id}><span>{event.note || event.event_type.replaceAll('_', ' ')}</span><small>{dateTime(event.created_at)}</small></li>)}</ol> : <span>History begins when the draft is saved.</span>}</section>
        </aside>
      </div>
    </main>
  )
}
