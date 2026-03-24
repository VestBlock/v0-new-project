"use client"

import { Button } from "@/components/ui/button"
import { DollarSign, Bot, ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import Image from "next/image"

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="container mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Funding + AI Automation for{" "}
              <span className="gradient-text">Small Businesses</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8">
              Get matched with business funding options and install an AI assistant that captures leads and books appointments 24/7.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-600 glow">
                <Link href="/funding">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Get Funding
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/ai-assistant">
                  <Bot className="mr-2 h-5 w-5" />
                  Try AI Assistant Demo
                </Link>
              </Button>
            </div>

            <Link
              href="/credit-upload"
              className="text-sm text-muted-foreground hover:text-cyan-500 transition-colors inline-flex items-center gap-1"
            >
              Need credit help? <ArrowRight className="h-3 w-3" />
            </Link>
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
              alt="VestBlock - Funding and AI Automation for Small Businesses"
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
