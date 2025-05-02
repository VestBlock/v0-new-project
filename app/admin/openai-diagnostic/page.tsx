"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function OpenAIDiagnosticPage() {
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    message?: string
    error?: string
    apiKey?: string
    response?: string
  } | null>(null)
  const { toast } = useToast()

  const checkOpenAI = async () => {
    setIsChecking(true)
    setResult(null)

    try {
      const response = await fetch("/api/admin/check-openai")
      const data = await response.json()

      setResult(data)

      if (data.success) {
        toast({
          title: "Success",
          description: "OpenAI API key is working correctly",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "OpenAI API key is not working",
        })
      }
    } catch (error) {
      console.error("Error checking OpenAI API key:", error)
      setResult({
        success: false,
        message: "Error checking OpenAI API key",
        error: error instanceof Error ? error.message : "Unknown error",
      })

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to check OpenAI API key",
      })
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    // Check OpenAI API key on page load
    checkOpenAI()
  }, [])

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">OpenAI API Key Diagnostic</h1>

      <Card>
        <CardHeader>
          <CardTitle>OpenAI API Key Status</CardTitle>
          <CardDescription>Check if your OpenAI API key is configured correctly and working</CardDescription>
        </CardHeader>
        <CardContent>
          {isChecking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <p>Checking OpenAI API key...</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="flex items-center">
                {result.success ? (
                  <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500 mr-2" />
                )}
                <span className="text-lg font-medium">
                  {result.success ? "API Key is working" : "API Key is not working"}
                </span>
              </div>

              <div className="rounded-md bg-muted p-4">
                <p className="font-medium">Message:</p>
                <p className="text-sm">{result.message}</p>

                {result.apiKey && (
                  <>
                    <p className="font-medium mt-2">API Key:</p>
                    <p className="text-sm">{result.apiKey}</p>
                  </>
                )}

                {result.response && (
                  <>
                    <p className="font-medium mt-2">Test Response:</p>
                    <p className="text-sm">{result.response}</p>
                  </>
                )}

                {result.error && (
                  <>
                    <p className="font-medium mt-2">Error:</p>
                    <p className="text-sm text-red-500">{result.error}</p>
                  </>
                )}
              </div>

              {!result.success && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800">Troubleshooting Steps</h3>
                      <ul className="mt-2 text-sm text-amber-700 list-disc pl-5 space-y-1">
                        <li>Check that your OpenAI API key is set in your environment variables</li>
                        <li>Verify that the API key is valid and has not expired</li>
                        <li>Ensure your OpenAI account has billing enabled</li>
                        <li>Check if you have exceeded your API usage limits</li>
                        <li>Restart your server after updating the API key</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">No results available</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={checkOpenAI} disabled={isChecking} className="w-full">
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Check API Key Again"
            )}
          </Button>
        </CardFooter>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">How to Set Your OpenAI API Key</h2>
        <Card>
          <CardContent className="pt-6">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Go to{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  OpenAI API Keys
                </a>{" "}
                page
              </li>
              <li>Create a new API key if you don't have one</li>
              <li>Copy the API key</li>
              <li>
                Add it to your Vercel project environment variables as{" "}
                <code className="bg-muted px-1 py-0.5 rounded">OPENAI_API_KEY</code>
              </li>
              <li>Redeploy your application</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
