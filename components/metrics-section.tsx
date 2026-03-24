"use client"

import { Building2, Clock, Zap, Users } from "lucide-react"
import { motion } from "framer-motion"

const metrics = [
  {
    icon: Building2,
    label: "Built for Service Businesses",
    description: "HVAC, roofing, dental, and more"
  },
  {
    icon: Clock,
    label: "24/7 Lead Capture",
    description: "Never miss an opportunity"
  },
  {
    icon: Zap,
    label: "Fast Follow-up",
    description: "Instant lead notifications"
  },
  {
    icon: Users,
    label: "Multiple Funding Partners",
    description: "More options for approval"
  }
]

export function MetricsSection() {
  return (
    <section className="py-16 px-4 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10">
      <div className="container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-14 h-14 bg-background rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <metric.icon className="h-7 w-7 text-cyan-500" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{metric.label}</h3>
              <p className="text-sm text-muted-foreground">{metric.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
