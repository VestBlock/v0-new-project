"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Home, ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export function PropertyCTASection() {
  return (
    <section className="py-12 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Card className="max-w-2xl mx-auto bg-card/50 border border-muted">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Home className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Selling a property?</h3>
                  <p className="text-sm text-muted-foreground">
                    Submit a property for investor interest or creative financing options.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/sell">
                    Submit Property
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
