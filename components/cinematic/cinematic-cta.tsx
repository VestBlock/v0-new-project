import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CinematicCta() {
  return (
    <section className="vb3-final" aria-labelledby="closing-title" data-home-final-cta>
      <div className="vb3-shell vb3-final__layout">
        <div>
          <p className="vb3-kicker vb3-kicker--dark"><span aria-hidden="true" /> A clearer starting point</p>
          <h2 id="closing-title">Ready for your next move?</h2>
        </div>
        <div className="vb3-final__action">
          <p>Answer a few focused questions and get a practical starting roadmap for capital, real estate, or business growth.</p>
          <div>
            <Link href="/next-move" className="vb3-button vb3-button--ink" data-home-primary-cta>
              Build my free roadmap <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="#choose-your-path" className="vb3-text-link vb3-text-link--dark">Browse all paths <ArrowRight aria-hidden="true" /></Link>
          </div>
          <small>Free to start. No account required.</small>
        </div>
      </div>
    </section>
  )
}
