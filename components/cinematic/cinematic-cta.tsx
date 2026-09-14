import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CinematicCta() {
  return (
    <section className="vb-home-closing" aria-labelledby="closing-title">
      <div className="vb-home-shell vb-home-closing__layout">
        <div>
          <p className="vb-home-kicker">Start with the outcome</p>
          <h2 id="closing-title">Bring the goal. Leave with the next move.</h2>
        </div>
        <div className="vb-home-closing__action">
          <p>Choose the path that fits, organize what matters, and continue only when the next workflow is clear.</p>
          <Link href="#choose-your-path" className="vb-home-button vb-home-button--primary">
            Choose my outcome <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
