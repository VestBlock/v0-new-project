"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { OverviewTab } from "@/components/analysis/overview-tab"
import { DisputesTab } from "@/components/analysis/disputes-tab"
import { CreditHacksTab } from "@/components/analysis/credit-hacks-tab"
import { SideHustlesTab } from "@/components/analysis/side-hustles-tab"
import { ChatTab } from "@/components/analysis/chat-tab"
import { NotesTab } from "@/components/analysis/notes-tab"
import { supabase } from "@/lib/supabase"
import type { Analysis } from "@/lib/supabase"

type AnalysisData = {
  id: string
  overview: {
    score: number
    summary: string
    positiveFactors: string[]
    negativeFactors: string[]
  }
  disputes: {
    items: Array<{
      bureau: string
      accountName: string
      accountNumber: string
      issueType: string
      recommendedAction: string
    }>
  }
  creditHacks: {
    recommendations: Array<{
      title: string
      description: string
      impact: "high" | "medium" | "low"
      timeframe: string
    }>
  }
  sideHustles: {
    recommendations: Array<{
      title: string
      description: string
      potentialEarnings: string
      startupCost: string
      difficulty: "easy" | "medium" | "hard"
    }>
  }
}

export default function CreditAnalysisPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const analysisId = searchParams.get("id")
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!analysisId || !user) return

      try {
        // Fetch the analysis record from Supabase
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("id", analysisId)
          .eq("user_id", user.id)
          .single()

        if (error) throw error

        setAnalysis(data as Analysis)

        // If the analysis is still processing, return the status
        if (data.status === "processing") {
          setIsLoading(false)
          return
        }

        // If the analysis failed, show an error
        if (data.status === "error") {
          toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: "There was an error analyzing your credit report. Please try again.",
          })
          setIsLoading(false)
          return
        }

        // Set the analysis data
        setAnalysisData({
          id: data.id,
          ...data.result,
        })
      } catch (error) {
        console.error("Error fetching analysis:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load analysis data. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalysis()
  }, [analysisId, user, toast])

  const handleExportPDF = async () => {
    if (!analysisId) return

    try {
      const response = await fetch(`/api/export-pdf/${analysisId}`)

      if (!response.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `credit-analysis-${analysisId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export PDF. Please try again.",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Analyzing your credit report...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Analysis Not Found</CardTitle>
            <CardDescription>The requested analysis could not be found or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/dashboard">Return to Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (analysis.status === "processing") {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Your credit report is still being analyzed...</p>
          <p className="text-muted-foreground mt-2">This may take a few minutes. Please check back later.</p>
          <Button asChild className="mt-6">
            <a href="/dashboard">Return to Dashboard</a>
          </Button>
        </div>
      </div>
    )
  }

  if (!user?.isPro) {
    return (
      <div className="container py-10">
        <Card className="card-glow mb-6">
          <CardHeader>
            <CardTitle>Upgrade to Pro</CardTitle>
            <CardDescription>You need to upgrade to Pro to view the full analysis.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">What you'll get with Pro:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Full credit analysis with personalized recommendations</li>
                  <li>Custom dispute letters for all negative items</li>
                  <li>Credit hack strategies to boost your score</li>
                  <li>Side hustle recommendations based on your profile</li>
                  <li>AI chat assistant to answer your credit questions</li>
                </ul>
              </div>
              <Button asChild className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500">
                <a href="/pricing">Upgrade to Pro</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Credit Overview Preview</CardTitle>
            <CardDescription>Here's a preview of your credit analysis.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Credit Score</h3>
                <div className="flex items-center">
                  <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                      style={{ width: `${((analysisData?.overview.score || 0) / 850) * 100}%` }}
                    />
                  </div>
                  <span className="ml-2 font-bold">{analysisData?.overview.score || 0}</span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {analysisData?.overview.summary || "No summary available."}
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Positive Factors</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {analysisData?.overview.positiveFactors
                    .slice(0, 2)
                    .map((factor, index) => <li key={index}>{factor}</li>) || <li>No positive factors found.</li>}
                  {(analysisData?.overview.positiveFactors.length || 0) > 2 && (
                    <li>+ {(analysisData?.overview.positiveFactors.length || 0) - 2} more (Pro only)</li>
                  )}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Negative Factors</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {analysisData?.overview.negativeFactors
                    .slice(0, 2)
                    .map((factor, index) => <li key={index}>{factor}</li>) || <li>No negative factors found.</li>}
                  {(analysisData?.overview.negativeFactors.length || 0) > 2 && (
                    <li>+ {(analysisData?.overview.negativeFactors.length || 0) - 2} more (Pro only)</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Credit Analysis</h1>
        <Button onClick={handleExportPDF} variant="outline">
          Export PDF
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="credit-hacks">Credit Hacks</TabsTrigger>
          <TabsTrigger value="side-hustles">Side Hustles</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab
            data={analysisData?.overview || { score: 0, summary: "", positiveFactors: [], negativeFactors: [] }}
          />
        </TabsContent>
        <TabsContent value="disputes">
          <DisputesTab data={analysisData?.disputes || { items: [] }} />
        </TabsContent>
        <TabsContent value="credit-hacks">
          <CreditHacksTab data={analysisData?.creditHacks || { recommendations: [] }} />
        </TabsContent>
        <TabsContent value="side-hustles">
          <SideHustlesTab data={analysisData?.sideHustles || { recommendations: [] }} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab analysisId={analysisId || ""} />
        </TabsContent>
        <TabsContent value="chat">
          <ChatTab analysisId={analysisId || ""} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
