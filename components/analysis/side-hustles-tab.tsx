"use client"

import { useState } from "react"
import { ArrowRight, DollarSign, Briefcase, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type SideHustlesTabProps = {
  data: {
    recommendations: Array<{
      title: string
      description: string
      potentialEarnings: string
      startupCost: string
      difficulty: "easy" | "medium" | "hard"
    }>
  }
}

export function SideHustlesTab({ data }: SideHustlesTabProps) {
  const [selectedHustle, setSelectedHustle] = useState<SideHustlesTabProps["data"]["recommendations"][0] | null>(null)

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "text-green-500"
      case "medium":
        return "text-yellow-500"
      case "hard":
        return "text-red-500"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Side Hustle Recommendations</CardTitle>
          <CardDescription>Personalized side hustle ideas to help increase your income.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recommendations.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No recommendations available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.recommendations.map((hustle, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-muted p-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{hustle.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{hustle.description}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="flex items-center">
                            <DollarSign className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{hustle.potentialEarnings}</span>
                          </div>
                          <div className="flex items-center justify-end">
                            <span className={`text-xs font-medium ${getDifficultyColor(hustle.difficulty)}`}>
                              {hustle.difficulty.charAt(0).toUpperCase() + hustle.difficulty.slice(1)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => setSelectedHustle(hustle)}
                        >
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

      <Dialog open={!!selectedHustle} onOpenChange={(open) => !open && setSelectedHustle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedHustle?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center mt-2 space-x-4">
                <div className="flex items-center">
                  <DollarSign className="mr-1 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Potential: {selectedHustle?.potentialEarnings}</span>
                </div>
                <div className="flex items-center">
                  <span
                    className={`text-sm font-medium ${selectedHustle && getDifficultyColor(selectedHustle.difficulty)}`}
                  >
                    {selectedHustle?.difficulty.charAt(0).toUpperCase() + selectedHustle?.difficulty.slice(1)}{" "}
                    Difficulty
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">{selectedHustle?.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Startup Cost</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm">{selectedHustle?.startupCost}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Time Investment</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm">
                    {selectedHustle?.difficulty === "easy"
                      ? "5-10 hours/week"
                      : selectedHustle?.difficulty === "medium"
                        ? "10-20 hours/week"
                        : "20+ hours/week"}
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-start">
                <Clock className="mr-2 h-5 w-5 text-primary" />
                <div>
                  <h4 className="text-sm font-medium">Getting Started</h4>
                  <p className="text-xs text-muted-foreground">
                    Start small and build up gradually. Focus on delivering quality and building a reputation in your
                    chosen field.
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
