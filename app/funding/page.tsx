"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { FundingEligibilityChecker } from "@/components/funding-eligibility-checker"
import type { FundingEligibilityAnswers } from "@/components/funding-eligibility-checker"
import {
  DollarSign,
  CheckCircle,
  Star,
  ExternalLink,
  Building2,
  CreditCard,
  Home,
  Briefcase,
  Phone,
} from "lucide-react"

export default function FundingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState<null | {
    leadId: string | null
    name: string
    businessType: string
    fundingAmount: string
    email: string
    fundingPlan: null | {
      confidence: 'full' | 'limited'
      readiness: {
        score: number
        label: string
        summary: string
        risks: string[]
        nextSteps: string[]
      }
      strategy: {
        recommendedPath: string
        estimatedFundingMin: number
        estimatedFundingMax: number
        strategySummary: string
        warnings: string[]
      }
      recommendedProducts: Array<{
        id: string
        issuer: string
        productName: string
        type: string
        applicationUrl: string | null
        affiliateUrl: string | null
        estimatedLimitMin: number | null
        estimatedLimitMax: number | null
        recommendedDay: number
        reason: string
        fitScore: number
      }>
    }
  }>(null)
  const [eligibilitySnapshot, setEligibilitySnapshot] = useState<null | FundingEligibilityAnswers>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: user?.email || "",
    phone: "",
    business_type: "",
    funding_amount: "",
    credit_score: "",
    message: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmissionResult(null)

    try {
      const response = await fetch("/api/funding-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: formData.email || user?.email || "",
          eligibilitySnapshot:
            eligibilitySnapshot
              ? {
                  businessStage: eligibilitySnapshot.businessStage,
                  businessAgeMonths: Number(eligibilitySnapshot.businessAgeMonths || 0),
                  monthlyRevenue: Number(eligibilitySnapshot.monthlyRevenue || 0),
                  personalCreditScore: eligibilitySnapshot.personalCreditScore,
                  currentUtilization: eligibilitySnapshot.currentUtilization,
                  recentInquiries: eligibilitySnapshot.recentInquiries,
                  hasEin: eligibilitySnapshot.hasEin,
                  hasBusinessBank: eligibilitySnapshot.hasBusinessBank,
                  hasBusinessCreditCard: eligibilitySnapshot.hasBusinessCreditCard,
                  requestedFundingAmount: Number(eligibilitySnapshot.requestedFundingAmount || 0),
                  useOfFunds: eligibilitySnapshot.useOfFunds,
                }
              : undefined,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit funding lead.")
      }

      toast({
        title: "Funding review request received",
        description: "We'll review your details and follow up with the clearest next step.",
        variant: "default",
      })

      setSubmissionResult({
        leadId: data.leadId || null,
        name: formData.name,
        businessType: formData.business_type,
        fundingAmount: formData.funding_amount,
        email: formData.email || user?.email || "",
        fundingPlan: data.fundingPlan || null,
      })

      setFormData({
        name: "",
        email: user?.email || "",
        phone: "",
        business_type: "",
        funding_amount: "",
        credit_score: "",
        message: "",
      })
    } catch (error) {
      console.error("Error submitting form:", error)
      toast({
        title: "Submission Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error submitting your funding review request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <div className="premium-page">
      
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-6">Check Business Funding Eligibility for Free</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Check whether your business looks ready for funding before you pay for anything. If you need help getting prepared, VestBlock can help with credit, business setup, and documentation through the $300 plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white" asChild>
              <a href="#free-eligibility-check">
                <DollarSign className="mr-2 h-5 w-5" />
                Check Eligibility for Free
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/funding/business-funding-strategy">
                <Phone className="mr-2 h-5 w-5" />
                Review $300 Funding Prep Plan
              </Link>
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/services/business-funding-eligibility" className="underline-offset-4 hover:underline">
              Read the funding eligibility guide
            </Link>
            <Link href="/services/business-funding-strategy" className="underline-offset-4 hover:underline">
              Read the funding prep plan guide
            </Link>
          </div>
        </div>
      </section>
      <section className="pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Free first check</CardTitle>
                <CardDescription>
                  See whether the business looks ready now or needs cleanup before applications.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Paid prep when needed</CardTitle>
                <CardDescription>
                  Move into the $300 plan only when credit, documents, business setup, or sequencing need work.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Partner options after review</CardTitle>
                <CardDescription>
                  Funding partners are shown as options, not guarantees. Terms, limits, and approvals depend on the lender.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
      <section id="free-eligibility-check" className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <FundingEligibilityChecker
            onAssessmentChange={({ answers, submitted }) => {
              setEligibilitySnapshot(submitted ? answers : null)
            }}
          />
        </div>
      </section>
      <section className="py-16">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How funding review works</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              The goal is to reduce wasted applications and make the next step clearer.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Check the basics</CardTitle>
                <CardDescription>
                  Review credit, utilization, inquiries, business setup, EIN, banking, and use of funds.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Fix blockers</CardTitle>
                <CardDescription>
                  Improve the profile first if utilization, inquiries, documents, or business setup still need work.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Choose the next step</CardTitle>
                <CardDescription>
                  Apply through a partner option when you are ready, or use VestBlock paid prep first.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Partner options and paid preparation</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Some businesses are ready to explore partner options now. Others need a cleaner profile, better documents, or more preparation first.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Card className="premium-card border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className="bg-cyan-500 text-white">Partner option</Badge>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <CardTitle className="text-2xl">The Funding Playbook</CardTitle>
                <CardDescription className="text-base">
                  A third-party funding option for businesses that appear ready to pursue lending after review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-cyan-500" />
                    <span>Real Estate Loans</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-cyan-500" />
                    <span>Business Credit Lines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-cyan-500" />
                    <span>Business Loans</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-500" />
                    <span>DSCR Loans</span>
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Use case:</span>
                      <div className="text-cyan-600 font-bold">Business and real estate lending</div>
                    </div>
                    <div>
                      <span className="font-medium">Review note:</span>
                      <div className="text-green-600 font-bold">Terms depend on lender review</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Key Benefits:</h4>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Can be used after a funding review
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Multiple funding categories
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Final approval and terms come from the partner
                    </li>
                  </ul>
                </div>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white" asChild>
                  <a
                    href="https://thefundingplaybook.com/homepage?am_id=VestBlock"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apply with The Funding Playbook
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
            <Card className="premium-card border-2 border-blue-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Partner option</Badge>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <CardTitle className="text-2xl">OPM Mastery Network</CardTitle>
                <CardDescription className="text-base">
                  A third-party option that may work for startup owners with stronger personal credit profiles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Requirements:</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Usually a stronger personal credit profile is needed</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Target Audience:</span>
                    <div className="text-blue-600 font-bold">Startup Business Owners</div>
                  </div>
                  <div>
                    <span className="font-medium">Focus:</span>
                    <div className="text-blue-600 font-bold">Startup-oriented funding option</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Network Benefits:</h4>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      May work for stronger owner-credit profiles
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Useful after a funding-prep decision is made
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Final lender criteria still apply
                    </li>
                  </ul>
                </div>
                <Button className="w-full bg-transparent" variant="outline" asChild>
                  <a
                    href="https://opmmastery.referralrock.com/l/ROBERTSAND60/referral"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join OPM Network
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
            <Card className="premium-card border-2 border-emerald-500/20">
              <CardHeader>
              <Badge className="w-fit bg-emerald-600 text-white">VestBlock paid plan</Badge>
              <CardTitle className="text-2xl">Business Funding Prep Plan</CardTitle>
              <CardDescription className="text-base">
                A $300 plan for business owners who need help getting ready before they pursue funding. A
                10% success fee applies only after approved business credit funding is accepted and available. VestBlock helps organize credit,
                business setup, documentation, use of funds, and application sequencing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg border p-4">
                  <div className="font-medium">Guided review</div>
                  <div className="text-muted-foreground">Creates a funding review and clear follow-up.</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="font-medium">Compliance-Safe</div>
                  <div className="text-muted-foreground">No funding guarantees or hidden application promises.</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="font-medium">$300 Funding Prep Plan</div>
                  <div className="text-muted-foreground">Then 10% after accepted business credit funding is available.</div>
                </div>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                <Link href="/funding/business-funding-strategy">
                  Review Business Funding Prep Plan
                  <CreditCard className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
      <section id="funding-application" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Request a funding review</h2>
              <p className="text-muted-foreground">
                Submit the basic business details and VestBlock can review whether a partner conversation makes sense now or whether prep work comes first.
              </p>
            </div>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Funding review form</CardTitle>
                <CardDescription>
                  Tell us about your business and funding needs so the team can review timing, preparation gaps, and the best next step.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submissionResult && (
                  <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-500" />
                      <div className="space-y-2">
                        <div className="font-semibold text-foreground">
                          Funding review saved for {submissionResult.name}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          VestBlock captured the {submissionResult.businessType} request for {submissionResult.fundingAmount}. The follow-up will go to {submissionResult.email}.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Next step: the file gets reviewed for partner options versus paid preparation, then the team follows up with a clear recommendation.
                        </p>
                        {submissionResult.fundingPlan && (
                          <div className="space-y-3 pt-2">
                            <div className="rounded-lg border border-emerald-500/20 bg-background/60 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">
                                  First recommendation:
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {submissionResult.fundingPlan.strategy.recommendedPath.replace(/_/g, " ")}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {submissionResult.fundingPlan.readiness.score}/100
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {submissionResult.fundingPlan.strategy.strategySummary}
                              </p>
                            </div>
                            {submissionResult.fundingPlan.recommendedProducts.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground">
                                  Suggested first options
                                </div>
                                <div className="space-y-2">
                                  {submissionResult.fundingPlan.recommendedProducts.map((product) => {
                                    const destination = product.affiliateUrl || product.applicationUrl
                                    return (
                                      <div
                                        key={product.id}
                                        className="rounded-lg border border-border bg-background/60 p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div>
                                            <div className="font-medium text-foreground">
                                              {product.productName}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {product.issuer} · day {product.recommendedDay}
                                            </div>
                                          </div>
                                          {destination ? (
                                            <a
                                              href={destination}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-sm font-medium text-cyan-500 hover:text-cyan-400"
                                            >
                                              Review offer
                                            </a>
                                          ) : null}
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                          {product.reason}
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {submissionResult.fundingPlan.readiness.nextSteps.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-foreground">
                                  What to do before applying
                                </div>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {submissionResult.fundingPlan.readiness.nextSteps
                                    .slice(0, 4)
                                    .map((step) => (
                                      <li key={step}>• {step}</li>
                                    ))}
                                </ul>
                              </div>
                            )}
                            {submissionResult.fundingPlan.confidence === "limited" && (
                              <p className="text-xs text-muted-foreground">
                                This recommendation uses limited lead details. Run the free checker first for a stronger sequence.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Full Name *
                      </label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email Address *
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email || user?.email || ""}
                        onChange={handleInputChange}
                        required
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium mb-2">
                        Phone Number (optional)
                      </label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="(555) 123-4567"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Optional. Email is enough to send the next-step snapshot.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="business_type" className="block text-sm font-medium mb-2">
                        Business Type *
                      </label>
                      <Input
                        id="business_type"
                        name="business_type"
                        value={formData.business_type}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., E-commerce, Real Estate, etc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="funding_amount" className="block text-sm font-medium mb-2">
                        Funding Amount Needed *
                      </label>
                      <Input
                        id="funding_amount"
                        name="funding_amount"
                        value={formData.funding_amount}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., $50,000"
                      />
                    </div>
                    <div>
                      <label htmlFor="credit_score" className="block text-sm font-medium mb-2">
                        Personal Credit Score *
                      </label>
                      <Input
                        id="credit_score"
                        name="credit_score"
                        type="number"
                        min="300"
                        max="850"
                        value={formData.credit_score}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., 720"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-2">
                      Additional Information
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Tell us more about your business and funding needs..."
                      rows={4}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Request Funding Review"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose the next step</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Some businesses can explore partner options right away. Others can move into paid preparation first.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white" asChild>
              <Link href="/funding/business-funding-strategy">
                Start $300 Funding Prep Plan
                <CreditCard className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#funding-application">Request Funding Review</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
