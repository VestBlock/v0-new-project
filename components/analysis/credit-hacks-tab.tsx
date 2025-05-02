"use client"

import { useState } from "react"
import { ArrowRight, Zap, Clock, Target, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

type CreditHack = {
  title: string
  description: string
  impact: "high" | "medium" | "low"
  timeframe: string
  steps?: string[]
}

type CreditHacksTabProps = {
  data: {
    recommendations: CreditHack[]
  }
}

export function CreditHacksTab({ data }: CreditHacksTabProps) {
  const [selectedHack, setSelectedHack] = useState<CreditHack | null>(null)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-green-500"
      case "medium":
        return "text-yellow-500"
      case "low":
        return "text-blue-500"
      default:
        return "text-muted-foreground"
    }
  }

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return <Badge className="bg-green-500">High Impact</Badge>
      case "medium":
        return <Badge className="bg-yellow-500">Medium Impact</Badge>
      case "low":
        return <Badge className="bg-blue-500">Low Impact</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const filteredHacks = data.recommendations
    ? data.recommendations.filter((hack) => {
        if (filter === "all") return true
        return hack.impact === filter
      })
    : []

  if (!data.recommendations || data.recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Credit Hacks Available</CardTitle>
          <CardDescription>
            We couldn't generate credit improvement recommendations based on your report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This could be because your report doesn't contain enough information or your credit is already in good
            standing.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try uploading a more complete credit report or check back after you've made some changes to your credit
            profile.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Credit Improvement Strategies</CardTitle>
              <CardDescription>Actionable steps to improve your credit score.</CardDescription>
            </div>
            <div className="flex rounded-md overflow-hidden">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                className="rounded-r-none"
              >
                All
              </Button>
              <Button
                variant={filter === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("high")}
                className="rounded-none border-l-0"
              >
                High Impact
              </Button>
              <Button
                variant={filter === "medium" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("medium")}
                className="rounded-none border-l-0"
              >
                Medium
              </Button>
              <Button
                variant={filter === "low" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("low")}
                className="rounded-l-none border-l-0"
              >
                Low
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHacks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No recommendations available for this filter.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredHacks.map((hack, index) => (
                <Card key={index} className="overflow-hidden h-full flex flex-col">
                  <div className="p-4 flex-grow">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-muted p-2">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{hack.title}</h3>
                          {getImpactBadge(hack.impact)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{hack.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="flex items-center">
                            <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{hack.timeframe}</span>
                          </div>
                          <div className="flex items-center justify-end">
                            <span className={`text-xs font-medium ${getImpactColor(hack.impact)}`}>
                              {hack.impact.charAt(0).toUpperCase() + hack.impact.slice(1)} Impact
                            </span>
                          </div>
                        </div>
                        {hack.steps && hack.steps.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">{hack.steps.length} action steps</span>
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSelectedHack(hack)}>
                          Learn More <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedHack} onOpenChange={(open) => !open && setSelectedHack(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedHack?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center mt-2 space-x-4">
                <div className="flex items-center">
                  <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Timeframe: {selectedHack?.timeframe}</span>
                </div>
                <div className="flex items-center">
                  <span className={`text-sm font-medium ${selectedHack && getImpactColor(selectedHack.impact)}`}>
                    {selectedHack?.impact.charAt(0).toUpperCase() + selectedHack?.impact.slice(1)} Impact
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">{selectedHack?.description}</p>

            {selectedHack?.steps && selectedHack.steps.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Action Steps:</h4>
                <ul className="space-y-2">
                  {selectedHack.steps.map((step, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-md bg-muted p-4">
              <div className="flex items-start">
                <Target className="mr-2 h-5 w-5 text-primary" />
                <div>
                  <h4 className="text-sm font-medium">Expected Outcome</h4>
                  <p className="text-xs text-muted-foreground">
                    Consistently following this strategy can help improve your credit score over time. Results may vary
                    based on your specific credit situation and history.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
