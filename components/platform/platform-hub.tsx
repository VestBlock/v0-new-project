import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import type { PlatformLane } from '@/lib/platform/lanes'

export function PlatformHub({ lane }: { lane: PlatformLane }) {
  return (
    <div className="vb-hub">
      <section className="vb-hub__hero">
        <div className="vb-section-shell">
          <p className="vb-kicker">{lane.label} · {lane.eyebrow}</p>
          <h1>{lane.headline}</h1>
          <p>{lane.introduction}</p>
          <div className="vb-hub__actions">
            <Link className="vb-button vb-button--primary" href={lane.primaryHref}>{lane.primaryAction}<ArrowRight aria-hidden="true" /></Link>
            <Link className="vb-button vb-button--quiet" href="/workspace">Open my workspace</Link>
          </div>
        </div>
      </section>

      <section id={`${lane.id}-paths`} className="vb-hub__routes" aria-labelledby={`${lane.id}-routes-title`}>
        <div className="vb-section-shell">
          <div className="vb-section-intro vb-section-intro--split">
            <div><p className="vb-kicker">Choose the relevant path</p><h2 id={`${lane.id}-routes-title`}>Start from your objective—not a product list.</h2></div>
            <p>Explore any path without signing in. VestBlock asks for an account only when you save criteria, submit private information, or continue personalized work.</p>
          </div>
          <div className="vb-hub__route-list">
            {lane.routes.map((route, index) => (
              <Link key={route.title} href={route.href} className="vb-hub__route">
                <span>0{index + 1}</span>
                <div><h3>{route.title}</h3><p>{route.body}</p></div>
                <div><strong>{route.access}</strong><small><ShieldCheck aria-hidden="true" />{route.boundary}</small></div>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="vb-hub__sequence" aria-labelledby={`${lane.id}-sequence-title`}>
        <div className="vb-section-shell">
          <p className="vb-kicker">How this lane works</p>
          <h2 id={`${lane.id}-sequence-title`}>Context first. Then the right action.</h2>
          <ol>
            {lane.sequence.map((step, index) => <li key={step.title}><span>0{index + 1}</span><CheckCircle2 aria-hidden="true" /><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}
          </ol>
          <Link className="vb-button vb-button--primary" href={lane.primaryHref}>{lane.primaryAction}<ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  )
}
