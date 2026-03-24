"use client"

import { FileText, Search, CheckCircle, Palette, Globe, Bell, DollarSign, Bot } from "lucide-react"
import { motion } from "framer-motion"

const fundingSteps = [
  {
    step: 1,
    title: "Submit Request",
    description: "Fill out a quick 2-minute application",
  },
  {
    step: 2,
    title: "Match with Options",
    description: "We connect you with the right funding partners",
  },
  {
    step: 3,
    title: "Get Funded",
    description: "Receive funding decision and next steps",
  },
]

const aiSteps = [
  {
    step: 1,
    title: "Choose Template",
    description: "Select your industry (HVAC, roofing, dental, etc.)",
  },
  {
    step: 2,
    title: "We Install It",
    description: "AI assistant goes live on your website",
  },
  {
    step: 3,
    title: "Leads Delivered",
    description: "Receive leads and bookings automatically",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-card/50">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground">Two paths to grow your business</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Funding Track */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold">Get Funding</h3>
            </div>

            <div className="space-y-6">
              {fundingSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-cyan-500/20 text-cyan-500 rounded-full flex items-center justify-center font-bold">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{step.title}</h4>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* AI Assistant Track */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold">AI Assistant</h3>
            </div>

            <div className="space-y-6">
              {aiSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center font-bold">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{step.title}</h4>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
