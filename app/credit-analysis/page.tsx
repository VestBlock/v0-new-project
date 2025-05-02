"use client"

import { Suspense, useEffect, useState, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, AlertTriangle, FileDown } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { OverviewTab } from "@/components/analysis/overview-tab"
import { DisputesTab } from "@/components/analysis/disputes-tab"
import { CreditHacksTab } from "@/components/analysis/credit-hacks-tab"
import { SideHustlesTab } from "@/components/analysis/side-hustles-tab"
import { CreditCardsTab } from "@/components/analysis/credit-cards-tab"
import { ChatTab } from "@/components/analysis/chat-tab"
import { NotesTab } from "@/components/analysis/notes-tab"
import { supabase } from "@/lib/supabase"
import { safeJsonParse, sanitizeForJson } from "@/lib/json-utils"
import type { Analysis } from "@/lib/supabase"

type AnalysisData = {
  id: string
  overview: {
    score: number | null
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
      steps: string[]
    }>
  }
  creditCards: {
    recommendations: Array<{
      name: string
      issuer: string
      annualFee: string
      apr: string
      rewards: string
      approvalLikelihood: "high" | "medium" | "low"
      bestFor: string
    }>
  }
  sideHustles: {
    recommendations: Array<{
      title: string
      description: string
      potentialEarnings: string
      startupCost: string
      difficulty: "easy" | "medium" | "hard"
      timeCommitment: string
      skills: string[]
    }>
  }
}

// Create a default analysis data structure
const DEFAULT_ANALYSIS_DATA: AnalysisData = {
  id: "",
  overview: {
    score: null,
    summary: "Analysis data is not available. This could be due to an incomplete processing or a system error.",
    positiveFactors: [],
    negativeFactors: [],
  },
  disputes: { items: [] },
  creditHacks: { recommendations: [] },
  creditCards: { recommendations: [] },
  sideHustles: { recommendations: [] },
}

