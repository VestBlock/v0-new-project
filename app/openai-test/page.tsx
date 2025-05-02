"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

export default function OpenAITestPage() {
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [creditText, setCreditText] = useState("")
  const [analysis, setAnalysis] = useState("")
  const [analyzing, setAnalyzing] = useState(false)

  // Test the OpenAI connection
  const testConnection = async () => {
    setLoading(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/test-openai")
      const data = await response.json()
      setTestResult(data)
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } finally {
      setLoading(false)
    }
  }

  // Analyze credit report text
  const analyzeCredit = async () => {
    if (!creditText.trim()) return

    setAnalyzing(true)
    setAnalysis("")

    try {
      const response = await fetch("/api/analyze-credit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: creditText }),
      })

      const data = await response.json()

      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        setAnalysis(`Error: ${data.error}`)
      }
    } catch (error) {
      setAnalysis(`Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">OpenAI Integration Test</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test OpenAI Connection</CardTitle>
            <CardDescription>Verify that your OpenAI API key is working correctly</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={testConnection} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
          </CardFooter>
          {testResult && (
            <CardContent>
              <div className={`p-4 rounded-md ${testResult.success ? "bg-green-50" : "bg-red-50"}`}>
                <p className={`font-medium ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                  {testResult.success ? "Success!" : "Failed!"}
                </p>
                <p className="mt-1">{testResult.success ? testResult.message : testResult.error}</p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Credit Analysis</CardTitle>
            <CardDescription>Enter credit report text to test the analysis functionality</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste credit report text here..."
              value={creditText}
              onChange={(e) => setCreditText(e.target.value)}
              rows={6}
              className="mb-4"
            />
            <Button onClick={analyzeCredit} disabled={analyzing || !creditText.trim()}>
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
                </>
              ) : (
                "Analyze Credit Report"
              )}
            </Button>
          </CardContent>
          {analysis && (
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-md whitespace-pre-wrap">{analysis}</div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
