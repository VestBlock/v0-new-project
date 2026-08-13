'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Landmark,
  Menu,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'

type ScenarioId = 'business' | 'property' | 'sell' | 'readiness' | 'participate'

type Scenario = {
  id: ScenarioId
  short: string
  title: string
  lane: string
  href: string
  action: string
  access: string
  vestblock: string
  decision: string
  needed: string
  Icon: typeof Landmark
}

const navigation = [
  { label: 'Capital', href: '/capital' },
  { label: 'Real Estate', href: '/real-estate' },
  { label: 'Opportunity', href: '/opportunity' },
  { label: 'DealVault', href: '/deal-vault' },
]

const scenarios: Scenario[] = [
  {
    id: 'business',
    short: 'Business',
    title: 'Fund or grow a business',
    lane: 'Capital',
    href: '/capital',
    action: 'Review my capital path',
    access: 'Free to explore · Account required to save',
    vestblock: 'Organizes your objective, readiness factors, documents, and possible capital paths before a formal request.',
    decision: 'Lenders and capital partners set eligibility, underwriting, pricing, limits, and terms.',
    needed: 'Business stage, use of funds, timing, current revenue, and available records.',
    Icon: BriefcaseBusiness,
  },
  {
    id: 'property',
    short: 'Acquire',
    title: 'Find, buy, or finance a property',
    lane: 'Real Estate',
    href: '/real-estate',
    action: 'Set my property criteria',
    access: 'Free to explore · Review required for matching',
    vestblock: 'Turns your market, property, budget, and funding criteria into a structured request that can be reviewed and matched.',
    decision: 'Sellers, lenders, and other providers control availability, acceptance, underwriting, and closing decisions.',
    needed: 'Target markets, asset type, price range, timeline, strategy, and funding position.',
    Icon: Building2,
  },
  {
    id: 'sell',
    short: 'Sell',
    title: 'Sell a property',
    lane: 'Real Estate',
    href: '/real-estate',
    action: 'Review my sale path',
    access: 'Free submission · Human review follows',
    vestblock: 'Organizes the property, condition, timing, and seller priorities so the right sale paths can be reviewed.',
    decision: 'Buyers and providers decide whether to make an offer, propose terms, or continue toward closing.',
    needed: 'Property location, condition, timeline, occupancy, price context, and contact preference.',
    Icon: Landmark,
  },
  {
    id: 'readiness',
    short: 'Readiness',
    title: 'Improve credit, income, or readiness',
    lane: 'Opportunity',
    href: '/opportunity',
    action: 'Build my free roadmap',
    access: 'Free analysis · Consent required before saving',
    vestblock: 'Creates an ordered starting roadmap from the goal, current position, constraints, and time available.',
    decision: 'Creditors, issuers, grant programs, employers, and partners control approvals and outcomes.',
    needed: 'Goal, timeline, current position, main obstacle, and optional context. No SSN is requested here.',
    Icon: TrendingUp,
  },
  {
    id: 'participate',
    short: 'Participate',
    title: 'Offer capital, inventory, or professional services',
    lane: 'Capital + Real Estate',
    href: '/join',
    action: 'Create a partner profile',
    access: 'Free profile · Criteria reviewed before routing',
    vestblock: 'Captures what you provide, where you operate, who fits, and how opportunities should reach your team.',
    decision: 'Each participant controls its own criteria, availability, compliance, pricing, acceptance, and delivery.',
    needed: 'Role, coverage, criteria, capacity, contact owner, and any required credentials or disclosures.',
    Icon: CircleDollarSign,
  },
]

const sceneStates = [
  {
    label: 'Objective',
    title: 'Define the outcome before choosing a service.',
    evidence: ['Goal defined', 'Context visible', 'Consent clear'],
  },
  {
    label: 'Criteria',
    title: 'Compare the facts, constraints, and missing information.',
    evidence: ['Criteria organized', 'Gaps identified', 'Options compared'],
  },
  {
    label: 'Next path',
    title: 'Continue with a clear action and visible decision boundary.',
    evidence: ['Path selected', 'Access disclosed', 'Next action ready'],
  },
]

