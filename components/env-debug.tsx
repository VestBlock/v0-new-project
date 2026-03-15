"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function EnvDebug() {
  const [envStatus, setEnvStatus] = useState<{
    connectionSuccess: boolean
    error?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const checkEnvVariables = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/test-openai")
      const data = await response.json()
      setEnvStatus({
        connectionSuccess: data.success,
        error: data.error,
      })
    } catch (error) {
      console.error("Failed to check environment variables:", error)
      setEnvStatus({
        connectionSuccess: false,
        error: "Failed to fetch API status",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isVisible) {
      checkEnvVariables()
    }
  }, [isVisible])

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="fixed bottom-4 right-4 opacity-50 hover:opacity-100"
        onClick={() => setIsVisible(true)}
      >
        Debug
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 z-50 w-80 bg-card/90 backdrop-blur">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">API Status</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)}>
          Close
        </Button>
      </div>
      {isLoading ? (
        <p>Checking server status...</p>
      ) : envStatus ? (
        <ul className="space-y-2 text-sm">
          <li className={envStatus.connectionSuccess ? "text-green-500" : "text-red-500"}>
            Server API Connection: {envStatus.connectionSuccess ? "✓ Working" : "✗ Failed"}
          </li>
          {envStatus.error && <li className="text-red-500 text-xs mt-2">Error: {envStatus.error}</li>}
        </ul>
      ) : (
        <p>Click Refresh to check status.</p>
      )}
      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={checkEnvVariables} disabled={isLoading}>
        Refresh Status
      </Button>
    </Card>
  )
}
