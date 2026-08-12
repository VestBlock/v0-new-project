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
        <h2 id="closing-title">Start with the opportunity you need to move.</h2>
        <div>
          <Link href="/get-started" className="vb-button vb-button--primary">
            Choose an entry path
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/sell" className="vb-button vb-button--quiet">
            Submit a property
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
