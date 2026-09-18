import Link from "next/link"
import { ArrowDown, ArrowRight, Check } from "lucide-react"

const entryPoints = [
  { number: "01", label: "Capital", detail: "Prepare for funding" },
  { number: "02", label: "Deals", detail: "Buy, sell, assess, or fund property" },
  { number: "03", label: "Opportunity", detail: "Strengthen financial or business readiness" },
] as const

export function CinematicHero() {
  return (
    <section className="vb3-hero" aria-labelledby="homepage-hero-title">
      <div className="vb3-shell vb3-hero__layout">
        <div className="vb3-hero__copy">
          <p className="vb3-kicker"><span aria-hidden="true" /> Capital + Deals + Opportunity</p>
          <h1 id="homepage-hero-title" className="vb-font-critical">Find your next move.</h1>
          <p className="vb3-hero__lede">
            VestBlock brings funding preparation, real-estate paths, and practical business growth into one place.
            Tell us what you are trying to do. We will show you what to prepare and where to go next.
          </p>

          <div className="vb3-hero__actions">
            <Link href="/next-move" className="vb3-button vb3-button--lime" data-home-primary-cta>
              Build my free roadmap <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="#choose-your-path" className="vb3-button vb3-button--ghost">
              Choose a path <ArrowDown aria-hidden="true" />
            </Link>
          </div>

          <ul className="vb3-hero__assurance" aria-label="Free plan details">
            <li><Check aria-hidden="true" /> Free to start</li>
            <li><Check aria-hidden="true" /> No account required</li>
            <li><Check aria-hidden="true" /> No SSN or financial login required</li>
          </ul>
        </div>

        <figure className="vb3-route-map" aria-labelledby="route-map-title">
          <figcaption id="route-map-title">
            <span>One coordinated starting point</span>
            <strong>Start with the goal. Leave with a next step.</strong>
          </figcaption>

          <div className="vb3-route-map__body">
            <div className="vb3-route-map__entries">
              {entryPoints.map((entry) => (
                <div key={entry.number} className="vb3-route-map__entry">
                  <span>{entry.number}</span>
                  <div><strong>{entry.label}</strong><small>{entry.detail}</small></div>
                </div>
              ))}
            </div>

            <div className="vb3-route-map__convergence" aria-hidden="true">
              <svg viewBox="0 0 184 260" preserveAspectRatio="none">
                <path pathLength="1" d="M2 42H52C82 42 72 130 116 130H182" />
                <path pathLength="1" d="M2 130H182" />
                <path pathLength="1" d="M2 218H52C82 218 72 130 116 130H182" />
              </svg>
              <i />
            </div>

            <div className="vb3-route-map__output">
              <span>Your next move</span>
              <strong>A focused roadmap</strong>
              <ul>
                <li>What matters first</li>
                <li>What to prepare</li>
                <li>Where to continue</li>
              </ul>
            </div>
          </div>

          <footer>
            <span>Clear direction</span>
            <span>Practical preparation</span>
            <span>You control the decision</span>
          </footer>
        </figure>
      </div>
    </section>
  )
}
