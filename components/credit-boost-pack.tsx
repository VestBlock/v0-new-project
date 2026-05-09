"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink, ShieldCheck, TrendingUp } from "lucide-react"
import { buildBoostPackRecommendations, getCreditProfileSignals } from "@/lib/credit/recommendation-engine"
import type { AiDetailedAnalysis } from "@/types/supabase"

interface CreditBoostPackProps {
  extractedText?: string | null
  financialGoalTitle?: string | null
  detailedAnalysis?: AiDetailedAnalysis | null
}

const activationSequence = [
  {
    label: "Week 0-1",
    title: "Activate only the right builders",
    description: "Set autopay immediately and avoid stacking several redundant accounts at once.",
  },
  {
    label: "Week 2-4",
    title: "Wait for first statements",
    description: "Let the first reporting cycle happen before judging whether the move is working.",
  },
  {
    label: "Week 5-8",
    title: "Protect utilization",
    description: "Keep card balances controlled so new positive reporting is not cancelled out by high usage.",
  },
  {
    label: "Week 9-12",
    title: "Reassess before the next move",
    description: "Use updated score, utilization, and dispute progress to decide on secured cards, rent reporting, or funding preparation.",
  },
]

export function CreditBoostPack({
  extractedText,
  financialGoalTitle,
  detailedAnalysis,
}: CreditBoostPackProps) {
  const signals = getCreditProfileSignals({
    extractedText,
    financialGoalTitle,
    detailedAnalysis,
  })

  const recommendedProducts = buildBoostPackRecommendations({
    extractedText,
    financialGoalTitle,
    detailedAnalysis,
  })

  return (
    <div className="space-y-6">
      <Card className="border-cyan-400/30 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Badge className="bg-cyan-500 text-background">VestBlock Boost Pack</Badge>
            {typeof signals.creditScore === "number" && (
              <Badge variant="outline" className="border-cyan-400/40 text-cyan-200">
                Score context: {signals.creditScore}
              </Badge>
            )}
          </div>
          <CardTitle className="mt-3 text-2xl gradient-text">Positive-history rebuild sequence</CardTitle>
          <CardDescription>
            This applies your boost pack in a safer way: one controlled installment builder, one controlled revolving
            builder if appropriate, autopay, low utilization, and careful reporting checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {activationSequence.map((step) => (
              <div key={step.label} className="rounded-lg border border-cyan-400/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{step.label}</p>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <h3 className="font-semibold">What to protect</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-400" />
                  Turn on autopay before the first due date.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-400" />
                  Keep utilization under 30%, ideally under 10%.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-400" />
                  Verify tradelines are actually reporting after the statement cycle.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-yellow-400" />
                <h3 className="font-semibold">What not to do</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-yellow-300" />
                  Do not open several similar products just because they are easy to get.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-yellow-300" />
                  Do not carry high balances that erase the value of new positive reporting.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-yellow-300" />
                  Do not assume every renter should add rent reporting without verification.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {recommendedProducts.map((product) => (
          <Card key={product.name} className="border-primary/20 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription className="mt-1">{product.category}</CardDescription>
                </div>
                {product.featured && <Badge className="bg-cyan-500 text-background">Recommended</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{product.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Best for</p>
                  <p className="font-medium">{product.bestFor || "Credit building"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credit profile</p>
                  <p className="font-medium">{product.minimumCredit || "Varies"}</p>
                </div>
              </div>

              {product.features && product.features.length > 0 && (
                <div className="space-y-2">
                  {product.features.map((feature) => (
                    <div key={feature} className="flex gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              {product.complianceNote && (
                <p className="rounded-md border border-yellow-400/20 bg-yellow-500/5 p-3 text-xs text-yellow-100/85">
                  {product.complianceNote}
                </p>
              )}

              {product.link && (
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <a href={product.link} target="_blank" rel="noopener noreferrer">
                    Review Provider
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default CreditBoostPack
