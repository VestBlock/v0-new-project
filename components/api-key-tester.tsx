"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function ApiKeyTester() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testApiKey = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/test-openai-key")
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test OpenAI API Key</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-4">
          Click the button below to test if your OpenAI API key is properly configured.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-4">
        <Button onClick={testApiKey} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...
            </>
          ) : (
            "Test API Key"
          )}
        </Button>

        {result && (
          <div
            className={`w-full p-4 rounded-md ${
              result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            <p className="font-medium">{result.success ? "Success!" : "Error!"}</p>
            <p className="mt-1">{result.success ? result.message : result.error}</p>
            {result.success && result.response && <p className="mt-2">Response: {result.response}</p>}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
