"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Check, FileText, Map, Network, WalletCards } from "lucide-react"

const reviewFields = [
  {
    label: "Property context",
    detail: "Asset type, location, condition, intended use, timing, and the documents available for review.",
    icon: Map,
  },
  {
    label: "Counterparty fit",
    detail: "Buy-box, lending parameters, operating capacity, market coverage, and the reason for an introduction.",
    icon: Network,
  },
  {
    label: "Capital readiness",
    detail: "Capital requirement, use of proceeds, supporting materials, diligence gaps, and the next requested action.",
    icon: WalletCards,
  },
  {
    label: "Evidence continuity",
    detail: "Versions, milestones, commitments, and permissions retained in the DealVault record.",
    icon: FileText,
  },
]

export function IntelligenceSection() {
  const reduce = useReducedMotion()

  return (
    <section className="vb-intelligence" aria-labelledby="intelligence-title">
      <div className="vb-section-shell vb-intelligence__layout">
        <motion.div
          initial={false}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="vb-section-intro"
        >
          <h2 id="intelligence-title">Every next step should begin with the same facts.</h2>
          <p>
            VestBlock gives participants a structured record for the property, decision criteria, supporting materials,
            and approved next action. It does not make lending, legal, tax, or investment decisions.
          </p>
        </motion.div>

        <motion.div
          initial={false}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="vb-review-sheet"
        >
          <div className="vb-review-sheet__head">
            <span>Opportunity record</span>
            <span>Illustrative view</span>
          </div>
          <div className="vb-review-sheet__body">
            {reviewFields.map((field, index) => {
              const Icon = field.icon
              return (
                <div key={field.label} className="vb-review-sheet__field">
                  <span className="vb-review-sheet__field-number">0{index + 1}</span>
                  <Icon aria-hidden="true" />
                  <div>
                    <h3>{field.label}</h3>
                    <p>{field.detail}</p>
                  </div>
                  <Check className="vb-review-sheet__check" aria-hidden="true" />
                </div>
              )
            })}
          </div>
          <div className="vb-review-sheet__foot">
            <span>Prepare the next conversation with the record available.</span>
            <span>VestBlock</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
