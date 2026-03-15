"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, X, FileText, Check, AlertCircle, FileUp } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"

interface FileUploadProps {
  bucket: string
  folder?: string
  acceptedFileTypes?: string
  maxSizeMB?: number
  onUploadComplete?: (url: string, path: string) => void
  buttonText?: string
  showPreview?: boolean
}

export function FileUpload({
  bucket,
  folder = "",
  acceptedFileTypes = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 10,
  onUploadComplete,
  buttonText = "Upload File",
  showPreview = false,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Clean up preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Check file size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit`)
      return
    }

    setFile(selectedFile)
    setError(null)
    setUploadedUrl(null)
    setUploadStatus("idle")

    // Create preview for images
    if (showPreview && selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }

  const handleUpload = async () => {
    if (!file || !user) return

    try {
      setIsUploading(true)
      setProgress(0)
      setError(null)
      setUploadStatus("uploading")

      // Create a unique file path
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = folder ? `${folder}/${fileName}` : fileName

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        onUploadProgress: (progress) => {
          setProgress(Math.round((progress.loaded / progress.total) * 100))
        },
      })

      if (error) {
        throw error
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)

      setUploadedUrl(urlData.publicUrl)
      setUploadStatus("processing")

      // Simulate processing time (in a real app, this would be the actual processing time)
      setTimeout(() => {
        setUploadStatus("success")

        // Call the callback with the URL
        if (onUploadComplete) {
          onUploadComplete(urlData.publicUrl, data.path)
        }

        toast({
          title: "Upload complete",
          description: "Your file has been uploaded and processed successfully.",
        })
      }, 1500)
    } catch (error: any) {
      console.error("File upload error:", error)
      setError(error.message || "Failed to upload file")
      setUploadStatus("error")
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setError(null)
    setUploadedUrl(null)
    setProgress(0)
    setUploadStatus("idle")
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const getStatusColor = () => {
    switch (uploadStatus) {
      case "uploading":
        return "border-blue-500 bg-blue-500/10"
      case "processing":
        return "border-yellow-500 bg-yellow-500/10"
      case "success":
        return "border-green-500 bg-green-500/10"
      case "error":
        return "border-red-500 bg-red-500/10"
      default:
        return "border-border"
    }
  }

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case "uploading":
        return <Upload className="h-5 w-5 text-blue-500 animate-pulse" />
      case "processing":
        return <FileText className="h-5 w-5 text-yellow-500 animate-pulse" />
      case "success":
        return <Check className="h-5 w-5 text-green-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileUp className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (uploadStatus) {
      case "uploading":
        return `Uploading... ${progress}%`
      case "processing":
        return "Processing file..."
      case "success":
        return "Upload complete!"
      case "error":
        return "Upload failed"
      default:
        return "Ready to upload"
    }
  }

  return (
    <Card className="p-6 bg-card/80 backdrop-blur">
      <div className="space-y-4">
        {!file ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6"
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground mb-2">Drag and drop a file or click to browse</p>
            <p className="text-xs text-muted-foreground mb-4">
              Accepted file types: {acceptedFileTypes} (Max size: {maxSizeMB}MB)
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="relative overflow-hidden"
            >
              {buttonText}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={acceptedFileTypes}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="file-selected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div
                className={`flex items-center justify-between p-4 border rounded-lg ${getStatusColor()} transition-colors duration-300`}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon()}
                  <div>
                    <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <p className="text-sm font-medium">{getStatusText()}</p>
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={isUploading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {showPreview && previewUrl && (
                <div className="flex justify-center">
                  <img
                    src={previewUrl || "/placeholder.svg"}
                    alt="File preview"
                    className="max-h-40 rounded-md object-contain"
                  />
                </div>
              )}

              {uploadStatus === "uploading" && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading file</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              )}

              {uploadStatus === "processing" && (
                <div className="space-y-2">
                  <Progress value={100} className="h-2 bg-yellow-500/20" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Processing file</span>
                    <span>Please wait...</span>
                  </div>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500 rounded-md flex items-start gap-2"
                >
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-500">Upload failed</p>
                    <p className="text-xs">{error}</p>
                  </div>
                </motion.div>
              )}

              {uploadStatus === "success" ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-green-500/10 border border-green-500 rounded-md flex items-center gap-2"
                >
                  <Check className="h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium text-green-500">File uploaded successfully!</p>
                </motion.div>
              ) : (
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || uploadStatus === "processing" || uploadStatus === "success"}
                  className={`w-full ${uploadStatus === "error" ? "bg-red-500 hover:bg-red-600" : "bg-cyan-500 hover:bg-cyan-600"}`}
                >
                  {uploadStatus === "error" ? "Try Again" : isUploading ? `Uploading (${progress}%)` : "Upload"}
                </Button>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Card>
  )
}
