"use client"

import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export function PropertyCTASection() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur border border-cyan-500/20 rounded-2xl p-8 md:p-12">
            <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Home className="h-8 w-8 text-cyan-500" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-4">
              Selling a Property?
            </h2>

            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              VestBlock connects property owners with real estate investors and funding opportunities. Submit your property and explore potential offers or creative financing options.
            </p>

            <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-600 glow">
              <Link href="/sell">
                <Home className="mr-2 h-5 w-5" />
                Submit Your Property
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
