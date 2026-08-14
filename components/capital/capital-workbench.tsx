'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, ClipboardCheck, FileText, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { capitalPathCatalog, capitalPathFromSlug, capitalPaths } from '@/lib/capital/catalog'
import type { CapitalCaseEvent, CapitalCaseRecord, CapitalCaseType } from '@/lib/capital/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type FormState = {
  fullName: string
  email: string
  phone: string
  organizationName: string
  amountRequested: string
  purpose: string
  timing: string
  geography: string
  communicationPreference: 'email' | 'phone' | 'either'
  analysisConsent: boolean
  providerSharingConsent: boolean
  marketingConsent: boolean
  intakeData: Record<string, string>
  availableDocuments: string[]
}

const emptyForm: FormState = {
  fullName: '', email: '', phone: '', organizationName: '', amountRequested: '', purpose: '', timing: '', geography: '',
  communicationPreference: 'email', analysisConsent: false, providerSharingConsent: false, marketingConsent: false,
  intakeData: {}, availableDocuments: [],
}

function labelCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function formFromCase(record: CapitalCaseRecord): FormState {
  return {
    fullName: record.full_name || '', email: record.email || '', phone: record.phone || '', organizationName: record.organization_name || '',
    amountRequested: record.amount_requested === null ? '' : String(record.amount_requested), purpose: record.purpose || '', timing: record.timing || '',
    geography: record.geography || '', communicationPreference: record.communication_preference, analysisConsent: record.analysis_consent,
    providerSharingConsent: record.provider_sharing_consent, marketingConsent: record.marketing_consent,
    intakeData: Object.fromEntries(Object.entries(record.intake_data || {}).map(([key, value]) => [key, value === null ? '' : String(value)])),
    availableDocuments: record.available_documents || [],
  }
}

function caseStorageKey(caseType: CapitalCaseType) {
  return `vestblock-capital-case:${caseType}`
}

function caseTone(status: string) {
  if (['approved', 'ready_for_provider_review'].includes(status)) return 'vb-capital-status--positive'
  if (['declined', 'withdrawn'].includes(status)) return 'vb-capital-status--negative'
  if (['needs_information', 'readiness_plan'].includes(status)) return 'vb-capital-status--attention'
  return ''
}

