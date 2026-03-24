"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Bot, CreditCard, ArrowRight, MessageSquare, Calendar, FileText, Building2 } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export function ServiceCards() {
  const services = [
    {
      title: "Business Funding",
      description: "Working capital, equipment financing, and expansion funding for your business.",
      features: [
        "Multiple funding options",
        "Quick approval process",
        "Spanish support available"
      ],
      icon: DollarSign,
      cta: "Apply for Funding",
      href: "/funding",
      primary: true
    },
    {
      title: "AI Assistant + Booking",
      description: "AI that answers questions, captures leads, and books appointments automatically.",
      features: [
        "24/7 lead capture",
        "Appointment booking",
        "Installs on your website fast"
      ],
      icon: Bot,
      cta: "Try Demo",
      ctaSecondary: "Request Setup",
      href: "/ai-assistant",
      primary: true
    },
    {
      title: "Credit Tools",
      description: "Credit analyzer, improvement roadmap, and dispute letter generator.",
      features: [
        "AI credit analysis",
        "Personalized roadmap",
        "Dispute letter templates"
      ],
      icon: CreditCard,
      cta: "Analyze My Credit",
      href: "/credit-upload",
      primary: false
    },
    {
      title: "Real Estate Funding",
      description: "DSCR loans for rentals or hard money for fix & flip projects.",
      features: [
        "DSCR loans",
        "Hard money / fix & flip",
        "Fast closings"
      ],
      icon: Building2,
      cta: "Apply Now",
      href: "/real-estate-funding",
      primary: false
    }
  ]

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How We Help Your Business Grow</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful solutions to help you get funded, automate your leads, and build better credit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className={`h-full bg-card/80 backdrop-blur border-2 hover:border-cyan-500/50 transition-all duration-300 ${service.primary ? 'border-cyan-500/30' : ''}`}>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${service.primary ? 'bg-cyan-500/20' : 'bg-muted'}`}>
                    <service.icon className={`h-6 w-6 ${service.primary ? 'text-cyan-500' : 'text-muted-foreground'}`} />
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {service.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2">
                    <Button
                      className={service.primary ? "bg-cyan-500 hover:bg-cyan-600 w-full" : "w-full"}
                      variant={service.primary ? "default" : "outline"}
                      asChild
                    >
                      <Link href={service.href}>
                        {service.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    {service.ctaSecondary && (
                      <Button variant="ghost" className="w-full" asChild>
                        <Link href={`${service.href}#request-setup`}>
                          {service.ctaSecondary}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
