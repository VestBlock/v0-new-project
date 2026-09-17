import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CinematicCta() {
  return (
    <section className="vb-home-closing" aria-labelledby="closing-title">
      <div className="vb-home-shell vb-home-closing__layout">
        <div>
          <p className="vb-home-kicker">Active property acquisition</p>
          <h2 id="closing-title">Have a property or a buy box?</h2>
        </div>
        <div className="vb-home-closing__action">
          <p>Put the opportunity or acquisition criteria into the Private Ledger. VestBlock can qualify the path, coordinate the next action, and keep the record connected.</p>
          <div className="vb-home-closing__actions">
            <Link href="/sell" className="vb-home-button vb-home-button--primary">Submit a property <ArrowRight aria-hidden="true" /></Link>
            <Link href="/buyers" className="vb-home-button vb-home-button--secondary">Share my buy box <ArrowRight aria-hidden="true" /></Link>
          </div>
          <Link href="/next-move" className="vb-home-link">Start with the free roadmap instead <ArrowRight aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  )
}
