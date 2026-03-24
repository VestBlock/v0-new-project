"use client"

import { motion } from "framer-motion"
import {
  Thermometer,
  Home,
  Droplets,
  Car,
  Sparkles,
  Stethoscope,
  Hammer,
  SprayCan
} from "lucide-react"

const businessTypes = [
  { name: "HVAC", icon: Thermometer },
  { name: "Roofing", icon: Home },
  { name: "Plumbing", icon: Droplets },
  { name: "Auto Repair", icon: Car },
  { name: "Med Spas", icon: Sparkles },
  { name: "Dental", icon: Stethoscope },
  { name: "Contractors", icon: Hammer },
  { name: "Cleaning", icon: SprayCan },
]

export function BusinessTypesGrid() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Service Businesses</h2>
          <p className="text-xl text-muted-foreground">
            Our funding and AI solutions work for all types of service businesses
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 max-w-5xl mx-auto">
          {businessTypes.map((business, index) => (
            <motion.div
              key={business.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              viewport={{ once: true }}
              className="flex flex-col items-center p-4 rounded-lg bg-card/50 hover:bg-card transition-colors border border-transparent hover:border-cyan-500/30"
            >
              <business.icon className="h-8 w-8 text-cyan-500 mb-2" />
              <span className="text-sm font-medium text-center">{business.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