function CreditAnalysisContent() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const searchParams = useSearchParams()
  const router = useRouter()
  const analysisId = searchParams.get("id")
  const directResult = searchParams.get("direct") === "true"
  const { user } = useAuth()
  const { toast } = useToast()

  // Function to fetch analysis data
  const fetchAnalysis = useCallback(async () => {
    if (!analysisId || !user) {
      // If there's no analysis ID or user, redirect to dashboard
      if (!analysisId && user) {
        console.log("No analysis ID provided, redirecting to dashboard")
        router.push("/dashboard")
        return
      }
      return
    }

    try {
      console.log(`Fetching analysis: ${analysisId}`)
      setError(null)

      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Fetch the analysis record from Supabase
      const { data: analysisRecord, error: dbError } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .single()

      if (dbError) {
        console.error("Error fetching analysis record:", dbError)
        throw new Error(`Analysis not found: ${dbError.message}`)
      }

      if (!analysisRecord) {
        throw new Error("Analysis not found in database")
      }

      console.log(`Analysis fetched from DB: ${analysisRecord.status}`)
      setAnalysis(analysisRecord as Analysis)

      // If the analysis failed, show an error
      if (analysisRecord.status === "error") {
        setError(analysisRecord.error_message || "There was an error analyzing your credit report. Please try again.")
        setIsLoading(false)
        return
      }

      // Check if result exists in the database record
      if (analysisRecord.result) {
        console.log("Setting analysis data from database")
        try {
          // Ensure result is properly parsed if it's a string
          const resultData =
            typeof analysisRecord.result === "string" ? safeJsonParse(analysisRecord.result) : analysisRecord.result

          if (!resultData) {
            throw new Error("Invalid analysis result format")
          }

          // Sanitize the result to ensure it can be safely serialized
          const sanitizedResult = sanitizeForJson(resultData)

          setAnalysisData({
            id: analysisRecord.id,
            ...sanitizedResult,
          })
          setIsLoading(false)
          return
        } catch (parseError) {
          console.error("Error parsing result data:", parseError)
          throw new Error("Invalid analysis result format")
        }
      }

      // If no result in DB, try fetching from API
      console.log("Fetching analysis from API")
      const response = await fetch(`/api/analysis/${analysisId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch analysis: ${response.status}`)
      }

      const data = await response.json()

      // Set the analysis data from the API response
      if (data && data.id) {
        console.log("Setting analysis data from API")
        setAnalysisData(data)
        setIsLoading(false)
      } else {
        console.error("API returned no data or invalid data format")
        throw new Error("Analysis result not found or invalid format")
      }
    } catch (error) {
      console.error("Error fetching analysis:", error)
      setError(error instanceof Error ? error.message : "Failed to load analysis data. Please try again.")
      setIsLoading(false)
    }
  }, [analysisId, user, router])

  // Function to handle direct result from URL state
  const handleDirectResult = useCallback(() => {
    try {
      // Check if we have a direct result in sessionStorage
      const storedResult = sessionStorage.getItem(`directResult_${analysisId}`)

      if (storedResult) {
        console.log(`Found direct result in sessionStorage for analysis ID: ${analysisId}`)

        try {
          const parsedResult = safeJsonParse(storedResult)
          if (!parsedResult) {
            throw new Error("Failed to parse direct result")
          }

          console.log("Successfully parsed direct result from sessionStorage")

          setAnalysisData({
            id: analysisId || "direct",
            ...parsedResult,
          })

          // Create a placeholder analysis object
          setAnalysis({
            id: analysisId || "direct",
            user_id: user?.id || "",
            file_path: "direct-analysis",
            ocr_text: "",
            status: "completed",
            result: parsedResult,
            notes: null,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          } as Analysis)

          setIsLoading(false)

          // Clear the stored result to avoid memory issues
          sessionStorage.removeItem(`directResult_${analysisId}`)
          console.log("Cleared direct result from sessionStorage")

          return true
        } catch (parseError) {
          console.error("Error parsing direct result from sessionStorage:", parseError)
          // If parsing fails, continue to fetch from database
          return false
        }
      }

      console.log("No direct result found in sessionStorage")
      return false
    } catch (error) {
      console.error("Error handling direct result:", error)
      return false
    }
  }, [analysisId, user?.id])

  useEffect(() => {
    // If no analysis ID is provided, redirect to dashboard
    if (!analysisId && user) {
      router.push("/dashboard")
      return
    }

    console.log(`Initializing credit analysis page for analysis ID: ${analysisId}, direct: ${directResult}`)

    // First try to get direct result from sessionStorage
    const hasDirectResult = handleDirectResult()

    // If no direct result, fetch from database
    if (!hasDirectResult) {
      console.log("No direct result found, fetching from database")
      fetchAnalysis()
    }
  }, [analysisId, user, router, directResult, handleDirectResult, fetchAnalysis])

  const handleExportPDF = useCallback(async () => {
    if (!analysisId) return

    try {
      setIsExporting(true)
      toast({
        title: "Generating PDF",
        description: "Your comprehensive credit analysis report is being generated...",
      })

      // Get the session token for authorization
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const response = await fetch(`/api/export-pdf/${analysisId}`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `vestblock-credit-analysis-${analysisId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "PDF Generated Successfully",
        description: "Your comprehensive credit analysis report has been downloaded.",
      })
    } catch (error) {
      console.error("Error exporting PDF:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export PDF. Please try again.",
      })
    } finally {
      setIsExporting(false)
    }
  }, [analysisId, toast])

  const handleRetryAnalysis = useCallback(async () => {
    if (!analysisId || !analysis) return

    setIsLoading(true)
    setError(null)

    try {
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Call the analyze endpoint to retry the analysis
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId,
          text: analysis.ocr_text,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to retry analysis")
      }

      const data = await response.json()

      toast({
        title: "Analysis Completed",
        description: "Your credit report has been analyzed successfully.",
      })

      // If we have a direct result, use it immediately
      if (data.directResult) {
        console.log("Using direct result from API")
        setAnalysisData({
          id: analysisId,
          ...data.directResult,
        })

        // Update the analysis object
        setAnalysis({
          ...analysis,
          status: "completed",
          result: data.directResult,
          completed_at: new Date().toISOString(),
        })

        setIsLoading(false)
      } else {
        // Otherwise fetch the updated analysis
        fetchAnalysis()
      }
    } catch (error) {
      console.error("Retry error:", error)
      setError(error instanceof Error ? error.message : "Failed to retry analysis. Please try again.")
      setIsLoading(false)
    }
  }, [analysisId, analysis, toast, fetchAnalysis])

  // Memoize the safe analysis data to prevent unnecessary re-renders
  const safeAnalysisData = useMemo(() => {
    if (!analysisData) {
      return DEFAULT_ANALYSIS_DATA
    }

    // Ensure we have valid data for each tab
    return {
      id: analysisData.id,
      overview: analysisData.overview || DEFAULT_ANALYSIS_DATA.overview,
      disputes: analysisData.disputes || DEFAULT_ANALYSIS_DATA.disputes,
      creditHacks: analysisData.creditHacks || DEFAULT_ANALYSIS_DATA.creditHacks,
      creditCards: analysisData.creditCards || DEFAULT_ANALYSIS_DATA.creditCards,
      sideHustles: analysisData.sideHustles || DEFAULT_ANALYSIS_DATA.sideHustles,
    }
  }, [analysisData])

  // Handle case where no analysis ID is provided
  if (!analysisId && !isLoading) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Analysis Selected</CardTitle>
            <CardDescription>Please select an analysis from your dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/dashboard">Go to Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Loading your credit analysis...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
              Analysis Error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">This could be due to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>The file format was not recognized</li>
              <li>The credit report content was unclear or incomplete</li>
              <li>A temporary issue with our analysis system</li>
              <li>The OpenAI API may be experiencing issues</li>
            </ul>
            <div className="flex flex-col space-y-2">
              {analysis && (
                <Button onClick={handleRetryAnalysis} className="w-full">
                  Retry Analysis
                </Button>
              )}
              <Button asChild variant="outline" className="w-full">
                <a href="/dashboard">Return to Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analysis && !analysisData) {
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
                  <li>Credit card recommendations based on your profile</li>
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
                {safeAnalysisData?.overview?.score === null ? (
                  <div className="text-sm text-muted-foreground">
                    Score not available. Upgrade to Pro to see the full analysis of why.
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                        style={{ width: `${((safeAnalysisData?.overview?.score || 0) / 850) * 100}%` }}
                      />
                    </div>
                    <span className="ml-2 font-bold">{safeAnalysisData?.overview?.score || "N/A"}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {safeAnalysisData?.overview?.summary ||
                    "No summary available. Upgrade to Pro to see your full analysis."}
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Positive Factors</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {safeAnalysisData?.overview?.positiveFactors &&
                  safeAnalysisData.overview.positiveFactors.length > 0 ? (
                    safeAnalysisData.overview.positiveFactors
                      .slice(0, 2)
                      .map((factor, index) => <li key={index}>{factor}</li>)
                  ) : (
                    <li>No positive factors found. Upgrade to Pro to see your full analysis.</li>
                  )}
                  {(safeAnalysisData?.overview?.positiveFactors?.length || 0) > 2 && (
                    <li>+ {(safeAnalysisData?.overview.positiveFactors.length || 0) - 2} more (Pro only)</li>
                  )}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Negative Factors</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {safeAnalysisData?.overview?.negativeFactors &&
                  safeAnalysisData.overview.negativeFactors.length > 0 ? (
                    safeAnalysisData.overview.negativeFactors
                      .slice(0, 2)
                      .map((factor, index) => <li key={index}>{factor}</li>)
                  ) : (
                    <li>No negative factors found. Upgrade to Pro to see your full analysis.</li>
                  )}
                  {(safeAnalysisData?.overview?.negativeFactors?.length || 0) > 2 && (
                    <li>+ {(safeAnalysisData?.overview.negativeFactors.length || 0) - 2} more (Pro only)</li>
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
        <Button onClick={handleExportPDF} variant="outline" disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating PDF...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" /> Export PDF
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="credit-hacks">Credit Hacks</TabsTrigger>
          <TabsTrigger value="credit-cards">Credit Cards</TabsTrigger>
          <TabsTrigger value="side-hustles">Side Hustles</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab data={safeAnalysisData.overview} />
        </TabsContent>
        <TabsContent value="disputes">
          <DisputesTab data={safeAnalysisData.disputes} analysisId={analysisId || ""} />
        </TabsContent>
        <TabsContent value="credit-hacks">
          <CreditHacksTab data={safeAnalysisData.creditHacks} />
        </TabsContent>
        <TabsContent value="credit-cards">
          <CreditCardsTab data={safeAnalysisData.creditCards} />
        </TabsContent>
        <TabsContent value="side-hustles">
          <SideHustlesTab data={safeAnalysisData.sideHustles} />
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

export default function CreditAnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-10">
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg">Loading analysis...</p>
          </div>
        </div>
      }
    >
      <CreditAnalysisContent />
    </Suspense>
  )
}
