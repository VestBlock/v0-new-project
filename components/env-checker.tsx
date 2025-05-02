"use client"

import { useEffect, useState } from "react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function EnvChecker() {
  const [showDetails, setShowDetails] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      // Client-side safe way to check env vars
      const clientEnvVars = {
        supabase: {
          url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
      }
      setStatus(clientEnvVars)

      if (!clientEnvVars.supabase.url || !clientEnvVars.supabase.anonKey) {
        setError("Missing required Supabase environment variables")
      }
    } catch (err) {
      setError("Error checking environment variables")
    }
  }, [])

  if (process.env.NODE_ENV === "production" || !error) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 shadow-lg">
      <Alert variant="destructive">
        <AlertTitle>Environment Variable Error</AlertTitle>
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Hide Details" : "Show Details"}
          </Button>

          {showDetails && status && (
            <pre className="mt-2 p-2 bg-slate-900 text-white rounded text-xs overflow-auto">
              {JSON.stringify(status, null, 2)}
            </pre>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
