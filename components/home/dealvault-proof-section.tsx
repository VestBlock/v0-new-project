import Link from "next/link"
import { ArrowRight, Check, FileCheck2, LockKeyhole, Scale, ShieldCheck } from "lucide-react"

const recordRows = [
  ["Agreement", "Version and permissions retained"],
  ["Milestones", "Submissions and decisions in sequence"],
  ["Payout reference", "Terms connected to supporting records"],
]

const trustPoints = [
  {
    icon: Scale,
    title: "Scope is stated upfront",
    body: "Each pathway shows what VestBlock organizes, what a participant reviews, and which decision remains independent.",
  },
  {
    icon: LockKeyhole,
    title: "Limited public intake",
    body: "The free questionnaire does not request a Social Security number, full account number, password, or complete credit report.",
  },
  {
    icon: ShieldCheck,
    title: "Consent stays separate",
    body: "Roadmap delivery and optional marketing consent are separate choices. Marketing is not preselected.",
  },
]

export function DealVaultProofSection() {
  return (
    <section className="vb-home-continuity" aria-labelledby="continuity-title">
      <div className="vb-home-shell">
        <div className="vb-home-continuity__layout">
          <div className="vb-home-continuity__intro">
          <p className="vb-home-kicker">DealVault · controlled record inside Private Ledger</p>
            <h2 id="continuity-title">Keep the decisions, documents, and next steps together.</h2>
            <p>
              When a VestBlock path becomes active work, DealVault keeps agreements, milestones, permissions, and
              payout references in one controlled record instead of scattering them across inboxes and folders.
            </p>
            <div>
              <Link href="/dealvault/demo" className="vb-home-button vb-home-button--primary">
                View the working demo <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/dealvault" className="vb-home-link">Learn how DealVault works</Link>
            </div>
          </div>

          <div className="vb-deal-record" aria-label="Illustrative DealVault record">
            <header>
              <span><FileCheck2 aria-hidden="true" /> Active work record</span>
              <span><i /> In progress</span>
            </header>
            <div className="vb-deal-record__identity">
              <small>Reference</small><strong>VB–0426–A17</strong><span>Controlled access</span>
            </div>
            <ol>
              {recordRows.map(([title, body], index) => (
                <li key={title}>
                  <span>0{index + 1}</span>
                  <div><strong>{title}</strong><p>{body}</p></div>
                  <Check aria-hidden="true" />
                </li>
              ))}
            </ol>
            <footer>Illustrative record · Private supporting material remains access-controlled</footer>
          </div>
        </div>

        <div className="vb-home-trust" aria-labelledby="trust-title">
          <div className="vb-home-trust__heading">
            <p className="vb-home-kicker">Clarity before information</p>
            <h2 id="trust-title">Know what VestBlock does—and what remains your decision.</h2>
          </div>
          <div className="vb-home-trust__grid">
            {trustPoints.map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
