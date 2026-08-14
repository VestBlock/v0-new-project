'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardCheck, FileText, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { SellerCaseEvent, SellerCaseRecord } from '@/lib/seller/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']
const PROPERTY_TYPES = ['Single-family','Duplex / triplex / fourplex','Condo','Townhome','Multifamily','Land','Commercial','Other']
const CONDITIONS = ['Move-in ready','Minor updates needed','Significant repairs needed','Major rehabilitation needed','Unsure']
const OCCUPANCIES = ['Owner occupied','Tenant occupied','Vacant','Partially occupied','Unsure']
const TIMELINES = ['As soon as practical','Within 30 days','Within 60 days','Within 3–6 months','Exploring options']
const STEPS = [
  { title: 'Property', detail: 'The asset and its current condition' },
  { title: 'Priorities', detail: 'Your timing and decision factors' },
  { title: 'Contact', detail: 'Private follow-up permissions' },
]
const TRACKING_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid']

type SellPageMarket = { city: string; state: string; stateName: string; regionLabel?: string }
type SellPageProps = { market?: SellPageMarket }
type FormState = {
  sellerName: string; email: string; phone: string; propertyAddress: string; city: string; state: string; postalCode: string
  propertyType: string; bedrooms: string; bathrooms: string; propertyCondition: string; occupancyStatus: string; timelineToSell: string
  reasonForSelling: string; preferredSalePath: string; estimatedValue: string; askingPrice: string; mortgageBalance: string
  liensOrTaxes: string; bestTimeToContact: string; communicationPreference: 'email' | 'phone' | 'either'
  analysisConsent: boolean; contactConsent: boolean; marketingConsent: boolean; sellerNotes: string; attribution: Record<string, string>
}

function emptyForm(market?: SellPageMarket): FormState {
  return {
    sellerName: '', email: '', phone: '', propertyAddress: '', city: market?.city || '', state: market?.stateName || '', postalCode: '',
    propertyType: '', bedrooms: '', bathrooms: '', propertyCondition: '', occupancyStatus: '', timelineToSell: '', reasonForSelling: '',
    preferredSalePath: 'not_sure', estimatedValue: '', askingPrice: '', mortgageBalance: '', liensOrTaxes: '', bestTimeToContact: '',
    communicationPreference: 'either', analysisConsent: false, contactConsent: false, marketingConsent: false, sellerNotes: '', attribution: {},
  }
}

function formFromCase(record: SellerCaseRecord): FormState {
  return {
    sellerName: record.seller_name, email: record.email, phone: record.phone, propertyAddress: record.property_address, city: record.city,
    state: record.state, postalCode: record.postal_code, propertyType: record.property_type,
    bedrooms: record.bedrooms === null ? '' : String(record.bedrooms), bathrooms: record.bathrooms === null ? '' : String(record.bathrooms),
    propertyCondition: record.property_condition, occupancyStatus: record.occupancy_status, timelineToSell: record.timeline_to_sell,
    reasonForSelling: record.reason_for_selling, preferredSalePath: record.preferred_sale_path, estimatedValue: record.estimated_value === null ? '' : String(record.estimated_value),
    askingPrice: record.asking_price === null ? '' : String(record.asking_price), mortgageBalance: record.mortgage_balance === null ? '' : String(record.mortgage_balance),
    liensOrTaxes: record.liens_or_taxes, bestTimeToContact: record.best_time_to_contact, communicationPreference: record.communication_preference,
    analysisConsent: record.analysis_consent, contactConsent: record.contact_consent, marketingConsent: record.marketing_consent,
    sellerNotes: record.seller_notes, attribution: record.attribution || {},
  }
}

function label(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) }
function money(value: number | null) { return value === null ? 'Not provided' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) }
const STORAGE_KEY = 'vestblock-seller-case'

