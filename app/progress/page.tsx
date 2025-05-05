"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PlusCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-client"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export default function ProgressPage() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    async function fetchScores() {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from("credit_scores")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: true })

        if (error) throw error

        // Filter out null scores for the chart
        const validScores = data.filter((score) => score.score !== null)
        setScores(validScores)
      } catch (err) {
        console.error("Error fetching credit scores:", err)
        setError("Failed to load your credit score history. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchScores()
  }, [user])

  const handleAddScore = () => {
    router.push("/add-score")
  }

  if (loading) {
    return (
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Loading your credit score history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Group scores by bureau
  const bureaus = [...new Set(scores.map((score) => score.bureau))]
  const scoresByBureau: Record<string, any[]> = {}

  bureaus.forEach((bureau) => {
    scoresByBureau[bureau] = scores.filter((score) => score.bureau === bureau)
  })

  // Format data for the chart
  const chartData = scores.reduce((acc: any[], score) => {
    const existingDate = acc.find((item) => item.date === score.date)
    if (existingDate) {
      existingDate[score.bureau] = score.score
    } else {
      const newItem: any = { date: score.date }
      newItem[score.bureau] = score.score
      acc.push(newItem)
    }
    return acc
  }, [])

  // Sort chart data by date
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Create chart config
  const chartConfig: Record<string, { label: string; color: string }> = {}
  bureaus.forEach((bureau, index) => {
    const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"]
    chartConfig[bureau] = {
      label: bureau,
      color: colors[index % colors.length],
    }
  })

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Credit Score Progress</h1>
        <Button onClick={handleAddScore}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Score
        </Button>
      </div>

      {scores.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Credit Scores</CardTitle>
            <CardDescription>You haven't added any credit scores yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Track your credit score progress over time by adding your scores from different bureaus.
            </p>
            <Button onClick={handleAddScore}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Score
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Credit Score Trend</CardTitle>
              <CardDescription>Track your credit score progress over time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[300, 850]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {bureaus.map((bureau) => (
                        <Line
                          key={bureau}
                          type="monotone"
                          dataKey={bureau}
                          stroke={`var(--color-${bureau.toLowerCase().replace(/\s+/g, "-")})`}
                          name={bureau}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue={bureaus[0]}>
            <TabsList className="mb-4">
              {bureaus.map((bureau) => (
                <TabsTrigger key={bureau} value={bureau}>
                  {bureau}
                </TabsTrigger>
              ))}
            </TabsList>
            {bureaus.map((bureau) => (
              <TabsContent key={bureau} value={bureau}>
                <Card>
                  <CardHeader>
                    <CardTitle>{bureau} Credit Scores</CardTitle>
                    <CardDescription>Your credit score history from {bureau}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {scoresByBureau[bureau].map((score) => (
                        <div key={score.id} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="font-medium">{new Date(score.date).toLocaleDateString()}</p>
                            <p className="text-sm text-muted-foreground">{score.notes || "No notes"}</p>
                          </div>
                          <div className="text-xl font-bold">{score.score}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  )
}
