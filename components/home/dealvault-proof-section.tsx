import Link from "next/link"
import { ArrowRight, FileCheck2, GitBranch, ReceiptText } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

const records = [
  {
    title: "Agreement record",
    body: "Retain the version, terms, timestamps, and permissions associated with a partner commitment without exposing private documents publicly.",
    icon: FileCheck2,
  },
  {
    title: "Milestone history",
    body: "Keep submissions, review checkpoints, introductions, and project milestones connected to the work they belong to.",
    icon: GitBranch,
  },
  {
    title: "Payout reference",
    body: "Document the terms and supporting record for referral, joint-venture, disposition, or operator splits before a disagreement has to be reconstructed.",
    icon: ReceiptText,
  },
]

export function DealVaultProofSection() {
  return (
    <section className="vb-dealvault" aria-labelledby="dealvault-title">
      <div className="vb-section-shell vb-dealvault__layout">
        <MarketingReveal initial={false} className="vb-dealvault__intro">
          <p className="vb-dealvault__label">DealVault</p>
          <h2 id="dealvault-title">Keep the record that supports the work.</h2>
          <p>
            DealVault keeps agreements, milestones, and payout references connected to the active work while sensitive
            material remains private.
          </p>
          <div className="vb-dealvault__actions">
            <Link href="/dealvault/demo" className="vb-button vb-button--primary">
              See the DealVault demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dealvault" className="vb-button vb-button--quiet">
              How it works
            </Link>
          </div>
        </MarketingReveal>

        <MarketingReveal initial={false} delay={0.1} className="vb-dealvault__records">
          <div className="vb-dealvault__seal" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vestblock-mark-transparent.png" alt="" />
            <span>record continuity</span>
          </div>
          {records.map((record, index) => {
            const Icon = record.icon
            return (
              <article key={record.title}>
                <span>0{index + 1}</span>
                <Icon aria-hidden="true" />
                <div>
                  <h3>{record.title}</h3>
                  <p>{record.body}</p>
                </div>
              </article>
            )
          })}
        </MarketingReveal>
      </div>
    </section>
  )
}
