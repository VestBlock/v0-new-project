"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { extractTextWithFallback } from "@/lib/pdf-extraction-service"
import { AnalysisResultClientView } from "@/components/analysis-result-client-view"

export function EnhancedCreditAnalyzerClient() {
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === "application/pdf" || selectedFile.type === "text/plain") {
        setFile(selectedFile)
        setError(null)
      } else {
        setError("Please upload a valid PDF or TXT file.")
        toast({
          title: "Invalid File Type",
          description: "Only PDF and TXT files are supported.",
          variant: "destructive",
        })
      }
    }
  }

  const handleAnalysis = useCallback(async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a file to analyze.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setError(null)
    setExtractedText(null)

    try {
      const text = await extractTextWithFallback(file)
      setExtractedText(text)
      toast({
        title: "Extraction Successful",
        description: "File content has been extracted.",
      })
    } catch (err: any) {
      console.error("Analysis failed:", err)
      const errorMessage = err.message || "An unknown error occurred during analysis."
      setError(errorMessage)
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [file, toast])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Credit Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="credit-report">Select PDF or TXT file</Label>
            <Input id="credit-report" type="file" accept=".pdf,.txt" onChange={handleFileChange} />
          </div>
          {file && <p className="text-sm text-muted-foreground">Selected: {file.name}</p>}
          <Button onClick={handleAnalysis} disabled={!file || isLoading}>
            {isLoading ? "Analyzing..." : "Analyze Report"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {extractedText && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Text</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisResultClientView analysis={{ extracted_text: extractedText }} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
