"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Loader2, Upload, FileText, AlertTriangle, Copy, Check, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { processFileWithOCR, type OCRResponse } from "@/lib/ocr-client"

export function OCRFileProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<OCRResponse | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { toast } = useToast()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null
    setFile(selectedFile)
    setResult(null)
    setProgress(0)
    setDebugInfo(null)
  }

  const handleProcess = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please select a file to process",
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setResult(null)
    setDebugInfo(null)

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      toast({
        title: "Processing Started",
        description: `Processing ${file.name}...`,
      })

      const response = await processFileWithOCR(file, {
        onProgress: setProgress,
        abortSignal: abortControllerRef.current.signal,
      })

      setResult(response)

      if (response.success) {
        toast({
          title: "Processing Complete",
          description: `Successfully extracted ${response.text.length} characters in ${response.metadata.processingTimeMs}ms`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: response.error,
        })

        // Set debug info for troubleshooting
        if (response.details) {
          setDebugInfo(JSON.stringify(response.details, null, 2))
        }
      }
    } catch (error) {
      console.error("Error processing file:", error)

      const errorResponse = error as any
      let errorMessage = "Unknown error occurred"
      let errorCode = "unknown_error"
      let details = null

      // If the error is already a structured OCR error response
      if (
        errorResponse &&
        typeof errorResponse === "object" &&
        "success" in errorResponse &&
        errorResponse.success === false
      ) {
        errorMessage = errorResponse.error
        errorCode = errorResponse.code
        details = errorResponse.details
      } else if (error instanceof Error) {
        errorMessage = error.message
        details = error.stack
      } else {
        errorMessage = String(error)
      }

      setResult({
        success: false,
        error: errorMessage,
        code: errorCode || "client_error",
      })

      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: errorMessage,
      })

      // Set debug info for troubleshooting
      if (details) {
        setDebugInfo(typeof details === "string" ? details : JSON.stringify(details, null, 2))
      } else if (error instanceof Error) {
        setDebugInfo(error.stack || error.message)
      } else {
        setDebugInfo(String(error))
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsProcessing(false)

      toast({
        title: "Processing Cancelled",
        description: "File processing was cancelled",
      })
    }
  }

  const copyToClipboard = () => {
    if (result?.success) {
      navigator.clipboard.writeText(result.text)
      setIsCopied(true)

      toast({
        title: "Copied to Clipboard",
        description: "The extracted text has been copied to your clipboard",
      })

      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const resetForm = () => {
    setFile(null)
    setResult(null)
    setProgress(0)
    setDebugInfo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>OCR Text Extraction</CardTitle>
        <CardDescription>Upload a PDF or image to extract text using OCR</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" className="w-full">
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt"
                  disabled={isProcessing}
                />
                <Upload className="mr-2 h-4 w-4" />
                {file ? "Change File" : "Select File"}
              </label>
            </Button>

            <Button
              onClick={isProcessing ? handleCancel : handleProcess}
              disabled={!file || (isProcessing && progress === 100)}
              variant={isProcessing ? "destructive" : "default"}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancel
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Process File
                </>
              )}
            </Button>
          </div>

          {file && (
            <div className="text-sm text-muted-foreground">
              Selected file: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {result && (
            <div className="mt-4">
              {result.success ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-green-600">
                      <Check className="mr-2 h-4 w-4" />
                      <span className="font-medium">Processing Successful</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-8">
                      <Copy className="mr-2 h-3 w-3" />
                      {isCopied ? "Copied!" : "Copy Text"}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Processed in {result.metadata.processingTimeMs}ms using {result.metadata.model}
                  </div>

                  <div className="max-h-60 overflow-auto rounded border p-3 text-sm">
                    <pre className="whitespace-pre-wrap font-sans">{result.text}</pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Processing Failed</AlertTitle>
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>

                  {debugInfo && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Debug Information:</p>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                        {debugInfo}
                      </pre>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={resetForm}>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between text-xs text-muted-foreground">
        <div>Supports PDF, JPG, PNG, GIF, WebP, and TXT files up to 25MB</div>
        <div>Powered by OpenAI Vision</div>
      </CardFooter>
    </Card>
  )
}
