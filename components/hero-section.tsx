"use client"

import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import Image from "next/image"

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20" />

      <div className="container mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6">
              <span className="gradient-text">AI-Powered Financial Opportunity Platform</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8">
              VestBlock helps entrepreneurs and investors unlock financial opportunities using AI. Upload your credit report, generate dispute letters, improve your approval odds, and discover funding options to launch or scale your next opportunity.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-600 glow">
                <Link href="/login">Get Funding</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/credit-upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Credit Report
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center items-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full blur-3xl opacity-30 animate-pulse" />
            <Image
              src="/4D3E27E0-6C7A-4B5B-92D5-CF92182A4C7A.png"
              alt="VestBlock AI-Powered Financial Opportunity Platform"
              width={400}
              height={400}
              className="relative z-10 object-contain"
              priority
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
