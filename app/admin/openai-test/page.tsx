"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase"

export default function OpenAITestPage() {
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const runTest = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication failed. Please log in again.")
      }

      // Run the simple test
      const testResponse = await fetch("/api/test-openai", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const testData = await testResponse.json()
      setTestResult(testData)

      // Run the diagnostic
      const diagnosticResponse = await fetch("/api/admin/openai-diagnostic", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const diagnosticData = await diagnosticResponse.json()
      setDiagnosticResult(diagnosticData.data)
    } catch (err) {
      setError(err.message || "An error occurred during the test")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      runTest()
    }
  }, [user])

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">OpenAI Integration Test</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Simple API Test</CardTitle>
            <CardDescription>Tests basic OpenAI API connectivity</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  {testResult.success ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="h-5 w-5 mr-1" /> Working
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600">
                      <XCircle className="h-5 w-5 mr-1" /> Failed
                    </span>
                  )}
                </div>

                {testResult.result && (
                  <div>
                    <span className="font-medium">Response:</span>
                    <p className="mt-1 p-3 bg-muted rounded-md">{testResult.result}</p>
                  </div>
                )}

                {testResult.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>API Error</AlertTitle>
                    <AlertDescription>{testResult.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No test has been run yet.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={runTest} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Run Test
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comprehensive Diagnostic</CardTitle>
            <CardDescription>Detailed OpenAI integration diagnostic</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : diagnosticResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Direct API:</span>
                    {diagnosticResult.directApiWorking ? (
                      <span className="flex items-center text-green-600 mt-1">
                        <CheckCircle className="h-5 w-5 mr-1" /> Working
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600 mt-1">
                        <XCircle className="h-5 w-5 mr-1" /> Failed
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="font-medium">Client API:</span>
                    {diagnosticResult.clientApiWorking ? (
                      <span className="flex items-center text-green-600 mt-1">
                        <CheckCircle className="h-5 w-5 mr-1" /> Working
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600 mt-1">
                        <XCircle className="h-5 w-5 mr-1" /> Failed
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-medium">API Key:</span>
                  {diagnosticResult.apiKey.exists ? (
                    <div className="flex items-center text-green-600 mt-1">
                      <CheckCircle className="h-5 w-5 mr-1" />
                      Present {diagnosticResult.apiKey.prefix && `(${diagnosticResult.apiKey.prefix})`}
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600 mt-1">
                      <XCircle className="h-5 w-5 mr-1" /> Missing
                    </div>
                  )}
                </div>

                {diagnosticResult.errors.length > 0 && (
                  <div>
                    <span className="font-medium">Errors:</span>
                    <ul className="mt-1 space-y-1 text-red-600">
                      {diagnosticResult.errors.map((err: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <XCircle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                          <span>{err}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnosticResult.recommendations.length > 0 && (
                  <div>
                    <span className="font-medium">Recommendations:</span>
                    <ul className="mt-1 space-y-1 text-amber-600">
                      {diagnosticResult.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <AlertTriangle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No diagnostic has been run yet.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={runTest} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Run Diagnostic
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting Steps</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Verify your OpenAI API key is correctly set in your environment variables</li>
          <li>Check that your OpenAI account has sufficient credits and is in good standing</li>
          <li>Ensure you're using supported model names (gpt-4, gpt-4-vision-preview, gpt-3.5-turbo)</li>
          <li>Check network connectivity from your server to api.openai.com</li>
          <li>Verify that your request format matches the OpenAI API specifications</li>
          <li>Check for rate limiting or quota issues in your OpenAI dashboard</li>
        </ol>
      </div>
    </div>
  )
}
