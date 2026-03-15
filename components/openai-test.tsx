"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // Added CardHeader, CardTitle
import { useToast } from "@/components/ui/use-toast"
import { Loader2, CheckCircle, XCircle } from "lucide-react" // Added icons

interface TestResult {
  success: boolean
  message?: string // Message from our API route
  error?: string // Error message from our API route
  details?: any // Detailed error info (could be OpenAI's error object)
  data?: any // Success data (e.g., model count)
  status?: number // HTTP status from the test
}

export function OpenAITest() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const { toast } = useToast()

  const testConnection = async () => {
    setIsLoading(true)
    setResult(null)
    console.log("Starting OpenAI connection test from client...")

    try {
      const response = await fetch("/api/test-openai-connection") // Ensure this matches your route
      const data: TestResult = await response.json()

      console.log("Test API response received:", data)
      setResult(data)

      if (data.success) {
        toast({
          title: "OpenAI Connection: Success!",
          description: data.message || "Successfully connected to OpenAI API.",
          variant: "default",
        })
      } else {
        toast({
          title: "OpenAI Connection: Failed",
          description: data.error || data.details || "Failed to connect. Check console & server logs.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Client-side error during OpenAI test:", error)
      const errorMessage = error.message || "A client-side error occurred."
      setResult({
        success: false,
        error: "Client Error",
        details: errorMessage,
      })
      toast({
        title: "OpenAI Test Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>OpenAI API Connection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Click the button to test direct connectivity to the OpenAI API using your configured API key.
        </p>
        <Button onClick={testConnection} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Connection...
            </>
          ) : (
            "Run OpenAI Connection Test"
          )}
        </Button>

        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.success
                ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <p className="font-semibold">
                {result.success ? "Connection Successful" : "Connection Failed"}
                {result.status && ` (Status: ${result.status})`}
              </p>
            </div>

            {result.message && <p className="text-sm">{result.message}</p>}
            {result.error && <p className="text-sm font-medium">Error: {result.error}</p>}

            {result.data && (
              <div className="mt-2 text-xs bg-muted/50 p-2 rounded">
                <p className="font-medium mb-1">Response Data:</p>
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(result.data, null, 2)}</pre>
              </div>
            )}
            {result.details &&
              !result.data?.cause && ( // Don't show details if it's already in data.cause
                <div className="mt-2 text-xs bg-muted/50 p-2 rounded">
                  <p className="font-medium mb-1">Details:</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {typeof result.details === "string" ? result.details : JSON.stringify(result.details, null, 2)}
                  </pre>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
