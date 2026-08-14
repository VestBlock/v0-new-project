"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, Check, CircleAlert, FileCheck2, Loader2, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react"
import { MEMBER_ROLE_OPTIONS, normalizeMemberRoles, type MemberRole } from "@/lib/auth/intent"
import { platformLanes, platformScenarios, type PlatformLaneId, type ScenarioId } from "@/lib/platform/lanes"
import { Switch } from "@/components/ui/switch"
import { PARTICIPANT_ROLE_DEFINITIONS, type ParticipantRole, type ParticipantStatus } from "@/lib/participant-profiles/config"

type WorkspaceResponse = {
  workspace: {
    activeLane: PlatformLaneId | null
    selectedScenario: ScenarioId | null
    criteria: Record<string, string>
    questionnaireProgress: { focus?: string; step?: number; timeline?: string; position?: string; creditRange?: string; weeklyTime?: string; mainObstacle?: string; goalDetails?: string; requestFollowUp?: boolean }
    recommendations: Array<{ id: string; title: string; summary: string; status: string; href: string | null }>
    marketingConsent: boolean
    profileVisibility: 'private' | 'eligible-partners'
    updatedAt: string | null
  }
  profile: { fullName: string; memberRoles: MemberRole[]; financialGoal: unknown; updatedAt: string | null }
  roadmap: { id: string; financial_goal_title?: string; generated_at?: string; roadmap_data?: unknown } | null
  questionnaire: { id: string; focus?: string; primary_path?: string; created_at?: string; updated_at?: string } | null
  intake: {
    profiles: Array<{ id: string; role: ParticipantRole; status: ParticipantStatus; display_name?: string; organization_name?: string; public_visibility_consent?: boolean; safe_failure_state?: string | null; updated_at?: string }>
    sellers: Array<{ id: string; property_address?: string; city?: string; state?: string; status?: string; updated_at?: string; created_at?: string }>
  }
  creditReports: Array<{ id: string; status?: string; created_at?: string; completed_at?: string }>
}

type EditableWorkspace = WorkspaceResponse['workspace'] & { memberRoles: MemberRole[] }

