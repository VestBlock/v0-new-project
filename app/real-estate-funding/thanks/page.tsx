"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Phone, Home } from "lucide-react"
import Link from "next/link"

export default function RealEstateFundingThanksPage() {
  useEffect(() => {
    // Track conversion on page load
    if (typeof window !== 'undefined') {
      // Google Analytics / gtag
      if ((window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'event_category': 'Real Estate Funding',
          'event_label': 'Thank You Page View',
          'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL' // Replace with actual conversion ID
        })
      }

      // Facebook Pixel
      if ((window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Real Estate Funding Application'
        })
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <Card className="bg-card/80 backdrop-blur">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-4">
              Application Received!
            </h1>

            <p className="text-muted-foreground mb-6">
              Thank you for submitting your real estate funding application.
              Our team will review your information and get back to you within
              <span className="text-foreground font-medium"> 24 hours</span>.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-2">Need faster response?</p>
              <a
                href="tel:+18005551234"
                className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-400 font-medium"
              >
                <Phone className="h-4 w-4" />
                Call us directly
              </a>
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full bg-cyan-500 hover:bg-cyan-600">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link href="/funding">
                  Explore More Funding Options
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Check your email for a confirmation message.
        </p>
      </div>
    </div>
  )
}
