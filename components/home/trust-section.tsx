import Link from "next/link"
import { ArrowRight, Eye, FileCheck2, LockKeyhole, Scale } from "lucide-react"

const statements = [
  { icon: Scale, title: "Preparation, not promises", body: "VestBlock helps people prepare, compare, organize, and request review. Third parties control approvals, terms, awards, matches, rankings, and closings." },
  { icon: LockKeyhole, title: "Limited public intake", body: "The free questionnaire never asks for a Social Security number, full account number, password, or complete credit report." },
  { icon: FileCheck2, title: "Separate consent", body: "Analysis and roadmap delivery are separate from optional marketing consent. Marketing is never preselected." },
  { icon: Eye, title: "Access shown before the click", body: "Every recommendation says whether it is free, account-based, paid, member-only, partner-routed, or subject to review." },
]

export function TrustSection() {
  return (
    <section className="vb-trust" aria-labelledby="trust-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split"><div><p className="vb-kicker">Trust and limitations</p><h2 id="trust-title">Know what VestBlock does before you share information.</h2></div><p>Plain-language scope, careful data collection, and visible limitations are part of the product—not fine print added after a decision.</p></div>
        <div className="vb-trust__grid">{statements.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>)}</div>
        <div className="vb-trust__links"><Link href="/resources">Browse educational resources <ArrowRight aria-hidden="true" /></Link><Link href="/services">Review all services <ArrowRight aria-hidden="true" /></Link></div>
      </div>
    </section>
  )
}
