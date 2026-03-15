"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CTAFooter() {
  return (
    <section className="py-20 px-4 bg-gradient-to-r from-cyan-900/20 to-purple-900/20">
      <div className="container mx-auto text-center">
        <h2 className="text-4xl font-bold mb-6">Let AI Build Your Credit & Business Strategy Now</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join thousands who are transforming their financial future with AI-powered guidance
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-600 glow">
            <Link href="/chat">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#features">Learn More</Link>
          </Button>
        </div>
      </div>

      <footer className="mt-20 pt-8 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} VestBlock. All rights reserved.</p>
        </div>
      </footer>
    </section>
  )
}
