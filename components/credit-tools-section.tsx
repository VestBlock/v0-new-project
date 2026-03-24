"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, FileText, TrendingUp, ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export function CreditToolsSection() {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Card className="max-w-4xl mx-auto bg-card/80 backdrop-blur border-2">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
                    <CreditCard className="h-10 w-10 text-cyan-500" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold mb-2">Credit Tools (Optional)</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload a report and get a credit improvement plan + dispute letters.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground mb-6">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-500" />
                      <span>AI Analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-cyan-500" />
                      <span>Improvement Plan</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-500" />
                      <span>Dispute Letters</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/credit-upload">
                      Analyze My Credit
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
