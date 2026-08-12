"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowDownRight, FileCheck2, Landmark, MapPinned, Scale } from "lucide-react"

const stages = [
  {
    number: "01",
    title: "Assemble the asset record",
    body: "Capture the property, use case, timing, known terms, and diligence materials before the opportunity reaches a counterparty.",
    outcome: "Outcome: a reviewable property context",
    icon: MapPinned,
  },
  {
    number: "02",
    title: "Test the fit",
    body: "Compare the opportunity with acquisition criteria, operating capacity, and capital requirements so the next introduction has a purpose.",
    outcome: "Outcome: a defined partner conversation",
    icon: Scale,
  },
  {
    number: "03",
    title: "Prepare the capital path",
    body: "Organize what a lender, buyer, operator, or capital partner needs to assess the request and identify the missing inputs.",
    outcome: "Outcome: a clearer diligence sequence",
    icon: Landmark,
  },
  {
    number: "04",
    title: "Keep the decision record",
    body: "Maintain material versions, milestones, conversations, and commitments in DealVault as the opportunity moves forward.",
    outcome: "Outcome: a durable DealVault history",
    icon: FileCheck2,
  },
]

export function CapitalFlowSection() {
  const reduce = useReducedMotion()

  return (
    <section className="vb-capital-sequence" aria-labelledby="capital-sequence-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="capital-sequence-title">Prepare an opportunity in the order it will be reviewed.</h2>
          <p>
            Property opportunities move faster when the asset record, the capital question, and the partner criteria are
            legible before the next conversation begins.
          </p>
        </div>

        <ol className="vb-capital-sequence__list">
          {stages.map((stage, index) => {
            const Icon = stage.icon
            return (
              <motion.li
                key={stage.number}
                initial={false}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="vb-capital-sequence__number">{stage.number}</span>
                <span className="vb-capital-sequence__icon"><Icon aria-hidden="true" /></span>
                <div>
                  <h3>{stage.title}</h3>
                  <p>{stage.body}</p>
                </div>
                <p className="vb-capital-sequence__outcome">
                  <ArrowDownRight aria-hidden="true" />
                  {stage.outcome}
                </p>
              </motion.li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
