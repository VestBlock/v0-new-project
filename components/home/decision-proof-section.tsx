import { Check, FileText, Route, ShieldCheck } from "lucide-react"
import type { HomepageOutcomeId } from "./homepage-directory"

const proofByOutcome = {
  capital: {
    label: "Capital",
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
  "real-estate": {
    label: "Real Estate",
    document: "Real estate criteria brief",
    objective: "Source a small multifamily property",
    path: "Buyer profile and property-matching workflow",
    boundary: "Participants control offers, diligence, financing, and closing",
    steps: [
      ["First 7 days", "Define the buy box", "Record the market, asset type, range, timing, capacity, and conditions that make a property unsuitable."],
      ["Next 30 days", "Validate the criteria", "Confirm proof of capacity, decision speed, diligence needs, and who must participate."],
      ["When qualified", "Activate the matching path", "Use the approved criteria for relevant sourcing, introductions, and participant review."],
    ],
  },
  "business-growth": {
    label: "Business Growth + AI",
    document: "Growth workflow brief",
    objective: "Improve response to qualified inquiries",
    path: "AI receptionist and handoff assessment",
    boundary: "Implementation fit and business results require review",
    steps: [
      ["First 7 days", "Map the current response flow", "Document inquiry sources, response times, qualification rules, coverage, and missed handoffs."],
      ["Next 30 days", "Design the operating workflow", "Define scripts, routing logic, escalation rules, reporting, and human ownership."],
      ["When approved", "Connect the implementation path", "Move the reviewed workflow into setup, testing, and measured iteration."],
    ],
  },
  "personal-roadmap": {
    label: "Personal Roadmap",
    document: "Financial readiness roadmap",
    objective: "Improve credit and monthly cash flow",
    path: "Educational next-move roadmap",
    boundary: "Creditors, issuers, programs, and partners decide outcomes",
    steps: [
      ["First 7 days", "Establish the baseline", "Organize the stated goal, timeline, current position, available time, and main constraint."],
      ["Next 30 days", "Complete the preparation work", "Prioritize the educational actions and records most relevant to the stated goal."],
      ["At each checkpoint", "Review the next decision", "Update progress and choose the next appropriate workflow without assuming an approval."],
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
          <h2 id="roadmap-proof-title">A decision brief you can use.</h2>
          <p>
            The selected outcome changes the criteria, route, and working result. This example shows how VestBlock turns
            your answers into a clear sequence without presenting an approval or guarantee.
          </p>
        </div>

        <div className="vb-roadmap-sheet" aria-label={`Illustrative ${proof.label} decision brief`}>
          <header>
            <div>
              <span>VestBlock decision brief</span>
              <strong>{proof.document}</strong>
            </div>
            <span className="vb-roadmap-sheet__status"><Check aria-hidden="true" /> Route identified</span>
          </header>

          <div className="vb-roadmap-sheet__summary">
            <div><FileText aria-hidden="true" /><span>Objective</span><strong>{proof.objective}</strong></div>
            <div><Route aria-hidden="true" /><span>Connected workflow</span><strong>{proof.path}</strong></div>
            <div><ShieldCheck aria-hidden="true" /><span>Decision boundary</span><strong>{proof.boundary}</strong></div>
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
