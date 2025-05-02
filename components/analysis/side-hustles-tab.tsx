"use client"

import { useState } from "react"
import { ArrowRight, DollarSign, Briefcase, Clock, Lightbulb, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

type SideHustle = {
  title: string
  description: string
  potentialEarnings: string
  startupCost: string
  difficulty: "easy" | "medium" | "hard"
  timeCommitment?: string
  skills?: string[]
}

type SideHustlesTabProps = {
  data: {
    recommendations: SideHustle[]
  }
}

export function SideHustlesTab({ data }: SideHustlesTabProps) {
  const [selectedHustle, setSelectedHustle] = useState<SideHustle | null>(null)
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all")
  const [sortBy, setSortBy] = useState<"earnings" | "cost" | "difficulty">("earnings")

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

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return <Badge className="bg-green-500">Easy</Badge>
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>
      case "hard":
        return <Badge className="bg-red-500">Hard</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const sortHustles = (hustles: SideHustle[]) => {
    if (!hustles || hustles.length === 0) return []

    const sortedHustles = [...hustles]

    if (sortBy === "earnings") {
      return sortedHustles.sort((a, b) => {
        // Extract numeric values from earnings strings
        const aValue = Number.parseInt(a.potentialEarnings.replace(/[^0-9]/g, "")) || 0
        const bValue = Number.parseInt(b.potentialEarnings.replace(/[^0-9]/g, "")) || 0
        return bValue - aValue
      })
    }

    if (sortBy === "cost") {
      return sortedHustles.sort((a, b) => {
        // Extract numeric values from cost strings
        const aValue = Number.parseInt(a.startupCost.replace(/[^0-9]/g, "")) || 0
        const bValue = Number.parseInt(b.startupCost.replace(/[^0-9]/g, "")) || 0
        return aValue - bValue
      })
    }

    if (sortBy === "difficulty") {
      const difficultyOrder = { easy: 0, medium: 1, hard: 2 }
      return sortedHustles.sort((a, b) => {
        return (
          difficultyOrder[a.difficulty as keyof typeof difficultyOrder] -
          difficultyOrder[b.difficulty as keyof typeof difficultyOrder]
        )
      })
    }

    return sortedHustles
  }

  const filteredHustles = data.recommendations
    ? data.recommendations.filter((hustle) => {
        if (filter === "all") return true
        return hustle.difficulty === filter
      })
    : []

  const sortedAndFilteredHustles = sortHustles(filteredHustles)

  if (!data.recommendations || data.recommendations.length === 0) {
    return (
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Side Hustle Recommendations</CardTitle>
          <CardDescription>
            We couldn't generate side hustle recommendations based on your profile. This could be because your credit
            report doesn't contain enough information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Side Hustle Recommendations</CardTitle>
              <CardDescription>Personalized side hustle ideas to help increase your income.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
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
                  variant={filter === "easy" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("easy")}
                  className="rounded-none border-l-0"
                >
                  Easy
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
                  variant={filter === "hard" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("hard")}
                  className="rounded-l-none border-l-0"
                >
                  Hard
                </Button>
              </div>
              <select
                className="px-2 py-1 text-sm rounded-md border bg-background"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="earnings">Sort by: Earnings</option>
                <option value="cost">Sort by: Startup Cost</option>
                <option value="difficulty">Sort by: Difficulty</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedAndFilteredHustles.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No recommendations available for this filter.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedAndFilteredHustles.map((hustle, index) => (
                <Card key={index} className="overflow-hidden h-full flex flex-col">
                  <div className="p-4 flex-grow">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-muted p-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{hustle.title}</h3>
                          {getDifficultyBadge(hustle.difficulty)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{hustle.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="flex items-center">
                            <DollarSign className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{hustle.potentialEarnings}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{hustle.timeCommitment || "Varies"}</span>
                          </div>
                        </div>
                        {hustle.skills && hustle.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {hustle.skills.slice(0, 2).map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {hustle.skills.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{hustle.skills.length - 2} more
                              </Badge>
                            )}
                          </div>
                        )}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedHustle?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex flex-wrap items-center mt-2 gap-2">
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
                {selectedHustle?.timeCommitment && (
                  <div className="flex items-center">
                    <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{selectedHustle.timeCommitment}</span>
                  </div>
                )}
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
                  <CardTitle className="text-sm">Skills Required</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {selectedHustle?.skills && selectedHustle.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedHustle.skills.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm">No specific skills required</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-start">
                <Lightbulb className="mr-2 h-5 w-5 text-primary" />
                <div>
                  <h4 className="text-sm font-medium">Getting Started</h4>
                  <p className="text-xs text-muted-foreground">
                    Start small and build up gradually. Focus on delivering quality and building a reputation in your
                    chosen field.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-start">
                <Zap className="mr-2 h-5 w-5 text-amber-500" />
                <div>
                  <h4 className="text-sm font-medium">Pro Tip</h4>
                  <p className="text-xs text-muted-foreground">
                    Consider combining this side hustle with others for maximum income potential. Always track your
                    expenses for tax purposes.
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
