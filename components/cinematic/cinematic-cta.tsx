import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CinematicCta() {
  return (
    <section className="vb-home-closing" aria-labelledby="closing-title">
      <div className="vb-home-shell vb-home-closing__layout">
        <div>
          <p className="vb-home-kicker">Start with your goal</p>
          <h2 id="closing-title">Bring the goal. Leave with the next move.</h2>
        </div>
        <div className="vb-home-closing__action">
          <p>Answer a few plain-language questions and receive an ordered starting plan you can use right away.</p>
          <Link href="/next-move" className="vb-home-button vb-home-button--primary">
            Get my free next-step plan <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
