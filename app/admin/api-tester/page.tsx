"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { verifyOpenAIResponse } from "@/lib/api-verification"

export default function ApiTesterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("analyze")
  const [testText, setTestText] = useState("")
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)

  async function testAnalyzeApi() {
    if (!testText.trim()) {
      setError("Please enter some text to analyze")
      return
    }

    setLoading(true)
    setError(null)
    setApiResponse(null)
    setVerificationResult(null)

    try {
      // Call the analyze API
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_TEST_TOKEN", // You would need to implement proper auth for testing
        },
        body: JSON.stringify({
          text: testText,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      setApiResponse(data)

      // Verify the response
      const verification = await verifyOpenAIResponse(data)
      setVerificationResult(verification)

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error testing API")
      setLoading(false)
    }
  }

  async function testChatApi() {
    if (!testText.trim()) {
      setError("Please enter a message to send")
      return
    }

    setLoading(true)
    setError(null)
    setApiResponse(null)
    setVerificationResult(null)

    try {
      // Call the chat API
      const response = await fetch("/api/credit-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_TEST_TOKEN", // You would need to implement proper auth for testing
        },
        body: JSON.stringify({
          analysisId: "test-analysis-id", // You would need a real analysis ID
          message: testText,
          conversationHistory: [],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      setApiResponse(data)

      // Verify the response
      const verification = await verifyOpenAIResponse(data)
      setVerificationResult(verification)

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error testing API")
      setLoading(false)
    }
  }

  function handleTest() {
    if (activeTab === "analyze") {
      testAnalyzeApi()
    } else if (activeTab === "chat") {
      testChatApi()
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">API Tester</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test API Endpoints</CardTitle>
            <CardDescription>Send test requests to verify real-time data</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="analyze">Analyze API</TabsTrigger>
                <TabsTrigger value="chat">Chat API</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {activeTab === "analyze" ? "Text to Analyze" : "Chat Message"}
                </label>
                <Textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder={activeTab === "analyze" ? "Enter credit report text..." : "Enter your message..."}
                  className="min-h-[150px]"
                />
              </div>

              {activeTab === "chat" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Analysis ID</label>
                  <Input placeholder="Enter analysis ID" />
                </div>
              )}

              <Button onClick={handleTest} disabled={loading || !testText.trim()} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  `Test ${activeTab === "analyze" ? "Analyze" : "Chat"} API`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
            <CardDescription>Response data and verification results</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : apiResponse ? (
              <div className="space-y-4">
                {verificationResult && (
                  <div
                    className={`p-3 rounded-md ${
                      verificationResult.mockDataAnalysis.isMockData
                        ? "bg-red-50 border border-red-200"
                        : "bg-green-50 border border-green-200"
                    }`}
                  >
                    <h3 className="font-medium mb-1">Verification Result</h3>
                    <div className="text-sm">
                      <p>
                        <span className="font-medium">Mock Data:</span>
                        {verificationResult.mockDataAnalysis.isMockData ? "Yes" : "No"}
                      </p>
                      <p>
                        <span className="font-medium">Confidence:</span>
                        {verificationResult.mockDataAnalysis.confidence}%
                      </p>
                      {verificationResult.mockDataAnalysis.reasons.length > 0 && (
                        <div>
                          <span className="font-medium">Reasons:</span>
                          <ul className="list-disc list-inside">
                            {verificationResult.mockDataAnalysis.reasons.map((reason: string, i: number) => (
                              <li key={i}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-1">Response Data</h3>
                  <pre className="bg-gray-100 p-3 rounded-md overflow-auto text-xs">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No response data. Run a test to see results.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
