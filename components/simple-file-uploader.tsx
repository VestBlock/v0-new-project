"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { uploadCreditReport } from "@/lib/file-upload-service"

export function SimpleFileUploader() {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { user, getToken } = useAuth()

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)
    setProgress(0)

    try {
      // Get auth token
      const token = await getToken()
      if (!token) {
        throw new Error("Authentication failed. Please log in again.")
      }

      // Show initial toast
      toast({
        title: "Processing Started",
        description: "Your credit report is being analyzed. This may take a few minutes.",
      })

      // Upload the file
      const result = await uploadCreditReport(file, token, {
        onProgress: (progress) => {
          setProgress(progress.percent)
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

        // Redirect to the analysis page
        router.push(`/credit-analysis?id=${result.analysisId}`)
      } else {
        // Error handling
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: result.error?.message || "Failed to process file",
        })
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      })
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  return (
    <Button asChild className={isUploading ? "opacity-80 cursor-not-allowed" : ""}>
      <label className="cursor-pointer">
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          accept=".jpg,.jpeg,.png,.pdf,.txt"
          onChange={handleUpload}
          disabled={isUploading}
        />
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading {progress > 0 ? `(${progress}%)` : "..."}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Upload Credit Report
          </>
        )}
      </label>
    </Button>
  )
}
