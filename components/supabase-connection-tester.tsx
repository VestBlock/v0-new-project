"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react"

export function SupabaseConnectionTester() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  const testConnection = async () => {
    setStatus("loading")

    try {
      const response = await fetch("/api/test-supabase")
      const data = await response.json()

      if (data.success) {
        setStatus("success")
        setMessage("Successfully connected to Supabase")
      } else {
        setStatus("error")
        setMessage(data.message || "Failed to connect to Supabase")
      }
    } catch (error) {
      setStatus("error")
      setMessage("Error testing connection: " + String(error))
    }
  }

  useEffect(() => {
    testConnection()
  }, [])

  return (
    <div className="space-y-4">
      {status === "loading" && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
          <AlertTitle>Testing Connection</AlertTitle>
          <AlertDescription>Checking connection to Supabase...</AlertDescription>
        </Alert>
      )}

      {status === "success" && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Connection Successful</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            {message}
            <Button variant="outline" size="sm" onClick={testConnection} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
