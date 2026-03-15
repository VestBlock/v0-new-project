"use client"

import { Card } from "@/components/ui/card"
import { FileText, Building, Lightbulb, FileEdit, MessageSquare } from "lucide-react"
import { motion } from "framer-motion"

const tools = [
  {
    icon: FileText,
    title: "AI Credit Report Analyzer",
    description: "Deep analysis of your credit report with actionable insights",
  },
  {
    icon: Building,
    title: "Business Credit Blueprint",
    description: "Build business credit from scratch with AI guidance",
  },
  {
    icon: Lightbulb,
    title: "Side Hustle Generator",
    description: "Personalized income opportunities based on your skills",
  },
  {
    icon: FileEdit,
    title: "Dispute Letter Builder",
    description: "Generate FCRA-compliant dispute letters instantly",
  },
  {
    icon: MessageSquare,
    title: "24/7 GPT Financial Chatbot",
    description: "Get instant answers to all your financial questions",
  },
]

export function AITools() {
  return (
    <section id="features" className="py-20 px-4">
      <div className="container mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12 gradient-text">AI Tools Included</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 hover:border-cyan-500 transition-colors bg-card/80 backdrop-blur">
                <tool.icon className="h-12 w-12 text-cyan-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{tool.title}</h3>
                <p className="text-muted-foreground">{tool.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
