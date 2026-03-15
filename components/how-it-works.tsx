"use client"

import { Upload, Brain, Download, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"

const steps = [
  {
    icon: Upload,
    title: "Upload Your Credit Report (Free)",
    description: "Start by uploading your credit report. Our AI instantly analyzes it to identify opportunities for improvement.",
  },
  {
    icon: Brain,
    title: "Get Your AI Opportunity Plan",
    description: "Receive a personalized financial roadmap with actionable steps to improve your credit and unlock funding options.",
  },
  {
    icon: Download,
    title: "Generate Dispute Letters",
    description: "Automatically generate professional dispute letters to challenge inaccuracies and boost your credit profile.",
  },
  {
    icon: TrendingUp,
    title: "Increase Your Approval Odds",
    description: "Follow your custom plan to improve your credit score and increase your chances of getting approved for funding.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-card/50">
      <div className="container mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12 gradient-text">How It Works</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="mb-4 mx-auto w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                <step.icon className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