export function SellPage({ market }: SellPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, userProfile, isLoading: authLoading } = useAuth()
  const [form, setForm] = useState<FormState>(() => emptyForm(market))
  const [step, setStep] = useState(0)
  const [record, setRecord] = useState<SellerCaseRecord | null>(null)
  const [events, setEvents] = useState<SellerCaseEvent[]>([])
  const [ownedCases, setOwnedCases] = useState<SellerCaseRecord[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'submit' | 'withdraw' | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const idempotencyKey = useRef(crypto.randomUUID())

  const loadCase = useCallback(async (id: string, token?: string | null, stripPrivateParams = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ id })
      if (token) params.set('token', token)
      const response = await fetch(`/api/seller/cases?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to resume this seller case.')
      setRecord(payload.case)
      setForm(formFromCase(payload.case))
      setEvents(payload.events || [])
      setAccessToken(token || null)
      if (token) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: payload.case.id, token }))
      if (stripPrivateParams) router.replace(window.location.pathname, { scroll: false })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to resume this seller case.' })
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => {
    if (authLoading) return
    const queryId = searchParams.get('case')
    const queryToken = searchParams.get('token')
    if (queryId) {
      const timeout = window.setTimeout(() => void loadCase(queryId, queryToken, true), 0)
      return () => window.clearTimeout(timeout)
    }
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id?: string; token?: string }
        if (parsed.id && parsed.token) {
          const timeout = window.setTimeout(() => void loadCase(parsed.id!, parsed.token), 0)
          return () => window.clearTimeout(timeout)
        }
      } catch { window.localStorage.removeItem(STORAGE_KEY) }
    }
  }, [authLoading, loadCase, searchParams])

  useEffect(() => {
    const attribution: Record<string, string> = {}
    for (const key of TRACKING_PARAMS) {
      const value = searchParams.get(key)
      if (value) attribution[key] = value
    }
    if (Object.keys(attribution).length) {
      const timeout = window.setTimeout(() => setForm((current) => ({ ...current, attribution: { ...current.attribution, ...attribution } })), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [searchParams])

  useEffect(() => {
    if (authLoading || !user) return
    fetch('/api/seller/cases', { cache: 'no-store' }).then(async (response) => ({ ok: response.ok, payload: await response.json() }))
      .then(({ ok, payload }) => { if (ok) setOwnedCases(payload.cases || []) }).catch(() => null)
    if (!record) {
      const timeout = window.setTimeout(() => setForm((current) => ({ ...current, sellerName: current.sellerName || userProfile?.full_name || '', email: current.email || user.email || '' })), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [authLoading, record, user, userProfile?.full_name])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  async function persist(action: 'save_draft' | 'submit' | 'withdraw') {
    if (action === 'save_draft' && !user && !/^\S+@\S+\.\S+$/.test(form.email)) {
      setStep(2)
      setMessage({ tone: 'info', text: 'Add your email to save a private guest draft and return from this device.' })
      return
    }
    setSaving(action === 'save_draft' ? 'draft' : action)
    setMessage(null)
    try {
      const response = await fetch('/api/seller/cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record?.id, accessToken: accessToken || undefined, idempotencyKey: idempotencyKey.current, action, ...form,
          bedrooms: form.bedrooms === '' ? null : Number(form.bedrooms), bathrooms: form.bathrooms === '' ? null : Number(form.bathrooms),
          estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue), askingPrice: form.askingPrice === '' ? null : Number(form.askingPrice),
          mortgageBalance: form.mortgageBalance === '' ? null : Number(form.mortgageBalance), sourcePath: window.location.pathname,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 422) {
          const gaps = payload.completeness?.gaps || []
          if (gaps.some((gap: string) => ['property address','city','state','property type','property condition','occupancy'].includes(gap))) setStep(0)
          else if (gaps.some((gap: string) => ['sale timeline','seller objective'].includes(gap))) setStep(1)
          else setStep(2)
        }
        throw new Error(payload.error || 'Unable to save this seller case.')
      }
      setRecord(payload.case)
      if (payload.case) setForm(formFromCase(payload.case))
      setAccessToken(payload.accessToken || accessToken)
      if (!user && payload.accessToken) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: payload.case.id, token: payload.accessToken }))
      if (user) window.localStorage.removeItem(STORAGE_KEY)
      idempotencyKey.current = crypto.randomUUID()
      setMessage({ tone: 'success', text: action === 'withdraw'
        ? 'This seller case is withdrawn and its VestBlock follow-up has been closed.'
        : payload.operationPending ? payload.message
        : action === 'submit' ? 'Submitted for VestBlock review. This is not an offer, price commitment, buyer match, or closing promise.'
        : payload.duplicate ? 'Your existing case was updated; no duplicate property record was created.'
        : 'Private draft saved. You can return and continue from this device.' })
      if (payload.case?.id) await loadCase(payload.case.id, payload.accessToken || accessToken)
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to save this seller case.' })
    } finally { setSaving(null) }
  }

  function moveStep(current: number, key: string) {
    const delta = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
    if (!delta && key !== 'Home' && key !== 'End') return
    const next = key === 'Home' ? 0 : key === 'End' ? STEPS.length - 1 : (current + delta + STEPS.length) % STEPS.length
    setStep(next)
    window.requestAnimationFrame(() => document.getElementById(`seller-step-${next}`)?.focus())
  }

  const terminal = Boolean(record && ['withdrawn', 'closed', 'declined'].includes(record.status))
  const location = [record?.property_address, record?.city, record?.state].filter(Boolean).join(', ')

  return (
    <div className="vb-hub vb-seller-page">
      <section className="vb-hub__hero vb-seller-hero">
        <div className="vb-section-shell">
          <p className="vb-kicker">Private seller casework</p>
          <h1>Understand the property. Clarify the seller’s priorities.</h1>
          <p>Build one private record around the property, condition, occupancy, timing, and decision factors. VestBlock reviews the file before any next-step conversation; submitting does not create an offer or guarantee a sale.</p>
          <div className="vb-hub__actions"><Button asChild><a href="#seller-intake">Start a property review</a></Button><Button asChild variant="outline"><Link href="/real-estate">See every real estate path</Link></Button></div>
        </div>
      </section>

      <section id="seller-intake" className="vb-capital vb-seller" aria-labelledby="seller-workbench-title">
        <div className="vb-section-shell">
          <div className="vb-section-intro vb-section-intro--split">
            <div><p className="vb-kicker">Seller workspace</p><h2 id="seller-workbench-title">One clear intake. Saved progress. Accountable review.</h2></div>
            <p>Share only what is known. Price estimates are voluntary. Save a private draft, return securely, and see the case history without creating duplicate property records.</p>
          </div>

          {ownedCases.length ? <div className="vb-capital__saved"><div><strong>Your seller cases</strong><span>Resume the same property record.</span></div><div>{ownedCases.map((item) => <button key={item.id} type="button" onClick={() => void loadCase(item.id)}><span>{item.property_address || 'Property draft'}</span><small>{label(item.status)} · {new Date(item.updated_at).toLocaleDateString()}</small></button>)}</div></div> : null}

          <div className="vb-capital__path-tabs vb-seller__steps" role="tablist" aria-label="Seller intake sections">
            {STEPS.map((item, index) => <button key={item.title} id={`seller-step-${index}`} type="button" role="tab" aria-selected={step === index} tabIndex={step === index ? 0 : -1} onClick={() => setStep(index)} onKeyDown={(event) => { if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); moveStep(index, event.key) } }}><span>0{index + 1}</span>{item.title}<small>{item.detail}</small></button>)}
          </div>

          {loading ? <div className="vb-capital__loading"><Loader2 aria-hidden="true" /> Loading your private seller case…</div> : null}
          <div className="vb-capital__workspace">
            <form className="vb-capital__form" onSubmit={(event) => { event.preventDefault(); if (step < 2) setStep(step + 1); else void persist('submit') }} noValidate>
              <div className="vb-capital__form-head"><div><p className="vb-kicker">{STEPS[step].detail}</p><h3>{record ? location || 'Continue this case' : STEPS[step].title}</h3></div>{record ? <span className="vb-capital-status">{label(record.status)}</span> : null}</div>
              {message ? <div role={message.tone === 'error' ? 'alert' : 'status'} className={`vb-capital__message vb-capital__message--${message.tone}`}>{message.text}</div> : null}

              <fieldset disabled={Boolean(saving) || terminal}>
                <legend>{STEPS[step].title}</legend>
                {step === 0 ? <div className="vb-capital__grid">
                  <div className="vb-capital__span"><Label htmlFor="seller-address">Property address *</Label><Input id="seller-address" autoComplete="street-address" value={form.propertyAddress} onChange={(event) => update('propertyAddress', event.target.value)} /></div>
                  <div><Label htmlFor="seller-city">City *</Label><Input id="seller-city" autoComplete="address-level2" value={form.city} onChange={(event) => update('city', event.target.value)} /></div>
                  <div><Label htmlFor="seller-state">State *</Label><select id="seller-state" autoComplete="address-level1" value={form.state} onChange={(event) => update('state', event.target.value)}><option value="">Select state</option>{US_STATES.map((state) => <option key={state}>{state}</option>)}</select></div>
                  <div><Label htmlFor="seller-postal">Postal code</Label><Input id="seller-postal" autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} /></div>
                  <div><Label htmlFor="seller-type">Property type *</Label><select id="seller-type" value={form.propertyType} onChange={(event) => update('propertyType', event.target.value)}><option value="">Select type</option>{PROPERTY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
                  <div><Label htmlFor="seller-bedrooms">Bedrooms</Label><Input id="seller-bedrooms" type="number" min="0" inputMode="decimal" value={form.bedrooms} onChange={(event) => update('bedrooms', event.target.value)} /></div>
                  <div><Label htmlFor="seller-bathrooms">Bathrooms</Label><Input id="seller-bathrooms" type="number" min="0" step="0.5" inputMode="decimal" value={form.bathrooms} onChange={(event) => update('bathrooms', event.target.value)} /></div>
                  <div><Label htmlFor="seller-condition">Current condition *</Label><select id="seller-condition" value={form.propertyCondition} onChange={(event) => update('propertyCondition', event.target.value)}><option value="">Select condition</option>{CONDITIONS.map((item) => <option key={item}>{item}</option>)}</select></div>
                  <div><Label htmlFor="seller-occupancy">Occupancy *</Label><select id="seller-occupancy" value={form.occupancyStatus} onChange={(event) => update('occupancyStatus', event.target.value)}><option value="">Select occupancy</option>{OCCUPANCIES.map((item) => <option key={item}>{item}</option>)}</select></div>
                </div> : null}

                {step === 1 ? <div className="vb-capital__grid">
                  <div><Label htmlFor="seller-timeline">Preferred timeline *</Label><select id="seller-timeline" value={form.timelineToSell} onChange={(event) => update('timelineToSell', event.target.value)}><option value="">Select timeline</option>{TIMELINES.map((item) => <option key={item}>{item}</option>)}</select></div>
                  <div><Label htmlFor="seller-path">Current path preference</Label><select id="seller-path" value={form.preferredSalePath} onChange={(event) => update('preferredSalePath', event.target.value)}><option value="not_sure">Review the available paths</option><option value="direct_sale">Direct sale review</option><option value="market_assisted">Market-assisted review</option><option value="structured_terms">Structured terms review</option><option value="preparation_first">Prepare before a sale decision</option></select></div>
                  <div className="vb-capital__span"><Label htmlFor="seller-reason">What would a useful outcome address? *</Label><Textarea id="seller-reason" rows={4} placeholder="For example: timing, repairs, an inherited property, tenant considerations, or uncertainty about the next step." value={form.reasonForSelling} onChange={(event) => update('reasonForSelling', event.target.value)} /></div>
                  <div><Label htmlFor="seller-value">Estimated property value (optional)</Label><Input id="seller-value" type="number" min="0" inputMode="decimal" value={form.estimatedValue} onChange={(event) => update('estimatedValue', event.target.value)} /></div>
                  <div><Label htmlFor="seller-asking">Price expectation (optional)</Label><Input id="seller-asking" type="number" min="0" inputMode="decimal" value={form.askingPrice} onChange={(event) => update('askingPrice', event.target.value)} /></div>
                  <div><Label htmlFor="seller-mortgage">Approximate mortgage balance (optional)</Label><Input id="seller-mortgage" type="number" min="0" inputMode="decimal" value={form.mortgageBalance} onChange={(event) => update('mortgageBalance', event.target.value)} /></div>
                  <div><Label htmlFor="seller-liens">Known liens, taxes, or title questions</Label><Input id="seller-liens" value={form.liensOrTaxes} onChange={(event) => update('liensOrTaxes', event.target.value)} /></div>
                  <div className="vb-capital__span"><Label htmlFor="seller-notes">Other property or decision context</Label><Textarea id="seller-notes" rows={4} value={form.sellerNotes} onChange={(event) => update('sellerNotes', event.target.value)} /></div>
                </div> : null}

                {step === 2 ? <div className="vb-capital__grid">
                  <div><Label htmlFor="seller-name">Full name *</Label><Input id="seller-name" autoComplete="name" value={form.sellerName} onChange={(event) => update('sellerName', event.target.value)} /></div>
                  <div><Label htmlFor="seller-email">Email *</Label><Input id="seller-email" type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></div>
                  <div><Label htmlFor="seller-phone">Phone *</Label><Input id="seller-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></div>
                  <div><Label htmlFor="seller-best-time">Best time to contact</Label><Input id="seller-best-time" placeholder="Morning, afternoon, evening…" value={form.bestTimeToContact} onChange={(event) => update('bestTimeToContact', event.target.value)} /></div>
                  <div className="vb-capital__span"><Label htmlFor="seller-contact-method">Preferred contact method</Label><select id="seller-contact-method" value={form.communicationPreference} onChange={(event) => update('communicationPreference', event.target.value as FormState['communicationPreference'])}><option value="email">Email</option><option value="phone">Phone</option><option value="either">Either</option></select></div>
                  <div className="vb-capital__span vb-capital__permissions">
                    <label><input type="checkbox" checked={form.analysisConsent} onChange={(event) => update('analysisConsent', event.target.checked)} /><span><strong>Required to submit:</strong> I authorize VestBlock to analyze the property and seller information I provide for a private sale-path review. I understand this is not an appraisal, legal opinion, or offer.</span></label>
                    <label><input type="checkbox" checked={form.contactConsent} onChange={(event) => update('contactConsent', event.target.checked)} /><span><strong>Required to submit:</strong> I authorize VestBlock to contact me about this case using my selected method. I understand no buyer, price, financing, closing date, or sale outcome is promised.</span></label>
                    <label><input type="checkbox" checked={form.marketingConsent} onChange={(event) => update('marketingConsent', event.target.checked)} /><span>I would like optional VestBlock news and educational updates. This is not required to save, submit, or receive case-related contact.</span></label>
                  </div>
                </div> : null}
              </fieldset>

              <div className="vb-capital__actions">
                {step > 0 ? <Button type="button" variant="outline" className="border-black/20 bg-[#ecece3] text-[#151911] hover:bg-[#dfe1d2] hover:text-[#151911]" onClick={() => setStep(step - 1)} disabled={Boolean(saving)}>Previous</Button> : null}
                <Button type="button" variant="outline" className="border-black/20 bg-[#ecece3] text-[#151911] hover:bg-[#dfe1d2] hover:text-[#151911] disabled:bg-[#e2e2d7] disabled:text-[#4d5149] disabled:opacity-70" onClick={() => void persist('save_draft')} disabled={Boolean(saving) || terminal}>{saving === 'draft' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />} Save private draft</Button>
                {!terminal ? <Button type="submit" disabled={Boolean(saving)}>{step < 2 ? <>Continue</> : <>{saving === 'submit' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />} Submit for review</>}</Button> : null}
                {record && !terminal ? <Button type="button" variant="ghost" onClick={() => void persist('withdraw')} disabled={Boolean(saving)}>Withdraw case</Button> : null}
              </div>
              <p className="vb-capital__auth-note">{terminal ? `This ${label(record!.status)} case is read-only. ` : null}{user ? `Owned by ${user.email}.` : <>Guest drafts use a private high-entropy token stored on this device. <Link href="/join?next=%2Fsell">Create an account</Link> to claim the record across devices.</>}</p>
            </form>

            <aside className="vb-capital__review" aria-live="polite"><div className="vb-capital__review-sticky">
              <p className="vb-kicker">Case record</p>
              {!record ? <div className="vb-capital__empty"><FileText aria-hidden="true" /><h3>New seller case</h3><p>No saved case is selected. Save this intake as a private draft, or submit it when the required property, priority, contact, and permission fields are accurate.</p></div> : <>
                <div className="vb-capital__score"><span>{record.completeness_score}</span><div><strong>{label(record.status)}</strong><small>Intake completeness—not sale probability</small></div></div>
                <p>{location}</p>
                <div className="vb-capital__review-block"><h4>Submitted context</h4><ul><li>{record.property_type || 'Property type pending'} · {record.property_condition || 'condition pending'}</li><li>{record.occupancy_status || 'Occupancy pending'} · {record.timeline_to_sell || 'timeline pending'}</li><li>Estimated value: {money(record.estimated_value)}</li><li>Price expectation: {money(record.asking_price)}</li></ul></div>
                <div className="vb-capital__review-block"><h4>Information still needed</h4>{record.completeness_gaps.length ? <ul>{record.completeness_gaps.map((item) => <li key={item}>{item}</li>)}</ul> : <p>The standard intake is complete. The VestBlock team may ask focused follow-up questions.</p>}</div>
                {events.length ? <div className="vb-capital__timeline"><h4>Status history</h4><ol>{events.slice().reverse().map((event) => <li key={event.id}><span>{label(event.event_type)}</span><small>{new Date(event.created_at).toLocaleString()}</small>{event.note ? <p>{event.note}</p> : null}</li>)}</ol></div> : null}
              </>}
              <div className="vb-capital__disclaimer"><ShieldCheck aria-hidden="true" /><p><strong>Review boundary</strong>VestBlock organizes the case and may request more information. Offers, buyers, terms, financing, property condition, title, and closing remain subject to separate review and independent decisions.</p></div>
            </div></aside>
          </div>
        </div>
      </section>
    </div>
  )
}
