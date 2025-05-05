"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, AlertTriangle, FileDown, RefreshCw, ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { OverviewTab } from "@/components/analysis/overview-tab"
import { DisputesTab } from "@/components/analysis/disputes-tab"
import { CreditHacksTab } from "@/components/analysis/credit-hacks-tab"
import { SideHustlesTab } from "@/components/analysis/side-hustles-tab"
import { CreditCardsTab } from "@/components/analysis/credit-cards-tab"
import { ChatTab } from "@/components/analysis/chat-tab"
import { NotesTab } from "@/components/analysis/notes-tab"
import { supabase } from "@/lib/supabase-client"
import { safeJsonParse, sanitizeForJson } from "@/lib/json-utils"
import { AnalysisProgressTracker } from "@/components/analysis-progress-tracker"
import type { Analysis } from "@/lib/supabase-client"

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

function CreditAnalysisContent() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingAttempts, setLoadingAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [metrics, setMetrics] = useState<any>(null)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const analysisId = searchParams.get("id")
  const { user } = useAuth()
  const { toast } = useToast()

  // Function to fetch analysis data
  const fetchAnalysis = useCallback(
    async (showToast = false) => {
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
        console.log(`Fetching analysis: ${analysisId}, attempt: ${loadingAttempts + 1}`)
        setError(null)

        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        if (!token) {
          throw new Error("Authentication token not found")
        }

        // Fetch the analysis record from Supabase
        try {
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
            setError(
              analysisRecord.error_message || "There was an error analyzing your credit report. Please try again.",
            )
            setIsLoading(false)
            setIsProcessing(false)
            return
          }

          // If the analysis is still processing, show processing state
          if (analysisRecord.status === "processing" || analysisRecord.status === "queued") {
            setIsProcessing(true)
            setIsLoading(false)

            // Only increment loading attempts if we're actively polling
            if (loadingAttempts < 20) {
              // Limit to 20 attempts (about 2 minutes with 6s interval)
              setLoadingAttempts((prev) => prev + 1)

              // Set a timeout to check again
              setTimeout(() => fetchAnalysis(), 6000)
            } else {
              // After 20 attempts, we'll still show the progress tracker but stop auto-refreshing
              setLoadingTimedOut(true)

              if (showToast) {
                toast({
                  title: "Analysis Taking Longer Than Expected",
                  description: "Your analysis is still processing. You can manually refresh or check back later.",
                })
              }
            }
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

              // Set metrics if available
              if (analysisRecord.metrics) {
                setMetrics(analysisRecord.metrics)
              }

              setIsLoading(false)
              setIsProcessing(false)
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
          if (data) {
            console.log("Setting analysis data from API")
            setAnalysisData(data)

            // Store metrics if available
            if (data.metrics) {
              setMetrics(data.metrics)
              console.log("Analysis metrics:", data.metrics)
            }

            setIsLoading(false)
            setIsProcessing(false)
          } else {
            console.error("API returned no data or invalid data format")
            throw new Error("Analysis result not found or invalid format")
          }
        } catch (supabaseError) {
          console.error("Supabase operation failed:", supabaseError)
          setError("Failed to connect to the database. Please try again later.")
          setIsLoading(false)
          setIsProcessing(false)
          return
        }
      } catch (error) {
        console.error("Error fetching analysis:", error)
        setError(error instanceof Error ? error.message : "Failed to load analysis data. Please try again.")
        setIsLoading(false)
        setIsProcessing(false)
      }
    },
    [analysisId, user, router, loadingAttempts, toast],
  )

  useEffect(() => {
    // If no analysis ID is provided, redirect to dashboard
    if (!analysisId && user) {
      router.push("/dashboard")
      return
    }

    console.log(`Initializing credit analysis page for analysis ID: ${analysisId}`)
    fetchAnalysis()

    // Set up a timeout for the initial loading state
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
        setIsProcessing(true)
      }
    }, 10000) // After 10 seconds, switch to processing state if still loading

    return () => clearTimeout(timeoutId)
  }, [analysisId, user, router, fetchAnalysis, isLoading])

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

    setIsRetrying(true)
    setError(null)

    try {
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Update the analysis status to processing
      await supabase
        .from("analyses")
        .update({
          status: "processing",
          notes: "Retrying analysis...",
          error_message: null,
        })
        .eq("id", analysisId)

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

      toast({
        title: "Analysis Started",
        description: "Your credit report is being analyzed. This may take a minute or two.",
      })

      // Reset loading state and attempts
      setIsLoading(false)
      setIsProcessing(true)
      setLoadingAttempts(0)
      setLoadingTimedOut(false)

      // Fetch the analysis after a short delay
      setTimeout(() => fetchAnalysis(true), 2000)
    } catch (error) {
      console.error("Retry error:", error)
      setError(error instanceof Error ? error.message : "Failed to retry analysis. Please try again.")
      setIsRetrying(false)
    }
  }, [analysisId, analysis, toast, fetchAnalysis])

  const handleManualRefresh = useCallback(() => {
    setLoadingAttempts(0)
    setLoadingTimedOut(false)
    fetchAnalysis(true)

    toast({
      title: "Refreshing Analysis",
      description: "Checking the status of your analysis...",
    })
  }, [fetchAnalysis, toast])

  const handleAnalysisComplete = useCallback(() => {
    fetchAnalysis(true)
  }, [fetchAnalysis])

  const handleAnalysisError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setIsProcessing(false)
  }, [])

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
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-[30vh] gap-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-lg font-medium">Loading your credit analysis...</p>
            <p className="text-sm text-muted-foreground mt-2">This should only take a few seconds</p>
          </div>
        </div>
      </div>
    )
  }

  if (isProcessing && analysisId) {
    return (
      <div className="container py-10">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Credit Analysis</h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <AnalysisProgressTracker
            analysisId={analysisId}
            onComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
          />

          {loadingTimedOut && (
            <div className="mt-6 flex justify-center">
              <Button onClick={handleManualRefresh} className="mx-auto">
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Analysis Status
              </Button>
            </div>
          )}

          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>What's happening?</CardTitle>
                <CardDescription>Understanding the analysis process</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your credit report is being analyzed by our AI system. This process happens in several stages:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium">Text Extraction:</span> We extract all text from your credit report
                  </li>
                  <li>
                    <span className="font-medium">Data Analysis:</span> Our AI analyzes the text to identify key
                    information
                  </li>
                  <li>
                    <span className="font-medium">Report Generation:</span> We generate a comprehensive analysis with
                    recommendations
                  </li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  This process typically takes 1-3 minutes, but may take longer for complex reports or during high
                  demand periods.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-10">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Credit Analysis</h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="border-destructive">
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
                  <Button onClick={handleRetryAnalysis} className="w-full" disabled={isRetrying}>
                    {isRetrying ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Retrying...
                      </>
                    ) : (
                      "Retry Analysis"
                    )}
                  </Button>
                )}
                <Button asChild variant="outline" className="w-full">
                  <a href="/dashboard">Return to Dashboard</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
                {analysisData?.overview?.score === null ? (
                  <div className="text-sm text-muted-foreground">
                    Score not available. Upgrade to Pro to see the full analysis of why.
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                        style={{ width: `${((analysisData?.overview?.score || 0) / 850) * 100}%` }}
                      />
                    </div>
                    <span className="ml-2 font-bold">{analysisData?.overview?.score || "N/A"}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {analysisData?.overview?.summary || "No summary available. Upgrade to Pro to see your full analysis."}
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Positive Factors</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {analysisData?.overview?.positiveFactors && analysisData.overview.positiveFactors.length > 0 ? (
                    analysisData.overview.positiveFactors
                      .slice(0, 2)
                      .map((factor, index) => <li key={index}>{factor}</li>)
                  ) : (
                    <li>No positive factors found. Upgrade to Pro to see your full analysis.</li>
                  )}
                  {(analysisData?.overview?.positiveFactors?.length || 0) > 2 && (
                    <li>+ {(analysisData?.overview.positiveFactors.length || 0) - 2} more (Pro only)</li>
                  )}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Negative Factors</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {analysisData?.overview?.negativeFactors && analysisData.overview.negativeFactors.length > 0 ? (
                    analysisData.overview.negativeFactors
                      .slice(0, 2)
                      .map((factor, index) => <li key={index}>{factor}</li>)
                  ) : (
                    <li>No negative factors found. Upgrade to Pro to see your full analysis.</li>
                  )}
                  {(analysisData?.overview?.negativeFactors?.length || 0) > 2 && (
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
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Credit Analysis</h1>
          </div>
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

        {metrics && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <span className="font-medium">Processing Time:</span> {Math.round(metrics.processingTimeMs / 1000)}{" "}
                    seconds
                  </div>
                  {metrics.tokenUsage && (
                    <div>
                      <span className="font-medium">Tokens Used:</span> {metrics.tokenUsage.total.toLocaleString()}
                    </div>
                  )}
                  {metrics.modelUsed && (
                    <div>
                      <span className="font-medium">Model:</span> {metrics.modelUsed}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Analysis Type:</span>{" "}
                    <span className="text-green-600 font-medium">Real-time AI</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
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
          {analysisData?.overview ? (
            <OverviewTab data={analysisData.overview} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Your credit report overview</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    We couldn't retrieve the overview data. Please try refreshing the page or contact support if the
                    issue persists.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Retrying...
                    </>
                  ) : (
                    "Retry Analysis"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="disputes">
          {analysisData?.disputes ? (
            <DisputesTab data={analysisData.disputes} analysisId={analysisId || ""} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Disputes</CardTitle>
                <CardDescription>Items that can be disputed on your credit report</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    We couldn't retrieve the disputes data. Please try refreshing the page or contact support if the
                    issue persists.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Retrying...
                    </>
                  ) : (
                    "Retry Analysis"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="credit-hacks">
          {analysisData?.creditHacks ? (
            <CreditHacksTab data={analysisData.creditHacks} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Credit Hacks</CardTitle>
                <CardDescription>Strategies to improve your credit score</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    We couldn't retrieve the credit hacks data. Please try refreshing the page or contact support if the
                    issue persists.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Retrying...
                    </>
                  ) : (
                    "Retry Analysis"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="credit-cards">
          {analysisData?.creditCards ? (
            <CreditCardsTab data={analysisData.creditCards} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Credit Cards</CardTitle>
                <CardDescription>Recommended credit cards based on your profile</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    We couldn't retrieve the credit cards data. Please try refreshing the page or contact support if the
                    issue persists.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Retrying...
                    </>
                  ) : (
                    "Retry Analysis"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="side-hustles">
          {analysisData?.sideHustles ? (
            <SideHustlesTab data={analysisData.sideHustles} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Side Hustles</CardTitle>
                <CardDescription>Income opportunities based on your profile</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    We couldn't retrieve the side hustles data. Please try refreshing the page or contact support if the
                    issue persists.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Retrying...
                    </>
                  ) : (
                    "Retry Analysis"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
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
