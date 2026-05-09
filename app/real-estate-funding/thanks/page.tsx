"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Phone, Home, ArrowUpRight, Building2 } from "lucide-react"
import Link from "next/link"
import { buildPartnerReferralPath, partnerReferralDefinitions } from "@/lib/partners/referrals"

function RealEstateFundingThanksContent() {
  const searchParams = useSearchParams()
  const leadId = searchParams.get("leadId")
  const loanType = searchParams.get("loanType") || "dscr"
  const primaryPartner = loanType === "hard-money" ? partnerReferralDefinitions.rcn : partnerReferralDefinitions.kiavi
  const secondaryPartner = loanType === "hard-money" ? partnerReferralDefinitions.kiavi : partnerReferralDefinitions.rcn

  useEffect(() => {
    // Track conversion on page load
    if (typeof window !== 'undefined') {
      // Google Analytics / gtag
      if ((window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'event_category': 'Real Estate Funding',
          'event_label': 'Thank You Page View',
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
              <p className="text-sm text-muted-foreground mb-2">Need to add a detail to the deal?</p>
              <a
                href="mailto:contact@vestblock.io?subject=Real%20Estate%20Funding%20Application%20Follow-up"
                className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-400 font-medium"
              >
                <Phone className="h-4 w-4" />
                Email VestBlock
              </a>
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 mb-6 text-left">
              <div className="mb-3 flex items-center gap-2 text-cyan-600">
                <Building2 className="h-4 w-4" />
                <p className="text-sm font-medium">Partner routes tied to this submission</p>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                If the deal is already well packaged, you can open a tracked partner path now. VestBlock still keeps this request in review on our side.
              </p>
              <div className="space-y-3">
                <a
                  href={buildPartnerReferralPath({
                    partnerKey: primaryPartner.key,
                    source: "real-estate-funding-thanks",
                    leadId,
                    loanType,
                    service: "real_estate_funding",
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-lg border border-cyan-500/20 bg-background px-4 py-3 transition-colors hover:border-cyan-500/50"
                >
                  <div>
                    <p className="font-medium">{primaryPartner.displayName}</p>
                    <p className="text-sm text-muted-foreground">{primaryPartner.fitSummary}</p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-cyan-500" />
                </a>
                <a
                  href={buildPartnerReferralPath({
                    partnerKey: secondaryPartner.key,
                    source: "real-estate-funding-thanks",
                    leadId,
                    loanType,
                    service: "real_estate_funding",
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-cyan-500/40"
                >
                  <div>
                    <p className="font-medium">{secondaryPartner.displayName}</p>
                    <p className="text-sm text-muted-foreground">{secondaryPartner.fitSummary}</p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-cyan-500" />
                </a>
              </div>
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
          If you used your main business email, keep an eye on that inbox for follow-up.
        </p>
      </div>
    </div>
  )
}

export default function RealEstateFundingThanksPage() {
  return (
    <Suspense fallback={null}>
      <RealEstateFundingThanksContent />
    </Suspense>
  )
}
