import { Check, FileText, Route, ShieldCheck } from "lucide-react"
import type { HomepageOutcomeId } from "./homepage-directory"

const proofByOutcome = {
  capital: {
    label: "Prepare for funding",
    document: "Capital readiness brief",
    objective: "Prepare an expansion funding request",
    path: "Business funding readiness review",
    boundary: "An independent provider sets eligibility and terms",
    steps: [
      ["First 7 days", "Organize the request", "Confirm the amount, use of funds, timing, operating context, and records already available."],
      ["Next 30 days", "Close readiness gaps", "Resolve missing documentation and questions that could prevent a qualified review."],
      ["When ready", "Submit to the matched path", "Continue only when the request fits the stated provider criteria and review process."],
    ],
  },
  deals: {
    label: "Real estate",
    document: "Acquisition criteria and action brief",
    objective: "Acquire an off-market 2–8 unit property",
    path: "Criteria-driven sourcing, seller outreach, and contract pursuit",
    boundary: "Participants control offers, diligence, financing, and closing",
    steps: [
      ["Step 01", "Define the buy box", "Record the market, property type, price range, condition, timing, capacity, and clear reasons to pass."],
      ["Step 02", "Source and evaluate", "Use approved property sources and the stated criteria to identify possible matches worth a closer review."],
      ["Step 03", "Begin compliant outreach", "Contact eligible owners or representatives with clear identity, truthful language, and an easy way to opt out."],
      ["Step 04", "Offer, negotiate, and secure the agreement", "When interest and fit are confirmed, document the offer assumptions, protect follow-up, preserve negotiation history, and coordinate diligence, financing, and the signed-contract handoff."],
    ],
  },
  opportunity: {
    label: "Business growth",
    document: "Opportunity starting plan",
    objective: "Strengthen financial readiness and start a service business",
    path: "Educational roadmap and business-setup path",
    boundary: "Programs, creditors, partners, and the market decide outcomes",
    steps: [
      ["First 7 days", "Establish the starting point", "Organize the goal, timeline, current position, available time, and main constraint."],
      ["Next 30 days", "Build the foundation", "Prioritize the financial, business-setup, offer, and operating actions most relevant to the goal."],
      ["At each checkpoint", "Choose the next move", "Update progress and continue into the appropriate tool, review, or service without assuming an outcome."],
    ],
  },
} satisfies Record<HomepageOutcomeId, {
  label: string
  document: string
  objective: string
  path: string
  boundary: string
  steps: readonly (readonly [string, string, string])[]
}>

export function DecisionProofSection({ outcomeId }: { outcomeId: HomepageOutcomeId }) {
  const proof = proofByOutcome[outcomeId]

  return (
    <section className="vb-home-proof" aria-labelledby="roadmap-proof-title" data-outcome={outcomeId}>
      <div className="vb-home-shell vb-home-proof__layout">
        <div className="vb-home-proof__intro">
          <p className="vb-home-kicker">Tangible output · {proof.label}</p>
          <h2 id="roadmap-proof-title">A plan built to move.</h2>
          <p>
            Your selected goal changes what VestBlock asks, what the platform prepares, and which operating path comes
            next. The result is specific enough to act on without presenting an approval or guarantee.
          </p>
        </div>

        <div className="vb-roadmap-sheet" aria-label={`Illustrative ${proof.label} starting plan`}>
          <header>
            <div>
              <span>VestBlock starting plan</span>
              <strong>{proof.document}</strong>
            </div>
            <span className="vb-roadmap-sheet__status"><Check aria-hidden="true" /> Route identified</span>
          </header>

          <div className="vb-roadmap-sheet__summary">
            <div><FileText aria-hidden="true" /><span>Objective</span><strong>{proof.objective}</strong></div>
            <div><Route aria-hidden="true" /><span>Starting path</span><strong>{proof.path}</strong></div>
            <div><ShieldCheck aria-hidden="true" /><span>What to know</span><strong>{proof.boundary}</strong></div>
          </div>

          <ol>
            {proof.steps.map(([period, title, body], index) => (
              <li key={period}>
                <span>0{index + 1}</span>
                <div>
                  <small>{period}</small>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <footer>Illustrative format. Your result changes with the information you provide.</footer>
        </div>
      </div>
    </section>
  )
}
