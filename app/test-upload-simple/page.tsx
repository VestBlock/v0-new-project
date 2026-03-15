"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, CheckCircle, AlertCircle } from "lucide-react"

export default function SimpleUploadTest() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
      setLogs([])
      addLog(`File selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`)
    }
  }

  const testUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      addLog("Starting upload process...")

      // Step 1: Create FormData
      const formData = new FormData()
      formData.append("file", file)
      addLog("FormData created with file")

      // Step 2: Send request
      addLog("Sending request to /api/analyze-document...")
      const response = await fetch("/api/analyze-document", {
        method: "POST",
        body: formData,
      })

      addLog(`Response received: ${response.status} ${response.statusText}`)

      // Step 3: Parse response
      const responseText = await response.text()
      addLog(`Response length: ${responseText.length} characters`)

      let data
      try {
        data = JSON.parse(responseText)
        addLog("Response parsed as JSON successfully")
      } catch (e) {
        addLog("Failed to parse response as JSON")
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`)
      }

      // Step 4: Check response
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      if (data.success) {
        addLog("Analysis completed successfully!")
        if (data.creditScore) {
          addLog(`Credit score found: ${data.creditScore}`)
        }
        if (data.negativeItems?.length > 0) {
          addLog(`Negative items found: ${data.negativeItems.length}`)
        }
        if (data.accounts?.length > 0) {
          addLog(`Accounts found: ${data.accounts.length}`)
        }
      }

      setResult(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      addLog(`ERROR: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Simple Upload Test</h1>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Credit Report</h2>

          <div className="space-y-4">
            <Input type="file" onChange={handleFileChange} accept=".txt,.pdf,.jpg,.jpeg,.png" />

            {file && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  Type: {file.type || "Unknown"} | Size: {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            <Button onClick={testUpload} disabled={!file || isUploading} className="w-full">
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Test Upload & Analysis
                </>
              )}
            </Button>
          </div>
        </Card>

        {logs.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Process Logs</h2>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-xs whitespace-pre-wrap font-mono">{logs.join("\n")}</pre>
            </div>
          </Card>
        )}

        {error && (
          <Card className="p-6 border-red-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-500">Error</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {result && (
          <Card className="p-6 border-green-500">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-500">Analysis Complete</h3>

                {result.creditScore && (
                  <div className="mt-4 p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold">Credit Score: {result.creditScore}</p>
                  </div>
                )}

                <div className="mt-4">
                  <h4 className="font-medium mb-2">Full Response:</h4>
                  <Textarea className="font-mono text-xs h-96" value={JSON.stringify(result, null, 2)} readOnly />
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
