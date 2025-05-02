"use client"

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type OverviewTabProps = {
  data: {
    score: number | null
    summary: string
    positiveFactors: string[]
    negativeFactors: string[]
  }
}

export function OverviewTab({ data }: OverviewTabProps) {
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-500"
    if (score >= 750) return "text-green-500"
    if (score >= 700) return "text-green-400"
    if (score >= 650) return "text-yellow-500"
    if (score >= 600) return "text-yellow-600"
    if (score >= 550) return "text-orange-500"
    return "text-red-500"
  }

  const getScoreCategory = (score: number | null) => {
    if (score === null) return "Not Available"
    if (score >= 750) return "Excellent"
    if (score >= 700) return "Very Good"
    if (score >= 650) return "Good"
    if (score >= 600) return "Fair"
    if (score >= 550) return "Poor"
    return "Very Poor"
  }

  const getScoreProgress = (score: number | null) => {
    return score ? (score / 850) * 100 : 0
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
            {data.score === null ? (
              <>
                <div className="text-2xl font-bold text-gray-500">Not Available</div>
                <Alert variant="warning" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Credit Score Found</AlertTitle>
                  <AlertDescription>
                    We couldn't find a credit score in your report. This is common if your report doesn't explicitly
                    list a score or if you've uploaded a partial report. You can still benefit from our analysis of the
                    other information in your report.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>A summary of your credit report analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.summary ? (
            <p className="text-sm">{data.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No summary available for this analysis.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Positive Factors</CardTitle>
            <CardDescription>Factors that are helping your credit score.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.positiveFactors && data.positiveFactors.length > 0 ? (
              <ul className="space-y-2">
                {data.positiveFactors.map((factor, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm">{factor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No positive factors identified in this analysis.</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Negative Factors</CardTitle>
            <CardDescription>Factors that are hurting your credit score.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.negativeFactors && data.negativeFactors.length > 0 ? (
              <ul className="space-y-2">
                {data.negativeFactors.map((factor, index) => (
                  <li key={index} className="flex items-start">
                    <XCircle className="mr-2 h-5 w-5 text-red-500 shrink-0" />
                    <span className="text-sm">{factor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No negative factors identified in this analysis.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
