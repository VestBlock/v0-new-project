"use client"

import { Card } from "@/components/ui/card"
import { Star } from "lucide-react"
import { motion } from "framer-motion"

const testimonials = [
  {
    name: "Sarah M.",
    role: "Small Business Owner",
    content:
      "VestBlock's AI helped me increase my credit score by 120 points in just 3 months. The dispute letters were incredibly effective!",
    rating: 5,
  },
  {
    name: "James T.",
    role: "Freelancer",
    content:
      "The side hustle generator gave me ideas I never would have thought of. I'm now making an extra $2k/month!",
    rating: 5,
  },
  {
    name: "Maria L.",
    role: "Entrepreneur",
    content:
      "Building business credit seemed impossible until I found VestBlock. The AI blueprint made it so simple and straightforward.",
    rating: 5,
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12 gradient-text">Real Results from Real Users</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 bg-card/80 backdrop-blur">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
