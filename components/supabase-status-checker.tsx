"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"

export function SupabaseStatusChecker() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function checkSupabaseConnection() {
      try {
        const response = await fetch("/api/test-connection")
        const data = await response.json()

        if (data.success) {
          setStatus("success")
          setMessage("Supabase connection successful")
        } else {
          setStatus("error")
          setMessage(data.error || "Failed to connect to Supabase")
        }
      } catch (error) {
        setStatus("error")
        setMessage("Error checking Supabase connection")
      }
    }

    checkSupabaseConnection()
  }, [])

  if (status === "loading") {
    return null
  }

  return (
    <Alert variant={status === "success" ? "default" : "destructive"} className="mb-4">
      {status === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <AlertTitle>{status === "success" ? "Success" : "Error"}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
