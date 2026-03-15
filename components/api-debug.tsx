"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function ApiDebug() {
  const [isVisible, setIsVisible] = useState(false)
  const [endpoint, setEndpoint] = useState("/api/test-openai")
  const [method, setMethod] = useState("GET")
  const [requestBody, setRequestBody] = useState("")
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendRequest = async () => {
    setIsLoading(true)
    setResponse(null)
    setError(null)

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      }

      if (method !== "GET" && requestBody) {
        try {
          options.body = requestBody
        } catch (e) {
          setError("Invalid JSON in request body")
          setIsLoading(false)
          return
        }
      }

      const res = await fetch(endpoint, options)

      // Try to parse as JSON first
      try {
        const data = await res.json()
        setResponse({
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          data,
        })
      } catch (e) {
        // If not JSON, get as text
        const text = await res.text()
        setResponse({
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          data: text,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="fixed bottom-4 left-4 opacity-50 hover:opacity-100"
        onClick={() => setIsVisible(true)}
      >
        API Debug
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 left-4 p-4 z-50 w-96 bg-card/90 backdrop-blur max-h-[80vh] overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">API Debug Tool</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)}>
          Close
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="endpoint">Endpoint</Label>
          <div className="flex gap-2">
            <Textarea
              id="endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="flex-1 min-h-[40px]"
            />
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="bg-muted rounded-md px-2">
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
            </select>
          </div>
        </div>

        {method !== "GET" && (
          <div>
            <Label htmlFor="requestBody">Request Body (JSON)</Label>
            <Textarea
              id="requestBody"
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              className="min-h-[100px]"
              placeholder="{}"
            />
          </div>
        )}

        <Button onClick={sendRequest} disabled={isLoading} className="w-full">
          {isLoading ? "Sending..." : "Send Request"}
        </Button>

        {error && (
          <div className="p-2 bg-red-500/20 border border-red-500 rounded text-sm">
            <p className="font-medium text-red-400">Error:</p>
            <p className="text-xs">{error}</p>
          </div>
        )}

        {response && (
          <div>
            <p className="text-sm font-medium mb-1">Response:</p>
            <div className="p-2 bg-muted rounded text-xs">
              <p>
                Status: {response.status} {response.statusText}
              </p>
              <details>
                <summary className="cursor-pointer">Headers</summary>
                <pre className="mt-1 text-xs overflow-auto max-h-[100px]">
                  {JSON.stringify(response.headers, null, 2)}
                </pre>
              </details>
              <details open>
                <summary className="cursor-pointer">Body</summary>
                <pre className="mt-1 text-xs overflow-auto max-h-[200px]">
                  {typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
