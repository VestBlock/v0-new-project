import Link from "next/link"
import { ArrowRight, Check, FileCheck2, LockKeyhole, Scale, ShieldCheck } from "lucide-react"

const trustPoints = [
  {
    icon: LockKeyhole,
    title: "No high-risk financial details required",
    body: "The free questionnaire does not ask for a Social Security number, password, full account number, or credit-report upload.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    body: "You decide whether to apply, submit, make an offer, share information, or continue into a paid service.",
  },
  {
    icon: Scale,
    title: "Know who decides",
    body: "VestBlock organizes the path. Each lender, buyer, seller, or licensed provider makes its own decision.",
  },
] as const

const recordRows = [
  ["Agreement", "Current version and access"],
  ["Milestones", "Actions and approvals in order"],
  ["Terms", "Key obligations tied to the record"],
] as const

export function DealVaultProofSection() {
  return (
    <>
      <section className="vb3-trust" aria-labelledby="trust-title" data-home-trust>
        <div className="vb3-shell">
          <div className="vb3-section-heading vb3-section-heading--compact">
            <div>
              <p className="vb3-kicker vb3-kicker--dark"><span aria-hidden="true" /> Clear boundaries</p>
              <h2 id="trust-title">Know what VestBlock handles and who makes each decision.</h2>
            </div>
          </div>
          <div className="vb3-trust__grid">
            {trustPoints.map(({ icon: Icon, title, body }, index) => (
              <article key={title}>
                <header><span>0{index + 1}</span><Icon aria-hidden="true" /></header>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <p className="vb3-trust__policies">
            Review the details in our <Link href="/security">security practices</Link> and <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>
      </section>

      <section className="vb3-dealvault" aria-labelledby="dealvault-title" data-home-dealvault>
        <div className="vb3-shell vb3-dealvault__layout">
          <div className="vb3-dealvault__copy">
            <p className="vb3-kicker"><span aria-hidden="true" /> When a path becomes active work</p>
            <h2 id="dealvault-title">Keep the record that supports the work.</h2>
            <p>
              DealVault keeps agreement references, milestones, approvals, and key terms connected when a Capital,
              Deals, or Opportunity path becomes active. The record owner can see what happened and what comes next.
            </p>
            <div className="vb3-dealvault__actions">
              <Link href="/dealvault" className="vb3-button vb3-button--lime">See DealVault <ArrowRight aria-hidden="true" /></Link>
              <Link href="/dealvault/demo" className="vb3-text-link">View a sample record <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>

          <div className="vb3-record" aria-label="Illustrative DealVault work record">
            <header>
              <span><FileCheck2 aria-hidden="true" /> DealVault work record</span>
              <strong><i /> Active</strong>
            </header>
            <div className="vb3-record__id"><span>Reference</span><strong>VB–0426–A17</strong><small>Account access</small></div>
            <ol>
              {recordRows.map(([title, body], index) => (
                <li key={title}>
                  <span>0{index + 1}</span>
                  <div><strong>{title}</strong><p>{body}</p></div>
                  <Check aria-hidden="true" />
                </li>
              ))}
            </ol>
            <footer>Illustrative record · Raw documents remain off-chain</footer>
          </div>
        </div>
      </section>
    </>
  )
}
