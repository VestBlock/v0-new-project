"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type OverviewTabProps = {
  data: {
    score: number
    summary: string
    positiveFactors: string[]
    negativeFactors: string[]
  }
}

export function OverviewTab({ data }: OverviewTabProps) {
  const getScoreColor = (score: number) => {
    if (score >= 750) return "text-green-500"
    if (score >= 700) return "text-green-400"
    if (score >= 650) return "text-yellow-500"
    if (score >= 600) return "text-yellow-600"
    if (score >= 550) return "text-orange-500"
    return "text-red-500"
  }

  const getScoreCategory = (score: number) => {
    if (score >= 750) return "Excellent"
    if (score >= 700) return "Very Good"
    if (score >= 650) return "Good"
    if (score >= 600) return "Fair"
    if (score >= 550) return "Poor"
    return "Very Poor"
  }

  const getScoreProgress = (score: number) => {
    return (score / 850) * 100
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Credit Score</CardTitle>
          <CardDescription>Your current credit score and rating.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className={`text-5xl font-bold ${getScoreColor(data.score)}`}>{data.score}</div>
            <div className="text-lg font-medium">{getScoreCategory(data.score)}</div>
            <div className="w-full">
              <Progress value={getScoreProgress(data.score)} className="h-3" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Poor (300)</span>
                <span>Fair (600)</span>
                <span>Good (670)</span>
                <span>Excellent (800+)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>A summary of your credit report analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Positive Factors</CardTitle>
            <CardDescription>Factors that are helping your credit score.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.positiveFactors.map((factor, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm">{factor}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Negative Factors</CardTitle>
            <CardDescription>Factors that are hurting your credit score.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.negativeFactors.map((factor, index) => (
                <li key={index} className="flex items-start">
                  <XCircle className="mr-2 h-5 w-5 text-red-500 shrink-0" />
                  <span className="text-sm">{factor}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