export function Gate4B2Prototype() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<ScenarioId>('business')
  const [paused, setPaused] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [sceneLocked, setSceneLocked] = useState(false)
  const [typeSample, setTypeSample] = useState<'inter' | 'system' | 'editorial'>('inter')
  const [routeNotice, setRouteNotice] = useState('')
  const prototypeRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mobilePanelRef = useRef<HTMLDivElement | null>(null)
  const mobileCloseRef = useRef<HTMLButtonElement | null>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null)

  const selected = scenarios.find((scenario) => scenario.id === selectedId) || scenarios[0]
  const scene = sceneStates[sceneIndex]

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const video = videoRef.current
    if (!video || reduceMotion) {
      video?.pause()
      setPaused(Boolean(video))
      return
    }

    void video.play().catch(() => setPaused(true))
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const trigger = mobileTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    mobileCloseRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        mobilePanelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const prototype = prototypeRef.current
    const hero = heroRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prototype || !hero || reduceMotion) return

    let frame = 0
    const updateTransition = () => {
      frame = 0
      const heroBox = hero.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, -heroBox.top / Math.max(heroBox.height * 0.68, 1)))
      prototype.style.setProperty('--g42-scroll-progress', progress.toFixed(3))
      if (!sceneLocked) {
        const nextScene = progress < 0.22 ? 0 : progress < 0.66 ? 1 : 2
        setSceneIndex((current) => current === nextScene ? current : nextScene)
      }
    }
    const requestUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateTransition)
    }

    updateTransition()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [sceneLocked])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video || mediaFailed) return
    if (paused) {
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true))
    } else {
      video.pause()
      setPaused(true)
    }
  }

  const previewDestination = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (href === '/login') return
    event.preventDefault()
    setMobileMenuOpen(false)

    if (href === '/deal-vault') {
      document.querySelector('#g42-dealvault')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setRouteNotice('DealVault selected. The live destination remains unchanged during this review.')
      return
    }

    const target: ScenarioId = href === '/capital'
      ? 'business'
      : href === '/real-estate'
        ? 'property'
        : href === '/opportunity'
          ? 'readiness'
          : 'participate'
    setSelectedId(target)
    document.querySelector('#choose-your-next-move')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setRouteNotice(`${scenarios.find((scenario) => scenario.id === target)?.lane || 'VestBlock'} selected. The live destination remains unchanged during this review.`)
  }

  return (
    <div ref={prototypeRef} className={`g42 g42-type-${typeSample}`}>
      <header className="g42-nav">
        <Link className="g42-brand" href="/dev/gate-4b2-prototype" aria-label="VestBlock prototype home">
          <span className="g42-brand-mark"><Image src="/vestblock-vb-mark-lime.png" alt="" fill sizes="42px" priority /></span>
          <span><strong>VestBlock</strong><small>Find your next move</small></span>
        </Link>

        <nav className="g42-nav-links" aria-label="Prototype navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href} prefetch={false} onClick={(event) => previewDestination(event, item.href)}>{item.label}</Link>)}
        </nav>

        <div className="g42-nav-actions">
          <Link className="g42-text-link" href="/login" prefetch={false}>Sign in</Link>
          <Link className="g42-nav-join" href="/join" prefetch={false} onClick={(event) => previewDestination(event, '/join')}>Join VestBlock</Link>
          <button ref={mobileTriggerRef} className="g42-menu-trigger" type="button" aria-label="Open navigation" aria-controls="g42-mobile-menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu /></button>
        </div>

        {mobileMenuOpen ? (
          <div className="g42-mobile-menu" role="dialog" aria-modal="true" aria-label="Prototype navigation menu">
            <button className="g42-mobile-menu-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />
            <div id="g42-mobile-menu" ref={mobilePanelRef} className="g42-mobile-menu-panel">
              <div className="g42-mobile-menu-head"><span>Navigate VestBlock</span><button ref={mobileCloseRef} type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><X /></button></div>
              <nav aria-label="Mobile prototype navigation">
                {navigation.map((item, index) => <Link key={item.href} href={item.href} prefetch={false} onClick={(event) => previewDestination(event, item.href)}><span>0{index + 1}</span>{item.label}<ChevronRight /></Link>)}
              </nav>
              <div className="g42-mobile-menu-actions"><Link href="/login" prefetch={false}>Sign in</Link><Link href="/join" prefetch={false} onClick={(event) => previewDestination(event, '/join')}>Join VestBlock</Link></div>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section ref={heroRef} className="g42-hero" aria-labelledby="g42-hero-title">
          <div className="g42-hero-media" data-ready={mediaReady && !mediaFailed} data-failed={mediaFailed}>
            <Image className="g42-hero-poster" src="/hero/material-ledger/mobile-poster.jpg" alt="A Black business owner reviewing a working file with an AI assistant in a modern office." fill sizes="100vw" priority />
            {!mediaFailed ? (
              <video
                ref={videoRef}
                className="g42-hero-video"
                muted
                loop
                playsInline
                preload="metadata"
                poster="/hero/material-ledger/mobile-poster.jpg"
                onCanPlay={() => setMediaReady(true)}
                onPlaying={() => setMediaReady(true)}
                onPause={() => setPaused(true)}
                onError={() => { setMediaFailed(true); setMediaReady(false); setPaused(true) }}
                aria-label="A Black business owner reviews a working file with an AI assistant nearby."
              >
                <source src="/hero/material-ledger/mobile.webm" type="video/webm" />
                <source src="/hero/material-ledger/mobile.mp4" type="video/mp4" />
              </video>
            ) : null}
          </div>
          <div className="g42-hero-light" aria-hidden="true" />

          <div className="g42-hero-copy">
            <p className="g42-overline"><span /> Start with what you need to do next</p>
            <h1 id="g42-hero-title">Make your next move with the right context.</h1>
            <p className="g42-hero-definition">
              VestBlock helps people and businesses prepare for and coordinate practical next steps across Capital, Real Estate, Opportunity, and DealVault.
            </p>
            <div className="g42-hero-actions">
              <a className="g42-primary-action" href="#choose-your-next-move">Choose my next move <ArrowDown /></a>
              <Link className="g42-secondary-action" href="/next-move">Build my free roadmap</Link>
            </div>
            <p className="g42-hero-disclosure">Explore without signing in. Create an account only when you save, submit, or continue a personalized path.</p>
          </div>

          <aside className="g42-scene-readout" aria-live="polite">
            <div className="g42-readout-head"><span>0{sceneIndex + 1} / 03</span><p>{scene.label}</p></div>
            <strong>{scene.title}</strong>
            <ul>{scene.evidence.map((item) => <li key={item}><Check />{item}</li>)}</ul>
          </aside>
          <div className="g42-assistant-link" aria-hidden="true"><span /><p><strong>AI assistant</strong>Organizes context; people and providers make decisions.</p></div>

          <button className="g42-playback" type="button" onClick={togglePlayback} disabled={mediaFailed} aria-label={paused ? 'Play hero video' : 'Pause hero video'}>
            {paused ? <Play /> : <Pause />}<span>{mediaFailed ? 'Still image' : paused ? 'Play scene' : 'Pause scene'}</span>
          </button>

          <div className="g42-decision-seam" aria-hidden="true"><span /></div>
        </section>

        <section id="choose-your-next-move" className="g42-scenarios" aria-labelledby="g42-scenario-title">
          <div className="g42-section-heading">
            <p className="g42-overline"><span /> Start with the outcome</p>
            <h2 id="g42-scenario-title">What are you trying to do next?</h2>
            <p>Choose the closest situation. You will see the right part of VestBlock, what we handle, what another party decides, and what the next step requires.</p>
          </div>

          <div className="g42-scenario-workspace">
            <div className="g42-scenario-list" aria-label="Choose a scenario">
              {scenarios.map((scenario, index) => {
                const active = scenario.id === selected.id
                return (
                  <button key={scenario.id} type="button" aria-pressed={active} data-active={active} onClick={() => { setSelectedId(scenario.id); setSceneIndex(2); setSceneLocked(true) }}>
                    <span className="g42-scenario-number">0{index + 1}</span>
                    <scenario.Icon aria-hidden="true" />
                    <span><small>{scenario.short}</small><strong>{scenario.title}</strong></span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                )
              })}
            </div>

            <article className="g42-route-preview" key={selected.id} aria-live="polite">
              <div className="g42-route-preview-head"><span>Recommended path</span><strong>{selected.lane}</strong></div>
              <h3>{selected.title}</h3>
              <dl>
                <div><dt>VestBlock’s role</dt><dd>{selected.vestblock}</dd></div>
                <div><dt>Who decides</dt><dd>{selected.decision}</dd></div>
                <div><dt>What to prepare</dt><dd>{selected.needed}</dd></div>
              </dl>
              <p className="g42-access"><ShieldCheck />{selected.access}</p>
              <Link className="g42-primary-action" href={selected.href} prefetch={false} onClick={(event) => previewDestination(event, selected.href)}>{selected.action}<ArrowRight /></Link>
              <p className="g42-prototype-notice" aria-live="polite">{routeNotice}</p>
            </article>
          </div>
        </section>

        <section className="g42-method" aria-labelledby="g42-method-title">
          <div className="g42-section-heading g42-section-heading-light">
            <p className="g42-overline"><span /> From interest to action</p>
            <h2 id="g42-method-title">The platform keeps the next decision connected.</h2>
          </div>
          <ol>
            <li><span>01</span><div><strong>Describe the objective</strong><p>Start with the business, property, financial, or partner outcome that matters now.</p></div></li>
            <li><span>02</span><div><strong>Organize the working context</strong><p>VestBlock structures criteria, readiness, records, timing, and unanswered questions.</p></div></li>
            <li><span>03</span><div><strong>Continue through the right part of VestBlock</strong><p>Use a VestBlock tool, request review, or consider an appropriate provider path with access disclosed.</p></div></li>
            <li><span>04</span><div><strong>Keep active work accountable</strong><p>Use DealVault when agreements, evidence, milestones, approvals, or payout references need a durable record.</p></div></li>
          </ol>
        </section>

        <section className="g42-trust" aria-labelledby="g42-trust-title">
          <div className="g42-section-heading">
            <p className="g42-overline"><span /> Inspectable safeguards</p>
            <h2 id="g42-trust-title">You can see how a recommendation is handled before you continue.</h2>
            <p>This prototype does not invent customer counts, approval rates, or testimonials. It demonstrates the controls that are already present in the experience.</p>
          </div>
          <div className="g42-trust-grid">
            <article><FileCheck2 /><span>Shown in every result</span><strong>Visible recommendation basis</strong><p>The selected goal, preparation factors, and missing information remain visible beside the next action.</p></article>
            <article><ShieldCheck /><span>Disclosed before action</span><strong>Decision and access boundaries</strong><p>Each result states what VestBlock handles, who controls eligibility or acceptance, and whether access is free, account-based, paid, or review-dependent.</p></article>
            <article><Sparkles /><span>Required for supported analysis</span><strong>Consent and human review</strong><p>Saving or submitting a personalized path requires permission; supported analysis must disclose uncertainty and allow review by a person.</p></article>
            <article><FileCheck2 /><span>Limited at the public starting point</span><strong>Sensitive-data boundary</strong><p>This selector requests no Social Security number, bank password, full account number, or complete credit report. Private files do not appear in the public experience.</p></article>
          </div>
        </section>

        <section id="g42-dealvault" className="g42-dealvault" aria-labelledby="g42-dealvault-title">
          <div className="g42-dealvault-copy">
            <p className="g42-overline"><span /> When a path becomes active work</p>
            <h2 id="g42-dealvault-title">DealVault keeps the record around the relationship.</h2>
            <p>Retain the approved version, supporting evidence, milestones, permissions, and payout references connected to a deal or partnership. Private source files remain protected; a record does not replace legal, title, escrow, brokerage, or underwriting professionals.</p>
            <Link className="g42-primary-action" href="/deal-vault" prefetch={false} onClick={(event) => previewDestination(event, '/deal-vault')}>Explore DealVault <ArrowRight /></Link>
          </div>
          <div className="g42-ledger" aria-label="DealVault record specimen">
            <div className="g42-ledger-head"><span>Working record</span><strong>VB-24-071</strong></div>
            <ol>
              <li data-complete="true"><span /><div><strong>Criteria accepted</strong><small>Version 03 · 09:42</small></div><Check /></li>
              <li data-complete="true"><span /><div><strong>Evidence reviewed</strong><small>Four references · 10:18</small></div><Check /></li>
              <li><span /><div><strong>Partner decision</strong><small>Review in progress</small></div><span className="g42-ledger-status">Active</span></li>
            </ol>
          </div>
        </section>

        <section className="g42-type-lab" aria-labelledby="g42-type-title">
          <div className="g42-section-heading">
            <p className="g42-overline"><span /> Typography comparison</p>
            <h2 id="g42-type-title">Readability wins the decision.</h2>
            <p>The prototype keeps Inter as the default until a real-size comparison proves another system is stronger.</p>
          </div>
          <div className="g42-type-controls" role="group" aria-label="Typography sample">
            <button type="button" aria-pressed={typeSample === 'inter'} onClick={() => setTypeSample('inter')}>Inter · current</button>
            <button type="button" aria-pressed={typeSample === 'system'} onClick={() => setTypeSample('system')}>System · neutral</button>
            <button type="button" aria-pressed={typeSample === 'editorial'} onClick={() => setTypeSample('editorial')}>Editorial · specimen</button>
          </div>
          <div className="g42-type-specimens">
            <article className="g42-workspace-specimen"><span>Customer workspace</span><h3>Your capital request is ready for document review.</h3><p>Three preparation items remain before a provider introduction should be considered.</p><button type="button">Review next actions</button></article>
            <article className="g42-command-specimen"><span>Command Center</span><div><strong>Review queue</strong><b>12</b></div><ul><li>Capital readiness <em>4 open</em></li><li>Property criteria <em>5 open</em></li><li>Partner review <em>3 open</em></li></ul></article>
          </div>
        </section>

        <section className="g42-final" aria-labelledby="g42-final-title">
          <p className="g42-overline"><span /> One clear starting point</p>
          <h2 id="g42-final-title">Tell VestBlock where you want to go next.</h2>
          <p>Explore the relevant part of VestBlock first. Save your criteria or request review when you are ready.</p>
          <a className="g42-primary-action" href="#choose-your-next-move">Choose my next move <ArrowRight /></a>
        </section>
      </main>
    </div>
  )
}
