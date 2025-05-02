"use client"

import { CreditCard, Star, DollarSign, Percent, Check, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CreditCardRecommendation = {
  name: string
  issuer: string
  annualFee: string
  apr: string
  rewards: string
  approvalLikelihood: "high" | "medium" | "low"
  bestFor: string
}

type CreditCardsTabProps = {
  data: {
    recommendations: CreditCardRecommendation[]
  }
}

export function CreditCardsTab({ data }: CreditCardsTabProps) {
  const getApprovalColor = (likelihood: string) => {
    switch (likelihood) {
      case "high":
        return "text-green-500"
      case "medium":
        return "text-yellow-500"
      case "low":
        return "text-red-500"
      default:
        return "text-muted-foreground"
    }
  }

  const getApprovalBadge = (likelihood: string) => {
    switch (likelihood) {
      case "high":
        return <Badge className="bg-green-500">High Approval</Badge>
      case "medium":
        return <Badge className="bg-yellow-500">Medium Approval</Badge>
      case "low":
        return <Badge className="bg-red-500">Low Approval</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (!data.recommendations || data.recommendations.length === 0) {
    return (
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Credit Card Recommendations</CardTitle>
          <CardDescription>
            We couldn't generate credit card recommendations based on your profile. This could be because your credit
            report doesn't contain enough information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Recommendations Available</h3>
            <p className="text-muted-foreground max-w-md">
              Try uploading a more complete credit report or check back after you've implemented some of our credit
              improvement strategies.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Credit Card Recommendations</CardTitle>
          <CardDescription>
            Based on your credit profile, these cards offer the best approval odds and benefits for your situation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.recommendations.map((card, index) => (
              <Card key={index} className="overflow-hidden h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{card.name}</CardTitle>
                    {getApprovalBadge(card.approvalLikelihood)}
                  </div>
                  <CardDescription>{card.issuer}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span className="text-muted-foreground">Annual Fee:</span>
                      </div>
                      <div className="font-medium">{card.annualFee}</div>

                      <div className="flex items-center">
                        <Percent className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span className="text-muted-foreground">APR:</span>
                      </div>
                      <div className="font-medium">{card.apr}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 mr-1 text-amber-500" />
                        <span className="text-sm font-medium">Rewards</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{card.rewards}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Check className="h-4 w-4 mr-1 text-green-500" />
                        <span className="text-sm font-medium">Best For</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{card.bestFor}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Button className="w-full" variant="outline">
                              Learn More
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>VestBlock does not directly process applications.</p>
                          <p>Search for this card online to apply.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center justify-center mt-2">
                      <AlertCircle className="h-3 w-3 mr-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Not affiliated with card issuers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
