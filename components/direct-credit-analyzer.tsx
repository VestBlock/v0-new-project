"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { extractTextWithFallback } from "@/lib/pdf-extraction-service"
import { Loader2, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

export function DirectCreditAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState<string>("")
  const [question, setQuestion] = useState<string>(
    "Analyze this credit report and provide a detailed breakdown of all accounts, including any negative items that could be disputed. Suggest specific steps to improve my credit score.",
  )
  const [analysis, setAnalysis] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [stage, setStage] = useState<string>("")
  const [progress, setProgress] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)
    setStage("Extracting text from document...")
    setProgress(10)

    try {
      // Extract text from the PDF
      const result = await extractTextWithFallback(selectedFile)
      const text = result.text
      setExtractedText(text)
      console.log(`Extracted ${text.length} characters from document`)
      setProgress(50)
    } catch (err) {
      console.error("Error extracting text:", err)
      setError("Failed to extract text from the document. Please try a different file.")
    } finally {
      setLoading(false)
      setStage("")
      setProgress(0)
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
    setProgress(20)

    try {
      // First, check if the report is too large
      const textToAnalyze = extractedText.length > 100000 ? extractedText.substring(0, 100000) : extractedText

      setProgress(40)

      const response = await fetch("/api/analyze-credit-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportText: textToAnalyze,
          question: question,
        }),
      })

      setProgress(80)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`)
      }

      setAnalysis(data.analysis)
      setProgress(100)
    } catch (err) {
      console.error("Error analyzing report:", err)
      setError(`Failed to analyze the report: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
      setStage("")
      setProgress(0)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Credit Report Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* File Upload Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Step 1: Upload Your Credit Report</h3>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mb-4 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500 mb-4">PDF, JPG, PNG, or TXT files</p>
                <Input
                  id="file-upload"
                  type="file"
                  ref={fileInputRef}
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
            </div>

            {/* Loading Progress */}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage}</span>
                  <span className="text-sm text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Extracted Text Preview */}
            {extractedText && (
              <div>
                <h3 className="text-lg font-medium mb-4">Step 2: Review Extracted Text</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Character count: {extractedText.length}</span>
                    {extractedText.length > 0 && (
                      <div className="flex items-center text-green-500 text-sm">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Text extracted successfully
                      </div>
                    )}
                  </div>
                  <div className="border rounded-md p-4 max-h-40 overflow-y-auto bg-muted/50">
                    <pre className="text-xs whitespace-pre-wrap">
                      {extractedText.substring(0, 500)}
                      {extractedText.length > 500 ? "..." : ""}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Question Input */}
            {extractedText && (
              <div>
                <h3 className="text-lg font-medium mb-4">Step 3: Ask a Question</h3>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What would you like to know about this credit report?"
                  className="min-h-[100px]"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={analyzeReport}
            disabled={loading || !extractedText}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {stage}
              </>
            ) : (
              "Analyze Credit Report"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Report Analysis</CardTitle>
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
