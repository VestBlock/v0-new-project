import Link from "next/link"
import { ArrowRight, Check, Compass, FileText, ListChecks } from "lucide-react"

const steps = [
  {
    number: "01",
    title: "Name the goal",
    body: "Tell us what you are trying to fund, buy, sell, improve, or grow.",
  },
  {
    number: "02",
    title: "See what matters first",
    body: "Get a clear list of what to gather, what to strengthen, and what can wait.",
  },
  {
    number: "03",
    title: "Choose your next step",
    body: "Continue to the most relevant VestBlock path when you are ready.",
  },
] as const

export function DecisionProofSection() {
  return (
    <section className="vb3-process" aria-labelledby="process-title" data-home-steps>
      <div className="vb3-shell vb3-process__layout">
        <div className="vb3-process__copy">
          <p className="vb3-kicker"><span aria-hidden="true" /> How VestBlock works</p>
          <h2 id="process-title">From goal to next step in three moves.</h2>
          <p className="vb3-process__intro">
            You do not need to understand every product before you begin. Start with your goal. VestBlock organizes
            what to prepare and points you to the most relevant path.
          </p>

          <ol className="vb3-process__steps">
            {steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.body}</p></div>
              </li>
            ))}
          </ol>
        </div>

        <article className="vb3-plan" aria-label="Example VestBlock roadmap">
          <header>
            <div><span>Example roadmap</span><strong>Business funding preparation</strong></div>
            <p><Check aria-hidden="true" /> Starting point mapped</p>
          </header>

          <div className="vb3-plan__goal">
            <span><Compass aria-hidden="true" /> Your goal</span>
            <strong>Prepare to fund a service-business expansion</strong>
          </div>

          <div className="vb3-plan__body">
            <div>
              <span><ListChecks aria-hidden="true" /> First priority</span>
              <p>Define the amount, use of funds, timeline, and current monthly obligations.</p>
            </div>
            <div>
              <span><FileText aria-hidden="true" /> Next actions</span>
              <ul>
                <li>Separate business and personal records</li>
                <li>Gather recent operating statements</li>
                <li>Review the matching funding path</li>
              </ul>
            </div>
          </div>

          <footer>
            <p>Capital example. Roadmaps vary across every path. Educational guidance only; not an approval, offer, or guarantee.</p>
            <Link href="/next-move">Build my free roadmap <ArrowRight aria-hidden="true" /></Link>
          </footer>
        </article>
      </div>
    </section>
  )
}
