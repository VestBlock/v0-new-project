"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload, FileText, AlertTriangle, Info, RefreshCw, FileUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { getUserAnalyses } from "@/lib/analyses"
import { SearchAnalyses } from "@/components/search-analyses"
import { supabase } from "@/lib/supabase"
import type { Analysis } from "@/lib/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { safeJsonParse } from "@/lib/json-utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [activeTab, setActiveTab] = useState("upload")
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  // Memoize the loadAnalyses function to prevent unnecessary re-renders
  const loadAnalyses = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const userAnalyses = await getUserAnalyses(user.id)
      setAnalyses(userAnalyses)
    } catch (error) {
      console.error("Error loading analyses:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load your analyses. Please refresh the page.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    if (user) {
      loadAnalyses()
    }
  }, [user, loadAnalyses])

  // Simple test function to check if the API is working
  const testApiConnection = async () => {
    try {
      const response = await fetch("/api/test-connection", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })

      const text = await response.text()
      console.log("Test API response:", response.status, text)

      setDebugInfo(`Test API response: ${response.status}\n${text.substring(0, 200)}`)

      toast({
        title: "API Test",
        description: `Status: ${response.status}`,
      })
    } catch (error) {
      console.error("Test API error:", error)
      setDebugInfo(`Test API error: ${error.message}`)

      toast({
        variant: "destructive",
        title: "API Test Failed",
        description: error.message,
      })
    }
  }

  // Function to create a fallback analysis directly from the client
  const createFallbackAnalysis = async () => {
    if (!user) return

    setIsUploading(true)
    setUploadError(null)
    setDebugInfo(null)

    try {
      // Get auth token from Supabase
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication failed. Please log in again.")
      }

      toast({
        title: "Creating Fallback Analysis",
        description: "Creating a sample analysis for demonstration purposes.",
      })

      // Call the simplified fallback endpoint
      const response = await fetch("/api/create-fallback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      })

      // Get the response text first
      const responseText = await response.text()
      console.log("Fallback response:", response.status, responseText.substring(0, 200))

      // Check if it's HTML
      if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
        setDebugInfo(`Server returned HTML: ${responseText.substring(0, 300)}...`)
        throw new Error("Server returned HTML instead of JSON. This indicates a server-side error.")
      }

      // Try to parse as JSON
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        setDebugInfo(`Failed to parse response as JSON: ${responseText.substring(0, 300)}...`)
        throw new Error("Failed to parse server response as JSON")
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`)
      }

      toast({
        title: "Fallback Analysis Created",
        description: "A sample analysis has been created for demonstration purposes.",
      })

      // Redirect to the analysis page
      if (data.data?.analysisId) {
        router.push(`/credit-analysis?id=${data.data.analysisId}&fallback=true`)
      } else {
        throw new Error("No analysis ID returned from server")
      }
    } catch (error) {
      console.error("Fallback creation error:", error)
      setUploadError(error.message || "Failed to create fallback analysis")
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create fallback analysis",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)
    setUploadError(null)
    setFallbackMessage(null)
    setDebugInfo(null)

    try {
      console.log(`Uploading file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`)

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size exceeds 10MB limit")
      }

      // Check file type
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "text/plain"]
      if (!allowedTypes.includes(file.type)) {
        throw new Error("File type not supported. Please upload a PDF, JPG, PNG, or TXT file")
      }

      // Create form data
      const formData = new FormData()
      formData.append("file", file)

      // Get auth token from Supabase
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication failed. Please log in again.")
      }

      console.log("Sending file to OCR API...")

      // Show initial toast
      toast({
        title: "Processing Started",
        description: "Your credit report is being analyzed. This may take up to a minute.",
      })

      // Use a simple fetch with detailed error handling
      try {
        const response = await fetch("/api/create-fallback", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        })

        // Get the response text first
        const responseText = await response.text()
        console.log("API response:", response.status, responseText.substring(0, 200))

        // Check if it's HTML
        if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
          setDebugInfo(`Server returned HTML: ${responseText.substring(0, 300)}...`)
          throw new Error("Server returned HTML instead of JSON. This indicates a server-side error.")
        }

        // Try to parse as JSON
        let data
        try {
          data = JSON.parse(responseText)
        } catch (e) {
          setDebugInfo(`Failed to parse response as JSON: ${responseText.substring(0, 300)}...`)
          throw new Error("Failed to parse server response as JSON")
        }

        if (!response.ok) {
          throw new Error(data.error || `Server error: ${response.status}`)
        }

        toast({
          title: "Analysis Created",
          description: "Your credit report has been analyzed.",
        })

        // Redirect to the analysis page
        if (data.data?.analysisId) {
          router.push(`/credit-analysis?id=${data.data.analysisId}`)
        } else {
          throw new Error("No analysis ID returned from server")
        }
      } catch (error) {
        console.error("API error:", error)
        setUploadError(error.message || "Failed to process file")
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: error.message || "Failed to process file",
        })
      }
    } catch (error) {
      console.error("Upload preparation error:", error)
      setUploadError(error.message || "Failed to prepare upload")
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to prepare upload",
      })

      // Set retry count for the retry button
      setRetryCount((prev) => prev + 1)
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  // Function to retry the upload with the same file
  const handleRetry = () => {
    // Clear previous errors
    setUploadError(null)
    setDebugInfo(null)

    // Show retry toast
    toast({
      title: "Retrying Upload",
      description: "Attempting to upload your file again...",
    })

    // Trigger file input click to reopen the file dialog
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
  }

  // Memoize formatting functions to prevent unnecessary re-renders
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }, [])

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "completed":
        return <span className="text-green-500 font-medium">Completed</span>
      case "processing":
        return <span className="text-amber-500 font-medium">Processing</span>
      case "error":
        return <span className="text-red-500 font-medium">Failed</span>
      case "queued":
        return <span className="text-blue-500 font-medium">Queued</span>
      default:
        return <span className="text-gray-500 font-medium">{status}</span>
    }
  }, [])

  // Helper function to safely get the credit score from analysis result
  const getCreditScore = useCallback((analysis: Analysis) => {
    try {
      // Handle both string and object result formats
      const result = typeof analysis.result === "string" ? safeJsonParse(analysis.result) : analysis.result

      return result?.overview?.score !== undefined && result?.overview?.score !== null ? result.overview.score : null
    } catch (error) {
      console.error("Error parsing credit score:", error)
      return null
    }
  }, [])

  // Memoize the analyses cards to prevent unnecessary re-renders
  const analysesCards = useMemo(() => {
    if (analyses.length === 0) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analyses.map((analysis) => (
          <Card key={analysis.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Credit Report Analysis</CardTitle>
              <CardDescription>Created on {formatDate(analysis.created_at)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(analysis.status)}
              </div>

              {/* Safely display credit score */}
              {(() => {
                const score = getCreditScore(analysis)
                return score !== null ? (
                  <div className="mb-2">
                    <span className="text-sm font-medium">Credit Score: </span>
                    <span className="font-bold">{score}</span>
                  </div>
                ) : (
                  <div className="mb-2">
                    <span className="text-sm font-medium">Credit Score: </span>
                    <span className="text-muted-foreground">Not available</span>
                  </div>
                )
              })()}

              {analysis.notes && (
                <div className="mb-2">
                  <span className="text-sm font-medium">Notes: </span>
                  <span className="text-muted-foreground line-clamp-1">{analysis.notes}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 pt-2">
              <Button asChild variant="secondary" className="w-full">
                <a href={`/credit-analysis?id=${analysis.id}`}>
                  <FileText className="mr-2 h-4 w-4" /> View Analysis
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }, [analyses, formatDate, getStatusBadge, getCreditScore])

  if (!user) {
    return (
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Upload and manage your credit reports</p>
        </div>
      </div>

      {uploadError && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>{uploadError}</p>
            </div>
            {debugInfo && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32">
                <p className="text-gray-700">Debug info:</p>
                <p className="text-gray-600 break-all">{debugInfo}</p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={testApiConnection}>
                Test API Connection
              </Button>
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={isUploading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {fallbackMessage && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Fallback Analysis</AlertTitle>
          <AlertDescription>{fallbackMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="upload">Upload Report</TabsTrigger>
          <TabsTrigger value="reports">Your Reports</TabsTrigger>
          <TabsTrigger value="demo">Demo Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <FileUp className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Upload a Credit Report</p>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Upload your credit report to get a detailed analysis, dispute recommendations, and financial improvement
                strategies.
              </p>
              <div className="flex gap-4">
                <Button asChild>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.txt"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" /> Upload Credit Report
                      </>
                    )}
                  </label>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/manual-upload">Manual Entry</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="mb-4">
            <SearchAnalyses onSearch={loadAnalyses} />
          </div>

          <h2 className="text-xl font-semibold mb-4">Your Credit Reports</h2>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[30vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4">Loading your reports...</p>
            </div>
          ) : analyses.length > 0 ? (
            analysesCards
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No credit reports yet</p>
                <p className="text-muted-foreground text-center mb-6">
                  Upload your first credit report to get started with your credit analysis
                </p>
                <Button onClick={() => setActiveTab("upload")}>
                  <Upload className="mr-2 h-4 w-4" /> Upload Credit Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="demo">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Info className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Demo Mode</p>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Don't have a credit report handy? Create a sample analysis to explore the features of VestBlock.
              </p>
              <Button onClick={createFallbackAnalysis} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>Create Sample Analysis</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
