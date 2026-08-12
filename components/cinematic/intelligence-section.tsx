"use client"

import { motion, useReducedMotion } from "framer-motion"
import { BriefcaseBusiness, Check, Compass, FileText, WalletCards } from "lucide-react"

const reviewFields = [
  {
    label: "Your objective",
    detail: "What you want to build, fund, acquire, improve, or grow, including timing and the result you are working toward.",
    icon: Compass,
  },
  {
    label: "Deal context",
    detail: "The relevant asset or business, economics, participants, source materials, and the questions that still need an answer.",
    icon: BriefcaseBusiness,
  },
  {
    label: "Capital preparation",
    detail: "The capital purpose, amount, use of proceeds, supporting materials, readiness gaps, and possible paths to compare.",
    icon: WalletCards,
  },
  {
    label: "Next-step continuity",
    detail: "The selected action, materials, versions, milestones, commitments, and permissions retained in the DealVault record.",
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
          <h2 id="intelligence-title">A better next move starts with the right context.</h2>
          <p>
            VestBlock organizes the objective, available information, decision criteria, supporting materials, and next
            action. It can help you prepare and compare; it does not make lending, legal, tax, or investment decisions.
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
            <span>Next-move brief</span>
            <span>What stays connected</span>
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
            <span>Keep the decision and its supporting materials together.</span>
            <span>VestBlock</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
