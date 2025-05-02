"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload } from "lucide-react"

export default function CreditReportUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const uploadFile = async () => {
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = async () => {
        const base64data = reader.result as string

        // Send to API
        const response = await fetch("/api/process-credit-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileData: base64data,
            fileName: file.name,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
        } else {
          setError(data.error || "Failed to process credit report")
        }

        setLoading(false)
      }

      reader.onerror = () => {
        setError("Failed to read file")
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Credit Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={loading}
          />
          <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <span className="text-sm text-gray-500">
              {file ? file.name : "Click to upload PDF or image of credit report"}
            </span>
          </label>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-4">
        <Button onClick={uploadFile} disabled={!file || loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            "Process Credit Report"
          )}
        </Button>

        {error && <div className="w-full p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

        {result && (
          <div className="w-full p-4 bg-green-50 text-green-700 rounded-md">
            <h3 className="font-bold mb-2">Results:</h3>
            <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
