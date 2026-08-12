"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

const participants = [
  { role: "Property owners", input: "Asset context and timing", action: "Submit a property", href: "/sell" },
  { role: "Buyers and investors", input: "Acquisition criteria", action: "Share a buy box", href: "/buyers" },
  { role: "Lenders and capital partners", input: "Program and risk criteria", action: "Join the lender network", href: "/lenders" },
  { role: "Operators", input: "Markets, capacity, and execution fit", action: "Build a partner profile", href: "/get-started" },
  { role: "Developers and contractors", input: "Project scope and availability", action: "Share operating capacity", href: "/get-started" },
  { role: "Acquisition teams", input: "Market coverage and mandate", action: "Map your criteria", href: "/get-started" },
]

export function NetworkSection() {
  const reduce = useReducedMotion()

  return (
    <section className="vb-network" aria-labelledby="network-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="network-title">A useful network starts with criteria, not a directory.</h2>
          <p>
            Every participant enters with a different question. VestBlock gives that question structure so the right
            opportunity reaches the right conversation with less unnecessary circulation.
          </p>
        </div>

        <div className="vb-network__ledger" role="list" aria-label="VestBlock network entry paths">
          <div className="vb-network__ledger-head" aria-hidden="true">
            <span>Participant</span>
            <span>Information that matters</span>
            <span>Start here</span>
          </div>
          {participants.map((participant, index) => (
            <motion.div
              key={participant.role}
              role="listitem"
              initial={false}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ duration: 0.48, delay: (index % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="vb-network__row"
            >
              <span className="vb-network__index">0{index + 1}</span>
              <h3>{participant.role}</h3>
              <p>{participant.input}</p>
              <Link href={participant.href}>
                {participant.action}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
