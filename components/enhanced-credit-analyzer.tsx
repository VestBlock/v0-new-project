"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation" // Import useRouter
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isLikelyCreditReport } from "@/lib/pdf-extraction-service"
import { Loader2, Upload, FileText, AlertCircle, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"

// This component will now focus on upload, triggering analysis, and redirecting.
// The multi-step UI and tabs for displaying results directly here are removed for this flow.

export function EnhancedCreditAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [stage, setStage] = useState<string>("")
  const [progress, setProgress] = useState<number>(0)
  const [extractionWarning, setExtractionWarning] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter() // Initialize router

  const initialAnalysisQuestion =
    "Provide a comprehensive analysis of this credit report. Include a summary, details about accounts (total, positive, negative), a list of negative items with creditor and details, a list of inquiries, and actionable recommendations for credit improvement. If a credit score is explicitly mentioned, include it. Structure your response clearly with headings for each section."

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    setExtractionWarning("")
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.type !== "application/pdf" && selectedFile.type !== "text/plain") {
      toast({
        title: "Unsupported File Type",
        description: "Please upload a PDF or TXT file.",
        variant: "warning",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setFile(selectedFile)
    setLoading(true)
    setStage("Uploading and extracting text...")
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const extractionResponse = await fetch("/api/analyze-document", {
        method: "POST",
        body: formData,
      })
      setProgress(40)

      if (!extractionResponse.ok) {
        const errorData = await extractionResponse.json().catch(() => ({}))
        throw new Error(
          errorData.error || errorData.details || `Failed to extract text: ${extractionResponse.statusText}`,
        )
      }
      const extractionResult = await extractionResponse.json()
      if (!extractionResult.success || !extractionResult.text) {
        throw new Error(extractionResult.error || extractionResult.details || "Failed to extract text from document.")
      }

      const extractedText = extractionResult.text
      setProgress(60)
      setStage("Text extracted. Analyzing report & generating roadmap...") // Ensure this stage message is set

      if (extractionResult.metadata?.error) setExtractionWarning(extractionResult.metadata.error)
      if (!extractedText || extractedText.trim().length < 100) {
        setError("Insufficient text extracted. Please try a different file.")
        setLoading(false)
        setStage("")
        setProgress(0)
        return
      }
      if (!isLikelyCreditReport(extractedText)) {
        setExtractionWarning("The extracted text doesn't strongly appear to be a credit report. Analysis may vary.")
      }

      // Automatically trigger analysis and redirect
      await triggerAnalysisAndRedirect(extractedText)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process the document"
      setError(errorMessage)
      toast({ title: "Processing Failed", description: errorMessage, variant: "destructive" })
      setLoading(false)
      setStage("")
      setProgress(0)
    }
    // setLoading and setStage will be handled by triggerAnalysisAndRedirect or error cases
  }

  const triggerAnalysisAndRedirect = async (textToAnalyze: string) => {
    setStage("Analyzing report & generating roadmap...") // Updated stage
    setProgress(70)

    try {
      const requestBody: { reportText: string; question: string; clientUserId?: string } = {
        reportText: textToAnalyze,
        question: initialAnalysisQuestion, // This is the question for the general analysis
      }
      if (user?.id) {
        requestBody.clientUserId = user.id
      } else {
        // Handle case where user is not authenticated, as clientUserId is now mandatory in the API
        setError("User authentication is required to analyze reports.")
        toast({ title: "Authentication Required", description: "Please log in to proceed.", variant: "destructive" })
        setLoading(false)
        setStage("")
        setProgress(0)
        return
      }

      const analysisResponse = await fetch("/api/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      setProgress(90)

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || `Analysis API Error: ${analysisResponse.statusText}`)
      }
      const responseData = await analysisResponse.json()

      // Check for the new expected fields: reportId and roadmapId
      if (responseData.error || !responseData.reportId || !responseData.roadmapId) {
        throw new Error(
          responseData.error || responseData.details || "Analysis or roadmap generation failed to return expected IDs.",
        )
      }

      setProgress(100)
      setStage("Processing complete. Redirecting...") // Updated stage
      toast({ title: "Analysis Complete", description: "Redirecting to your personalized credit dashboard." })

      // Redirect to the new page structure using reportId
      router.push(`/credit-dashboard/${responseData.reportId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process the report and generate roadmap"
      setError(errorMessage)
      toast({ title: "Processing Failed", description: errorMessage, variant: "destructive" })
      setLoading(false)
      setStage("")
      setProgress(0)
    }
  }

  // Simplified UI for upload
  return (
    <div className="space-y-8 max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            Upload & Analyze Credit Report
          </CardTitle>
          <CardDescription>
            Upload your PDF or TXT credit report. It will be automatically analyzed, and you'll be redirected to the
            results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              For best results, use a text-based PDF or TXT file. Analysis may take a few moments.
            </AlertDescription>
          </Alert>

          {extractionWarning && (
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Extraction Notice</AlertTitle>
              <AlertDescription>{extractionWarning}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/30 rounded-lg p-8 text-center bg-muted/30">
            <Upload className="h-12 w-12 mb-4 text-primary/60" />
            <h3 className="text-xl font-medium mb-2">Upload Your Credit Report</h3>
            <p className="mb-4 text-muted-foreground">Drag and drop your file here, or click to browse</p>
            <p className="text-sm text-muted-foreground mb-6">Supported formats: PDF, TXT</p>
            <Input
              id="file-upload"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.txt"
              className="hidden"
              disabled={loading}
            />
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              disabled={loading}
            >
              <label htmlFor="file-upload" className="cursor-pointer">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Select File
              </label>
            </Button>
          </div>

          {file && !loading && (
            <div className="mt-6 flex items-center justify-center">
              <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-3 max-w-md">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {file.size
                      ? `${(file.size / 1024).toFixed(1)} KB • ${file.type || "Unknown type"}`
                      : "Selected file"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="mt-6 space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {stage}
                </span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-6 max-w-md mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
