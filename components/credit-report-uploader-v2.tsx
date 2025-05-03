"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, AlertCircle, Loader2, CheckCircle2, RefreshCw, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { uploadCreditReport, type UploadProgress } from "@/lib/file-upload-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function CreditReportUploaderV2() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: "preparing",
    percent: 0,
    message: "Ready to upload",
  })
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setDebugInfo(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !user) return

    setIsUploading(true)
    setError(null)
    setDebugInfo(null)

    try {
      // Show initial toast
      toast({
        title: "Processing Started",
        description: "Your credit report is being analyzed. This may take a few minutes.",
      })

      // Upload the file without token (we'll use cookies for auth)
      const result = await uploadCreditReport(selectedFile, null, {
        onProgress: (progress) => {
          setUploadProgress(progress)

          // Show toast for key stages
          if (progress.stage === "analyzing" && progress.percent === 60) {
            toast({
              title: "Analysis in Progress",
              description: "AI is analyzing your credit report. This may take a few minutes.",
            })
          }
        },
        priority: "high",
      })

      if (result.success && result.analysisId) {
        // Success - show toast and redirect
        toast({
          title: "Analysis Created",
          description: "Your credit report has been analyzed successfully.",
        })

        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        setSelectedFile(null)

        // Redirect to the analysis page
        router.push(`/credit-analysis?id=${result.analysisId}`)
      } else {
        // Error handling
        setError(result.error?.message || "Failed to process file")
        setDebugInfo(result.debugInfo || null)

        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: result.error?.message || "Failed to process file",
        })
      }
    } catch (error) {
      console.error("Upload error:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred")

      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setError(null)
    setDebugInfo(null)
    setUploadProgress({
      stage: "preparing",
      percent: 0,
      message: "Ready to upload",
    })

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const retryUpload = () => {
    setError(null)
    setDebugInfo(null)
    handleUpload()
  }

  const selectNewFile = () => {
    fileInputRef.current?.click()
  }

  // Get stage-specific UI elements
  const getStageIcon = () => {
    switch (uploadProgress.stage) {
      case "complete":
        return <CheckCircle2 className="h-10 w-10 text-green-500" />
      case "error":
        return <AlertCircle className="h-10 w-10 text-red-500" />
      case "uploading":
      case "processing":
      case "analyzing":
        return <Loader2 className="h-10 w-10 animate-spin text-primary" />
      default:
        return selectedFile ? (
          <FileText className="h-10 w-10 text-primary" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )
    }
  }

  const getProgressColor = () => {
    switch (uploadProgress.stage) {
      case "complete":
        return "bg-green-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-primary"
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileUp className="mr-2 h-5 w-5" />
          Upload Credit Report
        </CardTitle>
        <CardDescription>Upload your credit report for AI-powered analysis</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* File selection area */}
          <div
            className={`w-full border-2 border-dashed rounded-lg p-6 text-center ${
              error ? "border-destructive" : selectedFile ? "border-primary/50" : "border-muted-foreground/25"
            } ${isUploading ? "bg-muted/50" : ""}`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            style={{ cursor: isUploading ? "default" : "pointer" }}
          >
            <input
              type="file"
              className="hidden"
              id="credit-report-uploader-input"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.txt"
              disabled={isUploading}
            />

            <div className="flex flex-col items-center justify-center">
              {getStageIcon()}

              {isUploading ? (
                <div className="mt-4 space-y-2 w-full">
                  <p className="font-medium">{uploadProgress.message}</p>
                  <Progress
                    value={uploadProgress.percent}
                    className="h-2 w-full"
                    indicatorClassName={getProgressColor()}
                  />
                </div>
              ) : selectedFile ? (
                <div className="mt-4 space-y-1">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-1">
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">PDF, JPG, PNG, or TXT (max 10MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Debug info (only in development) */}
          {debugInfo && process.env.NODE_ENV === "development" && (
            <div className="w-full mt-4 p-3 bg-muted rounded-md">
              <p className="text-xs font-medium mb-1">Debug Information:</p>
              <pre className="text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {!isUploading && !selectedFile && (
          <Button onClick={selectNewFile} className="w-full">
            <Upload className="mr-2 h-4 w-4" /> Select File
          </Button>
        )}

        {!isUploading && selectedFile && (
          <>
            <Button onClick={handleUpload} className="flex-1">
              <FileUp className="mr-2 h-4 w-4" /> Upload & Analyze
            </Button>
            <Button variant="outline" onClick={resetUpload}>
              Cancel
            </Button>
          </>
        )}

        {isUploading && (
          <Button variant="outline" disabled className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
          </Button>
        )}

        {error && (
          <div className="flex w-full gap-2 mt-2">
            <Button variant="outline" onClick={selectNewFile} className="flex-1">
              <FileUp className="mr-2 h-4 w-4" /> Select New File
            </Button>
            <Button variant="outline" onClick={retryUpload} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry Upload
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