function formatDate(value?: string | null) {
  if (!value) return 'Not saved yet'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function getNextActions(data: WorkspaceResponse, form: EditableWorkspace) {
  const actions: Array<{ title: string; body: string; href: string; label: string }> = []
  if (!form.memberRoles.length) actions.push({ title: 'Choose your roles', body: 'Roles personalize the paths and status shown in this workspace.', href: '#roles', label: 'Choose roles' })
  if (!data.questionnaire) actions.push({ title: 'Build your free roadmap', body: 'Start with your goal, current position, timeline, and main obstacle.', href: '/next-move', label: 'Start questionnaire' })
  if (form.memberRoles.includes('real_estate_buyer') && !data.intake.profiles.some((profile) => profile.role === 'buyer')) actions.push({ title: 'Save buyer criteria', body: 'Add markets, asset types, price range, strategy, capacity, and no-go criteria in a private account profile.', href: '/workspace/profiles/new?role=buyer', label: 'Create buyer profile' })
  if (form.memberRoles.includes('property_seller') && !data.intake.sellers.length) actions.push({ title: 'Submit a property', body: 'Organize the property, condition, timing, and preferred outcome.', href: '/sell', label: 'Review sale path' })
  if (form.memberRoles.includes('lender') && !data.intake.profiles.some((profile) => profile.role === 'lender')) actions.push({ title: 'Add provider criteria', body: 'Record coverage, products, provider-supplied terms, documentation, and exclusions for operator review.', href: '/workspace/profiles/new?role=lender', label: 'Create provider profile' })
  if (form.memberRoles.includes('investor') && !data.intake.profiles.some((profile) => profile.role === 'investor')) actions.push({ title: 'Organize investor criteria', body: 'State your acquisition thesis, economics, capacity, and exclusions in a private profile.', href: '/workspace/profiles/new?role=investor', label: 'Create investor profile' })
  if (!actions.length) actions.push({ title: 'Review your active lane', body: 'Your foundation is saved. Continue into the lane that matches your current objective.', href: platformLanes[form.activeLane || 'opportunity'].href, label: `Open ${platformLanes[form.activeLane || 'opportunity'].label}` })
  return actions.slice(0, 3)
}

export function CustomerWorkspace() {
  const [data, setData] = useState<WorkspaceResponse | null>(null)
  const [form, setForm] = useState<EditableWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load your workspace.')

      let localScenario: ScenarioId | null = null
      let localLane: PlatformLaneId | null = null
      try {
        const scenarioValue = window.localStorage.getItem('vestblock:selected-scenario')
        const laneValue = window.localStorage.getItem('vestblock:active-lane')
        localScenario = platformScenarios.some((item) => item.id === scenarioValue) ? scenarioValue as ScenarioId : null
        localLane = Object.hasOwn(platformLanes, laneValue || '') ? laneValue as PlatformLaneId : null
      } catch {
        // Local continuity is optional; authenticated state remains authoritative.
      }

      const nextData = payload as WorkspaceResponse
      if ((!nextData.workspace.selectedScenario && localScenario) || (!nextData.workspace.activeLane && localLane)) {
        const transfer = await fetch('/api/workspace', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedScenario: nextData.workspace.selectedScenario || localScenario, activeLane: nextData.workspace.activeLane || localLane }),
        })
        if (transfer.ok) Object.assign(nextData, await transfer.json())
      }

      setData(nextData)
      setForm({ ...nextData.workspace, criteria: { ...nextData.workspace.criteria }, memberRoles: normalizeMemberRoles(nextData.profile.memberRoles) })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your workspace.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const save = async () => {
    if (!form) return
    setSaving(true); setError(''); setStatus('Saving your changes…')
    try {
      const response = await fetch('/api/workspace', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeLane: form.activeLane,
          selectedScenario: form.selectedScenario,
          criteria: form.criteria,
          questionnaireProgress: form.questionnaireProgress,
          marketingConsent: form.marketingConsent,
          profileVisibility: form.profileVisibility,
          memberRoles: form.memberRoles,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your changes could not be saved.')
      const nextData = payload as WorkspaceResponse
      setData(nextData)
      setForm({ ...nextData.workspace, criteria: { ...nextData.workspace.criteria }, memberRoles: normalizeMemberRoles(nextData.profile.memberRoles) })
      setStatus('Saved. Your workspace is up to date.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your changes could not be saved.')
      setStatus('')
    } finally { setSaving(false) }
  }

  const nextActions = useMemo(() => data && form ? getNextActions(data, form) : [], [data, form])

  if (loading) return <div className="vb-workspace vb-workspace--state"><Loader2 className="animate-spin" aria-hidden="true" /><p>Loading your VestBlock workspace…</p></div>
  if (error && (!data || !form)) return <div className="vb-workspace vb-workspace--state"><CircleAlert aria-hidden="true" /><h1>Your workspace is temporarily unavailable.</h1><p>{error}</p><button className="vb-button vb-button--primary" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</button></div>
  if (!data || !form) return null

  const selectedScenario = platformScenarios.find((item) => item.id === form.selectedScenario)
  const activeLane = platformLanes[form.activeLane || selectedScenario?.lane || 'opportunity']
  const intakeCount = data.intake.profiles.length + data.intake.sellers.length

  return (
    <div className="vb-workspace">
      <section className="vb-workspace__masthead">
        <div>
          <p className="vb-kicker">Customer workspace</p>
          <h1>Welcome back, {data.profile.fullName}.</h1>
          <p>See what is saved, what is in progress, and the clearest next action across every VestBlock lane.</p>
        </div>
        <div className="vb-workspace__save">
          <p role="status" aria-live="polite">{status || `Last saved ${formatDate(form.updatedAt)}`}</p>
          <button className="vb-button vb-button--primary" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save workspace</button>
        </div>
      </section>

      {error ? <div className="vb-workspace__error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></div> : null}

      <section className="vb-workspace__status" aria-labelledby="workspace-status-title">
        <div><p>Active lane</p><h2 id="workspace-status-title">{activeLane.label}</h2><span>{selectedScenario?.title || 'Choose a scenario below to personalize this workspace.'}</span></div>
        <dl>
          <div><dt>Roadmap</dt><dd>{data.roadmap ? 'Generated' : data.questionnaire ? 'Questionnaire complete' : 'Not started'}</dd></div>
          <div><dt>Saved criteria</dt><dd>{intakeCount ? `${intakeCount} active ${intakeCount === 1 ? 'record' : 'records'}` : 'None yet'}</dd></div>
          <div><dt>Credit activity</dt><dd>{data.creditReports.length ? `${data.creditReports.length} recent ${data.creditReports.length === 1 ? 'report' : 'reports'}` : 'None yet'}</dd></div>
          <div><dt>Visibility</dt><dd>{form.profileVisibility === 'eligible-partners' ? 'Eligible partner review' : 'Private'}</dd></div>
        </dl>
      </section>

      <div className="vb-workspace__layout">
        <div className="vb-workspace__primary">
          <section className="vb-workspace__section" aria-labelledby="next-actions-title">
            <div className="vb-workspace__section-head"><p>Priority</p><h2 id="next-actions-title">Your next actions</h2></div>
            <ol className="vb-workspace__actions">
              {nextActions.map((action, index) => <li key={action.title}><span>0{index + 1}</span><div><h3>{action.title}</h3><p>{action.body}</p></div><Link href={action.href}>{action.label}<ArrowRight aria-hidden="true" /></Link></li>)}
            </ol>
          </section>

          <section className="vb-workspace__section" aria-labelledby="progress-title">
            <div className="vb-workspace__section-head"><p>Progress and status</p><h2 id="progress-title">What VestBlock has on file</h2></div>
            <div className="vb-workspace__records">
              <article><FileCheck2 aria-hidden="true" /><div><h3>Next-Move Questionnaire</h3><p>{data.questionnaire ? `${data.questionnaire.primary_path || 'Roadmap'} path · updated ${formatDate(data.questionnaire.updated_at)}` : 'No completed questionnaire is connected to this account email yet.'}</p></div><Link href={data.questionnaire ? '/next-move' : '/next-move'}>{data.questionnaire ? 'Build another roadmap' : 'Start questionnaire'}<ArrowRight /></Link></article>
              <article><FileCheck2 aria-hidden="true" /><div><h3>Roadmap</h3><p>{data.roadmap ? `${data.roadmap.financial_goal_title || 'Personal roadmap'} · generated ${formatDate(data.roadmap.generated_at)}` : 'Complete your questionnaire or profile to begin an ordered roadmap.'}</p></div><Link href={data.roadmap ? '/roadmap' : '/next-move'}>{data.roadmap ? 'Open roadmap' : 'Create roadmap'}<ArrowRight /></Link></article>
              <article><FileCheck2 aria-hidden="true" /><div><h3>Participant profiles</h3><p>{data.intake.profiles.length ? data.intake.profiles.length + ' owned role ' + (data.intake.profiles.length === 1 ? 'profile' : 'profiles') + ' connected to this account.' : 'No buyer, investor, lender, builder, developer, agent, wholesaler, business, or provider profile is connected yet.'}</p></div><Link href="/workspace/profiles">Manage participant profiles<ArrowRight /></Link></article>
              <article><FileCheck2 aria-hidden="true" /><div><h3>Seller cases</h3><p>{data.intake.sellers.length ? data.intake.sellers.length + ' private seller ' + (data.intake.sellers.length === 1 ? 'case' : 'cases') + ' connected by authenticated ownership.' : 'No authenticated seller case is connected yet.'}</p></div><Link href="/sell">Review seller path<ArrowRight /></Link></article>
            </div>
          </section>

          <section className="vb-workspace__section" aria-labelledby="recommendations-title">
            <div className="vb-workspace__section-head"><p>Matches and recommendations</p><h2 id="recommendations-title">Relevant next paths</h2><span>Only opportunities released to your workspace appear here. Internal screening does not create an offer or approval.</span></div>
            <div className="vb-workspace__records">
              {form.recommendations.length ? form.recommendations.map((recommendation) => (
                <article key={recommendation.id}><Sparkles aria-hidden="true" /><div><h3>{recommendation.title}</h3><p>{recommendation.summary || recommendation.status}</p></div>{recommendation.href ? <Link href={recommendation.href}>Review path<ArrowRight /></Link> : <span>{recommendation.status}</span>}</article>
              )) : (
                <article><Sparkles aria-hidden="true" /><div><h3>{activeLane.label} is your current recommendation</h3><p>{activeLane.introduction}</p></div><Link href={activeLane.href}>Review this lane<ArrowRight /></Link></article>
              )}
            </div>
          </section>

          <section className="vb-workspace__section" aria-labelledby="profiles-title">
            <div className="vb-workspace__section-head"><p>Role profiles</p><h2 id="profiles-title">Your criteria and participation controls</h2><span>Each role has its own private criteria, permissions, review status, and history. Matching and outreach are not active from these profiles.</span></div>
            <div className="vb-workspace__records">
              {data.intake.profiles.length ? data.intake.profiles.map((participant) => (
                <article key={participant.id}><ShieldCheck aria-hidden="true" /><div><h3>{PARTICIPANT_ROLE_DEFINITIONS[participant.role].label}</h3><p>{participant.organization_name || participant.display_name || 'Participant profile'} · {participant.status.replaceAll('_', ' ')}{participant.safe_failure_state ? ' · follow-up retry available' : ''}</p></div><Link href={'/workspace/profiles/' + participant.id}>Open profile<ArrowRight /></Link></article>
              )) : (
                <article><ShieldCheck aria-hidden="true" /><div><h3>Private by default</h3><p>Create the first role profile when you are ready to organize criteria for operator review.</p></div><Link href="/workspace/profiles">Choose a role<ArrowRight /></Link></article>
              )}
            </div>
          </section>

          <section id="criteria" className="vb-workspace__section" aria-labelledby="criteria-title">
            <div className="vb-workspace__section-head"><p>Reusable context</p><h2 id="criteria-title">Criteria and current objective</h2><span>Save a concise working context here. Detailed buyer, lender, seller, and capital fields remain in their proper intake workflows.</span></div>
            <div className="vb-workspace__fields">
              <label><span>Current objective</span><input value={form.criteria.objective || ''} maxLength={500} onChange={(event) => setForm({ ...form, criteria: { ...form.criteria, objective: event.target.value } })} placeholder="Example: acquire a duplex in Milwaukee within 90 days" /></label>
              <label><span>Target market or coverage</span><input value={form.criteria.market || ''} maxLength={500} onChange={(event) => setForm({ ...form, criteria: { ...form.criteria, market: event.target.value } })} placeholder="City, state, region, or service area" /></label>
              <label><span>Timing</span><input value={form.criteria.timeline || ''} maxLength={500} onChange={(event) => setForm({ ...form, criteria: { ...form.criteria, timeline: event.target.value } })} placeholder="Now, 30 days, 90 days, or exploring" /></label>
              <label><span>Primary constraint</span><textarea value={form.criteria.constraint || ''} maxLength={500} onChange={(event) => setForm({ ...form, criteria: { ...form.criteria, constraint: event.target.value } })} placeholder="What is preventing the next step?" /></label>
            </div>
          </section>
        </div>

        <aside className="vb-workspace__side">
          <section id="roles" className="vb-workspace__panel" aria-labelledby="roles-title">
            <p>Personalization</p><h2 id="roles-title">Your roles</h2><span>Select every role that reflects how you use VestBlock. These never grant administrative access.</span>
            <div className="vb-workspace__roles">{MEMBER_ROLE_OPTIONS.map((role) => { const active = form.memberRoles.includes(role.value); return <label key={role.value} data-active={active || undefined}><input type="checkbox" checked={active} onChange={() => setForm({ ...form, memberRoles: active ? form.memberRoles.filter((item) => item !== role.value) : [...form.memberRoles, role.value] })} /><span>{active ? <Check aria-hidden="true" /> : null}{role.label}</span></label> })}</div>
          </section>

          <section className="vb-workspace__panel" aria-labelledby="lane-title">
            <p>Current focus</p><h2 id="lane-title">Active lane</h2>
            <div className="vb-workspace__lanes">{Object.values(platformLanes).map((lane) => <button key={lane.id} type="button" aria-pressed={form.activeLane === lane.id} data-active={form.activeLane === lane.id || undefined} onClick={() => setForm({ ...form, activeLane: lane.id })}><span>{lane.label}</span><ArrowRight /></button>)}</div>
          </section>

          <section className="vb-workspace__panel" aria-labelledby="consent-title">
            <p>Consent and visibility</p><h2 id="consent-title">Control how your account is used</h2>
            <label className="vb-workspace__toggle"><span><strong>Eligible partner review</strong><small>Allow your saved criteria to be considered for appropriate private partner routing. This does not make it public.</small></span><Switch aria-label="Allow eligible partner review" checked={form.profileVisibility === 'eligible-partners'} onCheckedChange={(checked) => setForm({ ...form, profileVisibility: checked ? 'eligible-partners' : 'private' })} /></label>
            <label className="vb-workspace__toggle"><span><strong>Optional marketing updates</strong><small>Receive educational and promotional messages. Service and status messages remain separate.</small></span><Switch aria-label="Receive optional marketing updates" checked={form.marketingConsent} onCheckedChange={(checked) => setForm({ ...form, marketingConsent: checked })} /></label>
            <p className="vb-workspace__privacy"><ShieldCheck aria-hidden="true" />Your workspace is private by default. Save changes to update these preferences.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
