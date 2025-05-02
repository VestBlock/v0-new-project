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
  const [textInput, setTextInput] = useState<string>("")
  const [inputMethod, setInputMethod] = useState<"file" | "text">("file")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const uploadFile = async () => {
    if (inputMethod === "file" && !file) return
    if (inputMethod === "text" && !textInput.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      if (inputMethod === "file") {
        // Check file type
        const fileType = file!.type

        if (!fileType.startsWith("image/") && fileType !== "application/pdf") {
          setError("Only image files (JPEG, PNG) and PDFs are supported")
          setLoading(false)
          return
        }

        // Convert file to base64
        const reader = new FileReader()
        reader.readAsDataURL(file!)

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
              fileName: file!.name,
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
      } else {
        // Process text input
        const response = await fetch("/api/process-credit-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            textContent: textInput,
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
        <div className="flex gap-4 mb-4">
          <Button variant={inputMethod === "file" ? "default" : "outline"} onClick={() => setInputMethod("file")}>
            Upload File
          </Button>
          <Button variant={inputMethod === "text" ? "default" : "outline"} onClick={() => setInputMethod("text")}>
            Enter Text
          </Button>
        </div>

        {inputMethod === "file" ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              disabled={loading}
            />
            <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
              <Upload className="h-12 w-12 text-gray-400 mb-4" />
              <span className="text-sm text-gray-500">
                {file ? file.name : "Click to upload image of credit report (JPEG, PNG only)"}
              </span>
              <span className="text-xs text-gray-400 mt-2">
                Note: Currently only image files are supported for direct processing
              </span>
            </label>
          </div>
        ) : (
          <div className="flex flex-col">
            <textarea
              className="w-full h-40 p-4 border border-gray-300 rounded-lg"
              placeholder="Paste the text content of your credit report here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={loading}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-4">
        <Button
          onClick={uploadFile}
          disabled={(inputMethod === "file" && !file) || (inputMethod === "text" && !textInput.trim()) || loading}
          className="w-full"
        >
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
