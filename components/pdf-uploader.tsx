"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase-client"

export function PDFUploader() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Invalid file type. Only PDF files are accepted.")
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (25MB max)
    const maxSize = 25 * 1024 * 1024 // 25MB in bytes
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 25MB.")
      toast({
        title: "File Too Large",
        description: "Maximum file size is 25MB.",
        variant: "destructive",
      })
      return
    }

    // Clear previous errors
    setError(null)
    setIsUploading(true)
    setUploadProgress(10) // Start progress at 10%

    try {
      // Get the current user's session
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        throw new Error("Not authenticated")
      }

      // Create form data
      const formData = new FormData()
      formData.append("file", file)

      // Simulate progress during upload
      let progressInterval: NodeJS.Timeout
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 1000)

      // Upload the file
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload PDF")
      }

      toast({
        title: "Upload Successful",
        description: "Your credit report is being analyzed.",
      })

      // Redirect to the analysis page
      router.push(`/credit-analysis?id=${result.analysisId}`)
    } catch (err) {
      clearInterval(progressInterval)
      setUploadProgress(0)
      setIsUploading(false)

      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred"
      setError(errorMessage)

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          Upload Credit Report PDF
        </CardTitle>
        <CardDescription>Upload your credit report PDF for AI-powered analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            error ? "border-destructive" : "border-muted-foreground/25"
          }`}
        >
          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <div>
                <p className="font-medium">Uploading and processing...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {uploadProgress < 100
                    ? "This may take a few minutes depending on file size"
                    : "Processing your credit report..."}
                </p>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-2 font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-1">PDF files only (max 25MB)</p>

              {error && (
                <div className="mt-4 text-destructive flex items-start text-sm">
                  <AlertCircle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {!isUploading && (
          <Button onClick={triggerFileInput} className="w-full" disabled={isUploading}>
            Select PDF File
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
