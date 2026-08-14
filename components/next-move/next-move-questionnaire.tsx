"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Download, LockKeyhole, Mail, ShieldCheck } from "lucide-react"
import type { NextMoveAnswers, NextMoveFocus, NextMoveRoadmap } from "@/lib/next-move/types"
import { nextMoveFocuses } from "@/lib/next-move/types"
import { useAuth } from "@/contexts/auth-context"

const focusOptions: Array<{ value: NextMoveFocus; label: string; detail: string; path: string }> = [
  { value: "business-funding", label: "Prepare for business funding", detail: "Organize the request, documents, and timing.", path: "Capital" },
  { value: "real-estate-funding", label: "Prepare property funding", detail: "Structure a property-specific capital scenario.", path: "Capital" },
  { value: "grants", label: "Explore grant preparation", detail: "Define the project and verify program fit.", path: "Capital" },
  { value: "business-credit", label: "Build business-credit readiness", detail: "Sequence foundations and selective applications.", path: "Capital" },
  { value: "sell-property", label: "Review a property sale path", detail: "Organize property, condition, timing, and outcome.", path: "Real Estate" },
  { value: "buy-property", label: "Prepare to acquire property", detail: "Define a buy box and decision rules.", path: "Real Estate" },
  { value: "fund-deal", label: "Fund an active deal", detail: "Prepare economics, evidence, and capital needs.", path: "Real Estate" },
  { value: "business-acquisition", label: "Explore a business acquisition", detail: "Organize criteria, diligence, and capital preparation.", path: "Real Estate" },
  { value: "builder-developer", label: "Route a builder or development project", detail: "Create a project-fit brief for review.", path: "Real Estate" },
  { value: "improve-credit", label: "Improve credit readiness", detail: "Start with a free report review and roadmap.", path: "Opportunity" },
  { value: "increase-income", label: "Create an income path", detail: "Match a testable direction to time and capacity.", path: "Opportunity" },
  { value: "start-business", label: "Start a business", detail: "Move from offer validation to operating foundations.", path: "Opportunity" },
  { value: "grow-business", label: "Grow an existing business", detail: "Find the constraint and choose a measurable next action.", path: "Opportunity" },
  { value: "visibility", label: "Improve visibility or lead capture", detail: "Review discovery, trust, response, and conversion.", path: "Opportunity" },
]

const emptyAnswers: NextMoveAnswers = {
  firstName: "", email: "", phone: "", focus: "business-funding", timeline: "exploring", position: "starting",
  creditRange: "prefer-not-to-say", weeklyTime: "3-7", mainObstacle: "", goalDetails: "", requestFollowUp: false,
  analysisConsent: true, marketingConsent: false,
}

