"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload, FileText, AlertTriangle, Info, RefreshCw, FileUp, FileCheck, Bug } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { getUserAnalyses } from "@/lib/analyses"
import { SearchAnalyses } from "@/components/search-analyses"
import { supabase } from "@/lib/supabase-client"
import type { Analysis } from "@/lib/supabase-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { safeJsonParse } from "@/lib/json-utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PDFUploader } from "@/components/pdf-uploader"

export default function DashboardPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [activeTab, setActiveTab] = useState("upload")
  const [isPdfWarningVisible, setIsPdfWarningVisible] = useState(false)
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

  // Function to create a demo analysis directly from the client
  const createDemoAnalysis = async () => {
    if (!user) return

    setIsUploading(true)
    setUploadError(null)
    setDebugInfo(null)
    setRawResponse(null)

    try {
      // Get auth token from Supabase
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication failed. Please log in again.")
      }

      toast({
        title: "Creating Demo Analysis",
        description: "Creating a sample analysis with real-time AI for demonstration purposes.",
      })

      // Call the analyze-credit endpoint with demo flag
      const response = await fetch("/api/analyze-credit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          isDemoMode: true,
          text: "This is a demo credit report for VestBlock. The user has a credit score of 720. They have 5 credit cards with a total balance of $12,000. They have 1 auto loan with a balance of $15,000. They have 1 mortgage with a balance of $250,000. They have 1 student loan with a balance of $25,000. They have 1 collection account with a balance of $500. They have 2 late payments in the last 12 months.",
        }),
      })

      // Get the response text first
      const responseText = await response.text()
      console.log("Demo response:", response.status, responseText.substring(0, 200))

      // Save raw response for debugging
      setRawResponse(responseText)

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
        title: "Demo Analysis Created",
        description: "A sample analysis has been created with real-time AI for demonstration purposes.",
      })

      // Redirect to the analysis page
      if (data.analysisId) {
        router.push(`/credit-analysis?id=${data.analysisId}&demo=true`)
      } else {
        throw new Error("No analysis ID returned from server")
      }
    } catch (error) {
      console.error("Demo creation error:", error)
      setUploadError(error.message || "Failed to create demo analysis")
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create demo analysis",
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
    setRawResponse(null)

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

      // Show warning for PDF files
      if (file.type === "application/pdf") {
        setIsPdfWarningVisible(true)
        toast({
          title: "PDF Processing",
          description: "PDF processing may take longer. Please be patient.",
          duration: 8000,
        })
      }

      // Get auth token from Supabase
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication failed. Please log in again.")
      }

      console.log("Preparing file for analysis...")

      // Show initial toast
      toast({
        title: "Processing Started",
        description: "Your credit report is being analyzed with real-time AI. This may take a few minutes.",
      })

      // Convert file to base64
      const reader = new FileReader()
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const fileData = await fileDataPromise

      // Use a simple fetch with detailed error handling
      try {
        const response = await fetch("/api/analyze-credit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            fileData,
            fileName: file.name,
            fileType: file.type,
            priority: "high",
          }),
        })

        // Get the response text first
        const responseText = await response.text()
        console.log("API response:", response.status, responseText.substring(0, 200))

        // Save raw response for debugging
        setRawResponse(responseText)

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
          throw new Error(`Failed to parse server response as JSON. Response: ${responseText.substring(0, 100)}...`)
        }

        if (!response.ok) {
          const errorMessage = data.error || `Server error: ${response.status}`
          const errorDetails = data.details ? ` Details: ${JSON.stringify(data.details)}` : ""
          throw new Error(errorMessage + errorDetails)
        }

        toast({
          title: "Analysis Created",
          description: "Your credit report has been analyzed with real-time AI.",
        })

        // Redirect to the analysis page
        if (data.analysisId) {
          router.push(`/credit-analysis?id=${data.analysisId}`)
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
    setRawResponse(null)

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

              {/* Display error message if present */}
              {analysis.error_message && (
                <div className="mt-2 text-red-500 text-sm">
                  <span className="font-medium">Error: </span>
                  <span className="line-clamp-2">{analysis.error_message}</span>
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
            <div className="flex items-start gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Upload Error</p>
                <p className="mt-1">{uploadError}</p>
              </div>
            </div>

            {debugInfo && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700">Debug Information:</p>
                <div className="mt-1 p-2 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32">
                  <p className="text-gray-600 break-all whitespace-pre-wrap">{debugInfo}</p>
                </div>
              </div>
            )}

            {rawResponse && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700">Raw Server Response:</p>
                <div className="mt-1 p-2 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32">
                  <p className="text-gray-600 break-all whitespace-pre-wrap">{rawResponse}</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={testApiConnection}>
                <Bug className="mr-2 h-4 w-4" /> Test API Connection
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

      {isPdfWarningVisible && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <FileCheck className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">PDF Processing Enabled</AlertTitle>
          <AlertDescription className="text-blue-700">
            <p>We now support PDF processing using advanced text extraction. For best results:</p>
            <ul className="list-disc pl-5 mt-1">
              <li>Ensure your PDF contains actual text (not just scanned images)</li>
              <li>PDFs with clear, readable text work best</li>
              <li>Processing may take longer for large PDFs</li>
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-blue-800 border-blue-300 hover:bg-blue-100"
              onClick={() => setIsPdfWarningVisible(false)}
            >
              Dismiss
            </Button>
          </AlertDescription>
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
              <div className="flex flex-col gap-4 w-full max-w-md">
                <Alert className="mb-2">
                  <Info className="h-4 w-4" />
                  <AlertTitle>File Type Support</AlertTitle>
                  <AlertDescription>
                    We support JPG, PNG, and PDF files. PDFs with searchable text work best. Very large or image-only
                    PDFs may take longer to process.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-4">
                  <Button asChild className="flex-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.pdf,.txt"
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
                  <Button variant="outline" asChild className="flex-1">
                    <a href="/manual-upload">Manual Entry</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Add this where appropriate in the dashboard layout */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Upload Credit Report</h2>
            <PDFUploader />
          </div>
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
              <Button onClick={createDemoAnalysis} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>Create Real-time Demo Analysis</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
