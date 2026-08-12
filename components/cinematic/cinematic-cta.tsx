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
        <h2 id="closing-title">Tell VestBlock what you are working toward.</h2>
        <div>
          <Link href="/get-started" className="vb-button vb-button--primary">
            Find your next move
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#platform-path" className="vb-button vb-button--quiet">
            Review the three paths
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