export function CapitalWorkbench() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, userProfile, isLoading: authLoading } = useAuth()
  const selectedPath = capitalPathFromSlug(searchParams.get('path'))
  const [form, setForm] = useState<FormState>(emptyForm)
  const [record, setRecord] = useState<CapitalCaseRecord | null>(null)
  const [events, setEvents] = useState<CapitalCaseEvent[]>([])
  const [ownedCases, setOwnedCases] = useState<CapitalCaseRecord[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const idempotencyKey = useRef<string>(crypto.randomUUID())

  const loadCase = useCallback(async (id: string, token?: string | null, clearPrivateResumeParams = false) => {
    setLoadingRecord(true)
    setMessage(null)
    try {
      const params = new URLSearchParams({ id })
      if (token) params.set('token', token)
      const response = await fetch(`/api/capital/cases?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to resume this Capital case.')
      setRecord(payload.case)
      setForm(formFromCase(payload.case))
      setEvents(payload.events || [])
      setAccessToken(token || null)
      const path = capitalPathCatalog[payload.case.case_type as CapitalCaseType]
      if (token && path) {
        window.localStorage.setItem(caseStorageKey(path.id), JSON.stringify({ id: payload.case.id, token }))
      }
      if (path && (selectedPath.id !== path.id || clearPrivateResumeParams)) {
        router.replace(`/capital?path=${path.slug}#capital-intake`, { scroll: false })
      }
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to resume this Capital case.' })
    } finally {
      setLoadingRecord(false)
    }
  }, [router, selectedPath.id])

  useEffect(() => {
    if (authLoading) return
    const queryId = searchParams.get('case')
    const queryToken = searchParams.get('token')
    if (queryId) {
      const timeout = window.setTimeout(() => void loadCase(queryId, queryToken, true), 0)
      return () => window.clearTimeout(timeout)
    }
    if (!user) {
      const saved = window.localStorage.getItem(caseStorageKey(selectedPath.id))
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { id?: string; token?: string }
          if (parsed.id && parsed.token) {
            const timeout = window.setTimeout(() => void loadCase(parsed.id!, parsed.token), 0)
            return () => window.clearTimeout(timeout)
          }
        } catch { window.localStorage.removeItem(caseStorageKey(selectedPath.id)) }
      }
    }
  }, [authLoading, loadCase, searchParams, selectedPath.id, user])

  useEffect(() => {
    if (authLoading || !user) return
    fetch('/api/capital/cases', { cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, payload: await response.json() }))
      .then(({ ok, payload }) => { if (ok) setOwnedCases(payload.cases || []) })
      .catch(() => null)
  }, [authLoading, user, record?.updated_at])

  useEffect(() => {
    if (!record) {
      const timeout = window.setTimeout(() => setForm((current) => ({
          ...emptyForm,
          fullName: current.fullName || userProfile?.full_name || '',
          email: current.email || user?.email || '',
        })), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [record, selectedPath.id, user?.email, userProfile?.full_name])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const updateQuestion = (key: string, value: string) => setForm((current) => ({ ...current, intakeData: { ...current.intakeData, [key]: value } }))

  const completedDocuments = useMemo(() => new Set(form.availableDocuments), [form.availableDocuments])

  async function persist(action: 'save_draft' | 'submit') {
    setSaving(action === 'submit' ? 'submit' : 'draft')
    setMessage(null)
    try {
      const response = await fetch('/api/capital/cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record?.id, accessToken: accessToken || undefined, idempotencyKey: idempotencyKey.current,
          caseType: selectedPath.id, action, ...form,
          amountRequested: form.amountRequested === '' ? null : Number(form.amountRequested),
          intakeData: Object.fromEntries(Object.entries(form.intakeData).map(([key, value]) => {
            const question = selectedPath.questions.find((item) => item.key === key)
            return [key, question?.type === 'number' && value !== '' ? Number(value) : value]
          })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.errors?.join(' ') || payload.error || 'Unable to save this Capital case.')
      setRecord(payload.case)
      setForm(formFromCase(payload.case))
      setAccessToken(payload.accessToken || accessToken)
      if (!user && payload.accessToken) {
        window.localStorage.setItem(caseStorageKey(selectedPath.id), JSON.stringify({ id: payload.case.id, token: payload.accessToken }))
      }
      idempotencyKey.current = crypto.randomUUID()
      setMessage({
        tone: 'success',
        text: payload.operationPending
          ? payload.message || 'Your case is safely saved. VestBlock will follow up once the next review step is available.'
          : action === 'submit'
          ? 'Submitted. The VestBlock team will review your case; this is not a provider approval or application submission.'
          : payload.duplicate ? 'Your existing case was updated—no duplicate record was created.' : 'Draft saved. You can return and continue from this device.',
      })
      await loadCase(payload.case.id, payload.accessToken || accessToken)
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to save this Capital case.' })
    } finally {
      setSaving(null)
    }
  }

  function choosePath(slug: string) {
    setRecord(null)
    setEvents([])
    setAccessToken(null)
    setForm({ ...emptyForm, fullName: userProfile?.full_name || '', email: user?.email || '' })
    setMessage(null)
    router.replace(`/capital?path=${slug}#capital-intake`)
  }

  function movePathFocus(currentIndex: number, key: string) {
    const delta = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
    if (!delta && key !== 'Home' && key !== 'End') return
    const nextIndex = key === 'Home' ? 0 : key === 'End' ? capitalPaths.length - 1 : (currentIndex + delta + capitalPaths.length) % capitalPaths.length
    choosePath(capitalPaths[nextIndex].slug)
    window.requestAnimationFrame(() => document.getElementById(`capital-path-${capitalPaths[nextIndex].id}`)?.focus())
  }

  const readiness = record
  const submitted = record && record.status !== 'draft'

  return (
    <section id="capital-intake" className="vb-capital" aria-labelledby="capital-workbench-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <div><p className="vb-kicker">Capital casework</p><h2 id="capital-workbench-title">Choose the objective. Build one accountable file.</h2></div>
          <p>Explore every path freely. Save a private draft as a guest or sign in to keep every Capital case in one account. VestBlock reviews before any controlled provider handoff.</p>
        </div>

        {ownedCases.length ? (
          <div className="vb-capital__saved" aria-label="Your saved Capital cases">
            <div><strong>Your Capital cases</strong><span>Resume the exact record—do not start over.</span></div>
            <div>
              {ownedCases.map((item) => (
                <button key={item.id} type="button" onClick={() => void loadCase(item.id)}>
                  <span>{capitalPathCatalog[item.case_type].shortTitle}</span><small>{labelCase(item.status)} · {new Date(item.updated_at).toLocaleDateString()}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="vb-capital__path-tabs" role="tablist" aria-label="Capital paths">
          {capitalPaths.map((path, index) => (
            <button key={path.id} id={`capital-path-${path.id}`} type="button" role="tab" aria-selected={selectedPath.id === path.id} tabIndex={selectedPath.id === path.id ? 0 : -1} onClick={() => choosePath(path.slug)} onKeyDown={(event) => {
              if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                movePathFocus(index, event.key)
              }
            }}>
              <span>0{index + 1}</span>{path.shortTitle}
            </button>
          ))}
        </div>

        <div className="vb-capital__brief">
          <div><p className="vb-kicker">Selected path</p><h3>{selectedPath.title}</h3><p>{selectedPath.who}</p></div>
          <dl>
            <div><dt>Information required</dt><dd>{selectedPath.information}</dd></div>
            <div><dt>What VestBlock does</dt><dd>{selectedPath.vestblock}</dd></div>
            <div><dt>What the provider decides</dt><dd>{selectedPath.provider}</dd></div>
            <div><dt>What readiness means</dt><dd>{selectedPath.readiness}</dd></div>
            <div><dt>After submission</dt><dd>{selectedPath.after}</dd></div>
            <div><dt>Not guaranteed</dt><dd>{selectedPath.boundary}</dd></div>
          </dl>
        </div>

        {loadingRecord ? <div className="vb-capital__loading"><Loader2 aria-hidden="true" /> Loading your private case…</div> : null}

        <div className="vb-capital__workspace">
          <form className="vb-capital__form" onSubmit={(event) => { event.preventDefault(); void persist('submit') }} noValidate>
            <div className="vb-capital__form-head">
              <div><p className="vb-kicker">Private structured intake</p><h3>{record ? 'Continue this case' : 'Start the case'}</h3></div>
              {record ? <span className={cn('vb-capital-status', caseTone(record.status))}>{labelCase(record.status)}</span> : null}
            </div>

            {message ? <div role={message.tone === 'error' ? 'alert' : 'status'} className={`vb-capital__message vb-capital__message--${message.tone}`}>{message.text}</div> : null}

            <fieldset disabled={Boolean(saving)}>
              <legend>Contact and objective</legend>
              <div className="vb-capital__grid">
                <div><Label htmlFor="capital-name">Full name *</Label><Input id="capital-name" autoComplete="name" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} /></div>
                <div><Label htmlFor="capital-email">Email *</Label><Input id="capital-email" type="email" autoComplete="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} /></div>
                <div><Label htmlFor="capital-phone">Phone</Label><Input id="capital-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /></div>
                <div><Label htmlFor="capital-org">Business / organization *</Label><Input id="capital-org" autoComplete="organization" value={form.organizationName} onChange={(event) => updateField('organizationName', event.target.value)} /></div>
                <div><Label htmlFor="capital-amount">Amount or capital range *</Label><Input id="capital-amount" type="number" min="0" inputMode="decimal" value={form.amountRequested} onChange={(event) => updateField('amountRequested', event.target.value)} /></div>
                <div><Label htmlFor="capital-timing">Timing *</Label><Input id="capital-timing" placeholder="Now, 30 days, this quarter…" value={form.timing} onChange={(event) => updateField('timing', event.target.value)} /></div>
                <div className="vb-capital__span"><Label htmlFor="capital-geography">State, market, or coverage *</Label><Input id="capital-geography" value={form.geography} onChange={(event) => updateField('geography', event.target.value)} /></div>
                <div className="vb-capital__span"><Label htmlFor="capital-purpose">Purpose and intended outcome *</Label><Textarea id="capital-purpose" rows={4} value={form.purpose} onChange={(event) => updateField('purpose', event.target.value)} /></div>
              </div>
            </fieldset>

            <fieldset disabled={Boolean(saving)}>
              <legend>{selectedPath.title} details</legend>
              <div className="vb-capital__grid">
                {selectedPath.questions.map((question) => (
                  <div key={question.key} className={question.type === 'textarea' ? 'vb-capital__span' : undefined}>
                    <Label htmlFor={`capital-${question.key}`}>{question.label}{question.required ? ' *' : ''}</Label>
                    {question.type === 'select' ? (
                      <select id={`capital-${question.key}`} value={form.intakeData[question.key] || ''} onChange={(event) => updateQuestion(question.key, event.target.value)}>
                        <option value="">Select one</option>{question.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : question.type === 'textarea' ? (
                      <Textarea id={`capital-${question.key}`} rows={4} value={form.intakeData[question.key] || ''} onChange={(event) => updateQuestion(question.key, event.target.value)} />
                    ) : (
                      <Input id={`capital-${question.key}`} type={question.type === 'number' ? 'number' : 'text'} min={question.type === 'number' ? 0 : undefined} placeholder={question.placeholder} value={form.intakeData[question.key] || ''} onChange={(event) => updateQuestion(question.key, event.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={Boolean(saving)}>
              <legend>Supporting-document readiness</legend>
              <p className="vb-capital__field-help">Mark only records that are available now. Do not upload SSNs, full account numbers, or sensitive documents here.</p>
              <div className="vb-capital__checklist">
                {selectedPath.requiredDocuments.map((document) => (
                  <label key={document}><input type="checkbox" checked={completedDocuments.has(document)} onChange={(event) => updateField('availableDocuments', event.target.checked ? [...form.availableDocuments, document] : form.availableDocuments.filter((item) => item !== document))} /><span><Check aria-hidden="true" />{document}</span></label>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={Boolean(saving)}>
              <legend>Permission and follow-up</legend>
              <div className="vb-capital__permissions">
                <label><input type="checkbox" checked={form.analysisConsent} onChange={(event) => updateField('analysisConsent', event.target.checked)} /><span><strong>Required to submit:</strong> I authorize VestBlock to analyze the information I provide and create readiness feedback. I understand this is not financial, legal, tax, or provider advice.</span></label>
                <label><input type="checkbox" checked={form.providerSharingConsent} onChange={(event) => updateField('providerSharingConsent', event.target.checked)} /><span>After VestBlock review, I allow this case to be considered for controlled sharing with an appropriate provider. This does not authorize automatic applications.</span></label>
                <label><input type="checkbox" checked={form.marketingConsent} onChange={(event) => updateField('marketingConsent', event.target.checked)} /><span>I would like optional VestBlock updates. This is not required for analysis or review.</span></label>
                <div><Label htmlFor="capital-contact">Preferred contact</Label><select id="capital-contact" value={form.communicationPreference} onChange={(event) => updateField('communicationPreference', event.target.value as FormState['communicationPreference'])}><option value="email">Email</option><option value="phone">Phone</option><option value="either">Either</option></select></div>
              </div>
            </fieldset>

            <div className="vb-capital__actions">
              <Button type="button" variant="outline" onClick={() => void persist('save_draft')} disabled={Boolean(saving)}>
                {saving === 'draft' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />} Save private draft
              </Button>
              <Button type="submit" disabled={Boolean(saving)}>
                {saving === 'submit' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />} Submit for VestBlock review
              </Button>
            </div>
            <p className="vb-capital__auth-note">{user ? `Saved to ${user.email}.` : <>Guest drafts continue on this device with a private token. <Link href="/join?next=%2Fcapital">Create an account</Link> for account-based continuity.</>}</p>
          </form>

          <aside className="vb-capital__review" aria-live="polite">
            <div className="vb-capital__review-sticky">
              <p className="vb-kicker">Readiness and case status</p>
              {!readiness ? (
                <div className="vb-capital__empty"><FileText aria-hidden="true" /><h3>No saved case yet</h3><p>Save a draft to calculate current completeness and retain the record. Submit only when the required facts are accurate.</p></div>
              ) : (
                <>
                  <div className="vb-capital__score"><span>{readiness.readiness_score}</span><div><strong>{labelCase(readiness.readiness_tier)}</strong><small>Readiness score—not approval probability</small></div></div>
                  <p>{readiness.readiness_feedback?.summary}</p>
                  <div className="vb-capital__review-block"><h4>Next preparation</h4><ul>{readiness.readiness_feedback?.nextSteps?.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  <div className="vb-capital__review-block"><h4>Missing documents</h4>{readiness.missing_documents.length ? <ul>{readiness.missing_documents.map((item) => <li key={item}>{item}</li>)}</ul> : <p>The stated checklist is complete. An operator or provider may request additional records.</p>}</div>
                  <div className="vb-capital__review-block"><h4>Provider review criteria</h4><ul>{selectedPath.providerCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  {events.length ? <div className="vb-capital__timeline"><h4>Status history</h4><ol>{events.slice().reverse().map((event) => <li key={event.id}><span>{labelCase(event.event_type)}</span><small>{new Date(event.created_at).toLocaleString()}</small>{event.note ? <p>{event.note}</p> : null}</li>)}</ol></div> : null}
                  {submitted ? <Button asChild className="w-full"><Link href={selectedPath.nextStepHref}>{selectedPath.nextStepLabel}<ArrowRight aria-hidden="true" /></Link></Button> : null}
                </>
              )}
              <div className="vb-capital__disclaimer"><ShieldCheck aria-hidden="true" /><p><strong>Decision boundary</strong>{selectedPath.boundary}</p></div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
