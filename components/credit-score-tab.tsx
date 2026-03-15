"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ArrowUp, Info, AlertCircle, CheckCircle } from "lucide-react"

export function CreditScoreTab() {
  const [creditScore, setCreditScore] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Simulate fetching credit score
  const fetchCreditScore = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      // Random score between 550 and 750
      setCreditScore(Math.floor(Math.random() * (750 - 550 + 1)) + 550)
      setIsLoading(false)
    }, 1500)
  }

  const getScoreCategory = (score: number) => {
    if (score < 580) return { category: "Poor", color: "text-red-500" }
    if (score < 670) return { category: "Fair", color: "text-orange-500" }
    if (score < 740) return { category: "Good", color: "text-blue-500" }
    if (score < 800) return { category: "Very Good", color: "text-green-500" }
    return { category: "Excellent", color: "text-emerald-500" }
  }

  const getScoreProgress = (score: number) => {
    // Convert score to percentage (300-850 scale)
    return ((score - 300) / (850 - 300)) * 100
  }

  const improvementTips = [
    {
      title: "Pay bills on time",
      description: "Payment history accounts for 35% of your credit score.",
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    },
    {
      title: "Reduce credit utilization",
      description: "Try to keep your credit card balances below 30% of your credit limits.",
      icon: <ArrowUp className="h-5 w-5 text-blue-500" />,
    },
    {
      title: "Consider Kikoff Credit Builder",
      description: "Boost your credit score with as little as $10 a month using Kikoff.",
      icon: <Info className="h-5 w-5 text-purple-500" />,
    },
    {
      title: "Avoid multiple credit applications",
      description: "Each application can temporarily lower your score by 5-10 points.",
      icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Credit Score</CardTitle>
          <CardDescription>View your current credit score and track improvements over time</CardDescription>
        </CardHeader>
        <CardContent>
          {creditScore ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Poor</span>
                <span className="text-sm text-muted-foreground">Excellent</span>
              </div>
              <Progress value={getScoreProgress(creditScore)} className="h-3" />

              <div className="flex items-center justify-center mt-4">
                <div className="text-center">
                  <div className="text-5xl font-bold">{creditScore}</div>
                  <div className={`text-xl font-medium mt-1 ${getScoreCategory(creditScore).color}`}>
                    {getScoreCategory(creditScore).category}
                  </div>
                </div>
              </div>

              <Button onClick={fetchCreditScore} disabled={isLoading} className="w-full mt-4">
                {isLoading ? "Updating..." : "Refresh Score"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Check your current credit score to see where you stand</p>
              <Button onClick={fetchCreditScore} disabled={isLoading}>
                {isLoading ? "Loading..." : "Check Credit Score"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Improvement Tips</CardTitle>
          <CardDescription>Follow these recommendations to improve your credit score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {improvementTips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="mt-0.5">{tip.icon}</div>
                <div>
                  <h4 className="font-medium">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
