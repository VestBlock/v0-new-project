"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export function CinematicCta() {
  const reduce = useReducedMotion()

  return (
    <section className="vb-closing" aria-labelledby="closing-title">
      <motion.div
        initial={false}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        className="vb-closing__content"
      >
        <p className="vb-kicker">Free Next-Move Questionnaire</p>
        <h2 id="closing-title">Start with your goal.</h2>
        <p>Answer a few questions about your goal, timeline, current position, and main obstacle. Receive a practical starting roadmap before creating an account.</p>
        <div>
          <Link href="/next-move" className="vb-button vb-button--primary">
            Build my free roadmap
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/services" className="vb-button vb-button--quiet">
            Browse all services
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
