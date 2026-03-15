"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { extractTextWithFallback } from "@/lib/pdf-extraction-service"
import { Loader2, Upload, FileText, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DebugReportAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState<string>("")
  const [question, setQuestion] = useState<string>(
    "Analyze this credit report and provide a detailed breakdown of all accounts, including any negative items that could be disputed.",
  )
  const [analysis, setAnalysis] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [stage, setStage] = useState<string>("")
  const [debugInfo, setDebugInfo] = useState<string>("")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    setDebugInfo("")
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)
    setStage("Extracting text from PDF...")

    try {
      // Extract text from the PDF
      const result = await extractTextWithFallback(selectedFile)
      const text = result.text
      setExtractedText(text)
      console.log(`Extracted ${text.length} characters from PDF`)
      setDebugInfo(`Extraction method: ${result.metadata.extractionMethod}, Characters: ${text.length}`)
    } catch (err) {
      console.error("Error extracting text:", err)
      setError("Failed to extract text from the PDF. Please try a different file.")
      setDebugInfo(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
      setStage("")
    }
  }

  const analyzeReport = async () => {
    if (!extractedText) {
      setError("No report text to analyze. Please upload a credit report first.")
      return
    }

    setLoading(true)
    setStage("Analyzing report...")
    setError("")
    setDebugInfo("")

    try {
      // First, check if the report is too large
      if (extractedText.length > 100000) {
        setDebugInfo(`Report is large (${extractedText.length} chars). Using first 100,000 chars.`)
        // Truncate to avoid API limits
        setExtractedText(extractedText.substring(0, 100000))
      }

      const response = await fetch("/api/analyze-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportText: extractedText,
          question: question,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`
        if (data.error) {
          errorMessage += ` - ${data.error}`
        }
        if (data.details) {
          setDebugInfo(`Error details: ${data.details}`)
        }
        throw new Error(errorMessage)
      }

      setAnalysis(data.analysis)
      if (data.tokens) {
        setDebugInfo(
          `Tokens used: ${data.tokens.total} (Prompt: ${data.tokens.prompt}, Completion: ${data.tokens.completion})`,
        )
      }
    } catch (err) {
      console.error("Error analyzing report:", err)
      setError(`Failed to analyze the report: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
      setStage("")
    }
  }

  return (
    <div className="space-y-6">
      {/* File Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Upload Credit Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Upload className="h-8 w-8 mb-4 text-gray-400" />
            <p className="mb-2 text-sm text-gray-500">Click to upload or drag and drop</p>
            <p className="text-xs text-gray-500 mb-4">PDF, JPG, PNG, or TXT files</p>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button asChild variant="outline">
              <label htmlFor="file-upload" className="cursor-pointer">
                Select File
              </label>
            </Button>
          </div>
          {file && (
            <div className="mt-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-500" />
              <span className="text-sm">{file.name}</span>
            </div>
          )}
          {debugInfo && <div className="mt-4 p-2 bg-muted rounded text-xs font-mono">{debugInfo}</div>}
        </CardContent>
      </Card>

      {/* Extracted Text Card */}
      {extractedText && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Review Extracted Text</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Character count: {extractedText.length}</span>
              </div>
              <div className="border rounded-md p-4 max-h-40 overflow-y-auto bg-muted/50">
                <pre className="text-xs whitespace-pre-wrap">
                  {extractedText.substring(0, 500)}
                  {extractedText.length > 500 ? "..." : ""}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question Card */}
      {extractedText && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Ask a Question</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know about this credit report?"
              className="min-h-[100px]"
            />
          </CardContent>
          <CardFooter>
            <Button onClick={analyzeReport} disabled={loading || !extractedText} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {stage}
                </>
              ) : (
                "Analyze Report"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, "<br/>") }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
