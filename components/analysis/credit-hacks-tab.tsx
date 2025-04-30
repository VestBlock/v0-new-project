"use client"

import { useState } from "react"
import { ArrowRight, Clock, TrendingUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type CreditHacksTabProps = {
  data: {
    recommendations: Array<{
      title: string
      description: string
      impact: "high" | "medium" | "low"
      timeframe: string
    }>
  }
}

export function CreditHacksTab({ data }: CreditHacksTabProps) {
  const [selectedHack, setSelectedHack] = useState<CreditHacksTabProps["data"]["recommendations"][0] | null>(null)

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

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "high":
        return <TrendingUp className="h-5 w-5 text-green-500" />
      case "medium":
        return <TrendingUp className="h-5 w-5 text-yellow-500" />
      case "low":
        return <TrendingUp className="h-5 w-5 text-blue-500" />
      default:
        return <TrendingUp className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Credit Improvement Strategies</CardTitle>
          <CardDescription>Personalized recommendations to help improve your credit score.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recommendations.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No recommendations available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.recommendations.map((hack, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-muted p-2">{getImpactIcon(hack.impact)}</div>
                      <div className="flex-1">
                        <h3 className="font-medium">{hack.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{hack.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center">
                            <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{hack.timeframe}</span>
                          </div>
                          <div className="flex items-center">
                            <span className={`text-xs font-medium ${getImpactColor(hack.impact)}`}>
                              {hack.impact.charAt(0).toUpperCase() + hack.impact.slice(1)} Impact
                            </span>
                          </div>
                        </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedHack?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center mt-2 space-x-4">
                <div className="flex items-center">
                  <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{selectedHack?.timeframe}</span>
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
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-start">
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                <div>
                  <h4 className="text-sm font-medium">Important Note</h4>
                  <p className="text-xs text-muted-foreground">
                    Credit improvement takes time and consistent effort. Results may vary based on your specific credit
                    situation and history.
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