export function NextMoveQuestionnaire({ initialFocus }: { initialFocus?: NextMoveFocus }) {
  const { isAuthenticated, user } = useAuth()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<NextMoveAnswers>({ ...emptyAnswers, focus: initialFocus || emptyAnswers.focus })
  const [roadmap, setRoadmap] = useState<NextMoveRoadmap | null>(null)
  const [token, setToken] = useState("")
  const [confirmationAccepted, setConfirmationAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [draftReady, setDraftReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const applyDraft = (value: unknown) => {
      if (!value || typeof value !== "object" || cancelled) return
      const draft = value as Record<string, unknown>
      setAnswers((current) => ({
        ...current,
        focus: initialFocus || (typeof draft.focus === "string" && nextMoveFocuses.includes(draft.focus as NextMoveFocus) ? draft.focus as NextMoveFocus : current.focus),
        timeline: ["now", "30-days", "90-days", "exploring"].includes(String(draft.timeline)) ? draft.timeline as NextMoveAnswers["timeline"] : current.timeline,
        position: ["starting", "preparing", "active", "stalled"].includes(String(draft.position)) ? draft.position as NextMoveAnswers["position"] : current.position,
        creditRange: ["unknown", "below-580", "580-669", "670-739", "740-plus", "prefer-not-to-say"].includes(String(draft.creditRange)) ? draft.creditRange as NextMoveAnswers["creditRange"] : current.creditRange,
        weeklyTime: ["under-3", "3-7", "8-plus"].includes(String(draft.weeklyTime)) ? draft.weeklyTime as NextMoveAnswers["weeklyTime"] : current.weeklyTime,
        mainObstacle: typeof draft.mainObstacle === "string" ? draft.mainObstacle.slice(0, 500) : current.mainObstacle,
        goalDetails: typeof draft.goalDetails === "string" ? draft.goalDetails.slice(0, 1200) : current.goalDetails,
        requestFollowUp: typeof draft.requestFollowUp === "boolean" ? draft.requestFollowUp : current.requestFollowUp,
      }))
      if (typeof draft.step === "number") setStep(Math.max(0, Math.min(2, Math.trunc(draft.step))))
    }

    try {
      const local = window.localStorage.getItem("vestblock:next-move-draft")
      if (local) applyDraft(JSON.parse(local))
    } catch {
      // A disabled or invalid browser store must never block the questionnaire.
    }

    if (!isAuthenticated) {
      const readyTimer = window.setTimeout(() => {
        if (!cancelled) setDraftReady(true)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(readyTimer)
      }
    }

    void fetch("/api/workspace", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => applyDraft(payload?.workspace?.questionnaireProgress))
      .finally(() => { if (!cancelled) setDraftReady(true) })

    return () => { cancelled = true }
  }, [initialFocus, isAuthenticated, user?.id])

  useEffect(() => {
    if (!draftReady || step >= 3) return
    const draft = {
      step,
      focus: answers.focus,
      timeline: answers.timeline,
      position: answers.position,
      creditRange: answers.creditRange,
      weeklyTime: answers.weeklyTime,
      mainObstacle: answers.mainObstacle,
      goalDetails: answers.goalDetails || "",
      requestFollowUp: answers.requestFollowUp,
    }
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem("vestblock:next-move-draft", JSON.stringify(draft)) } catch { /* Optional continuity only. */ }
      if (isAuthenticated) {
        void fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionnaireProgress: draft }) })
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [answers.creditRange, answers.focus, answers.goalDetails, answers.mainObstacle, answers.position, answers.requestFollowUp, answers.timeline, answers.weeklyTime, draftReady, isAuthenticated, step])

  const update = <K extends keyof NextMoveAnswers>(key: K, value: NextMoveAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }))

  const next = () => {
    if (step === 0 && !answers.focus) return setError("Choose the outcome you want to work toward.")
    if (step === 1 && answers.mainObstacle.trim().length < 3) return setError("Tell us the main obstacle so the roadmap can prioritize it.")
    setError("")
    setStep((current) => Math.min(2, current + 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const search = new URLSearchParams(window.location.search)
      const attribution = Object.fromEntries([...search.entries()].filter(([key]) => key.startsWith("utm_")))
      attribution.referrer = document.referrer
      attribution.landing_path = `${window.location.pathname}${window.location.search}`
      const response = await fetch("/api/next-move", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, attribution, website: "" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Your roadmap could not be prepared.")
      setRoadmap(data.roadmap)
      setToken(data.lifecycleToken)
      setConfirmationAccepted(Boolean(data.confirmationAccepted))
      setStep(3)
      try { window.localStorage.removeItem("vestblock:next-move-draft") } catch { /* Storage is optional. */ }
      if (isAuthenticated) void fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionnaireProgress: {} }) })
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your roadmap could not be prepared. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const download = () => {
    if (!roadmap) return
    const blob = new Blob([JSON.stringify({ roadmap, answers: { focus: answers.focus, timeline: answers.timeline, position: answers.position } }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "vestblock-next-move-roadmap.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="vb-next-move">
      <div className="vb-next-move__shell">
        {step < 3 ? (
          <>
            <aside className="vb-next-move__intro">
              <p className="vb-kicker">Free Next-Move Questionnaire</p>
              <h1>Start with the decision in front of you.</h1>
              <p>Answer a few focused questions. VestBlock will return an educational analysis and an ordered roadmap, then connect you to the existing free credit and roadmap system or another verified route when appropriate.</p>
              <div className="vb-next-move__privacy"><LockKeyhole aria-hidden="true" /><span>Do not enter a Social Security number, password, full account number, or complete credit-report data here.</span></div>
            </aside>

            <form className="vb-questionnaire" onSubmit={submit}>
              <div className="vb-questionnaire__progress" aria-label={`Questionnaire step ${step + 1} of 3`}><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
              <p className="vb-questionnaire__step">0{step + 1} / 03</p>

              {step === 0 && <fieldset><legend>What are you trying to accomplish?</legend><p>Choose the closest outcome. The roadmap can connect more than one path.</p><div className="vb-focus-grid">{focusOptions.map((option) => <label key={option.value} data-selected={answers.focus === option.value || undefined}><input type="radio" name="focus" value={option.value} checked={answers.focus === option.value} onChange={() => update("focus", option.value)} /><span>{option.path}</span><strong>{option.label}</strong><small>{option.detail}</small></label>)}</div></fieldset>}

              {step === 1 && <fieldset><legend>What does the starting position look like?</legend><p>This is routing context—not an application or underwriting decision.</p><div className="vb-form-grid">
                <label><span>Desired timeline</span><select value={answers.timeline} onChange={(event) => update("timeline", event.target.value as NextMoveAnswers["timeline"])}><option value="now">I need to act now</option><option value="30-days">Within 30 days</option><option value="90-days">Within 90 days</option><option value="exploring">I am exploring</option></select></label>
                <label><span>Current position</span><select value={answers.position} onChange={(event) => update("position", event.target.value as NextMoveAnswers["position"])}><option value="starting">Starting from the beginning</option><option value="preparing">Preparing information</option><option value="active">Working on it now</option><option value="stalled">Started but stalled</option></select></label>
                <label><span>Credit range, if known</span><select value={answers.creditRange} onChange={(event) => update("creditRange", event.target.value as NextMoveAnswers["creditRange"])}><option value="prefer-not-to-say">Prefer not to say</option><option value="unknown">I do not know</option><option value="below-580">Below 580</option><option value="580-669">580–669</option><option value="670-739">670–739</option><option value="740-plus">740+</option></select><small>Optional context. This is not a credit pull.</small></label>
                <label><span>Time available each week</span><select value={answers.weeklyTime} onChange={(event) => update("weeklyTime", event.target.value as NextMoveAnswers["weeklyTime"])}><option value="under-3">Under 3 hours</option><option value="3-7">3–7 hours</option><option value="8-plus">8+ hours</option></select></label>
                <label className="vb-form-grid__wide"><span>Main obstacle</span><textarea required minLength={3} maxLength={500} value={answers.mainObstacle} onChange={(event) => update("mainObstacle", event.target.value)} placeholder="What is making this decision difficult right now?" /></label>
                <label className="vb-form-grid__wide"><span>Useful context (optional)</span><textarea maxLength={1200} value={answers.goalDetails} onChange={(event) => update("goalDetails", event.target.value)} placeholder="Relevant timing, business stage, property context, skills, budget, or documents already available." /></label>
              </div></fieldset>}

              {step === 2 && <fieldset><legend>Where should we deliver the roadmap?</legend><p>Your result appears on screen first. Email delivery and any human follow-up use the information below.</p><div className="vb-form-grid">
                <div className="vb-route-preview"><span>Your route preview</span><strong>{focusOptions.find((option) => option.value === answers.focus)?.path}</strong><p>{focusOptions.find((option) => option.value === answers.focus)?.label}. The full free result will include an ordered 7/30/60/90-day plan and verified VestBlock routes.</p></div>
                <label><span>First name</span><input required minLength={2} maxLength={80} autoComplete="given-name" value={answers.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
                <label><span>Email</span><input required type="email" maxLength={254} autoComplete="email" value={answers.email} onChange={(event) => update("email", event.target.value)} /></label>
              </div>
                <div className="vb-consent">
                  <label><input type="checkbox" checked={answers.analysisConsent} onChange={(event) => update("analysisConsent", event.target.checked as true)} required /><span><strong>Required: prepare and deliver my analysis.</strong> I consent to VestBlock using these answers and contact information to generate, store, display, and email the requested roadmap.</span></label>
                  <label><input type="checkbox" checked={answers.requestFollowUp} onChange={(event) => update("requestFollowUp", event.target.checked)} /><span><strong>Request a human follow-up.</strong> Ask the VestBlock team to review this goal with you.</span></label>
                  {answers.requestFollowUp && <label className="vb-consent__contact"><span><strong>Phone (optional)</strong><input type="tel" maxLength={40} autoComplete="tel" value={answers.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Best number for the requested follow-up" /></span></label>}
                  <label><input type="checkbox" checked={answers.marketingConsent} onChange={(event) => update("marketingConsent", event.target.checked)} /><span><strong>Optional marketing.</strong> I agree to receive occasional VestBlock educational and service messages. This is not required for the free roadmap.</span></label>
                </div>
                <div className="vb-questionnaire__promise"><ShieldCheck aria-hidden="true" /><span>Foundational roadmap and credit-review routes are free. Optional paid, member, partner, and review-based routes are labeled before you choose them.</span></div>
              </fieldset>}

              {error && <p className="vb-questionnaire__error" role="alert">{error}</p>}
              <div className="vb-questionnaire__actions">
                {step > 0 && <button type="button" onClick={() => { setError(""); setStep((current) => current - 1) }}><ArrowLeft aria-hidden="true" />Back</button>}
                {step < 2 ? <button type="button" className="vb-button vb-button--primary" onClick={next}>Continue<ArrowRight aria-hidden="true" /></button> : <button type="submit" className="vb-button vb-button--primary" disabled={submitting}>{submitting ? "Preparing roadmap…" : "Build my free roadmap"}<ArrowRight aria-hidden="true" /></button>}
              </div>
            </form>
          </>
        ) : roadmap ? <RoadmapResult roadmap={roadmap} token={token} email={answers.email} confirmationAccepted={confirmationAccepted} onDownload={download} /> : null}
      </div>
    </main>
  )
}

function RoadmapResult({ roadmap, token, email: _email, confirmationAccepted, onDownload }: { roadmap: NextMoveRoadmap; token: string; email: string; confirmationAccepted: boolean; onDownload: () => void }) {
  return <article className="vb-roadmap-result">
    <div className="vb-roadmap-result__hero"><p className="vb-kicker">{roadmap.primaryPath} · {roadmap.readiness}</p><h1>{roadmap.title}</h1><p>{roadmap.summary}</p><div className="vb-roadmap-result__delivery">{confirmationAccepted ? <><Mail aria-hidden="true" />A copy was accepted for delivery to your email address.</> : <><Download aria-hidden="true" />Email delivery was unavailable. Download this result now.</>}</div></div>
    <section><h2>Your ordered roadmap</h2><ol className="vb-roadmap-timeline">{roadmap.steps.map((item) => <li key={item.window}><span>{item.window}</span><div><h3>{item.title}</h3><ul>{item.actions.map((action) => <li key={action}>{action}</li>)}</ul></div></li>)}</ol></section>
    <section><h2>Verified VestBlock routes</h2><div className="vb-roadmap-resources">{roadmap.resources.map((resource, index) => <Link key={resource.title} href={resource.href} data-recommended={index === 0 || undefined}><span>{index === 0 ? `Recommended first · ${resource.access}` : resource.access}</span><h3>{resource.title}</h3><p>{resource.description}</p>{resource.nextStep && <em>{resource.nextStep}</em>}<small>{resource.limitation}</small><strong>{index === 0 ? "Begin here" : "Open this route"} <ArrowRight aria-hidden="true" /></strong></Link>)}</div></section>
    <section className="vb-roadmap-cautions"><h2>Before you act</h2><ul>{roadmap.cautions.map((caution) => <li key={caution}><Check aria-hidden="true" />{caution}</li>)}</ul></section>
    <div className="vb-roadmap-result__actions"><button type="button" className="vb-button vb-button--primary" onClick={onDownload}><Download aria-hidden="true" />Download roadmap</button><Link className="vb-button vb-button--quiet" href={`/next-move/manage?token=${encodeURIComponent(token)}`}>Export or delete my stored data</Link><Link className="vb-button vb-button--quiet" href="/">Return to VestBlock</Link></div>
  </article>
}
