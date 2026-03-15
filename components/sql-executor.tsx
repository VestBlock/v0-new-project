"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle, Play, RefreshCw } from "lucide-react"

export function SqlExecutor() {
  const [sql, setSql] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    data?: any
    error?: string
  } | null>(null)

  const executeSql = async () => {
    if (!sql.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || "SQL executed successfully",
          data: data.data,
        })
      } else {
        setResult({
          success: false,
          message: "SQL execution failed",
          error: data.error || "Unknown error",
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: "SQL execution failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Execute SQL</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="Enter SQL to execute..."
          className="font-mono text-sm"
          rows={10}
        />

        {result && (
          <Alert variant={result.success ? "default" : "destructive"} className="mt-4">
            {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{result.success ? result.message : result.error}</AlertDescription>
          </Alert>
        )}

        {result && result.data && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Result:</h3>
            <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-60 border">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={executeSql} disabled={loading || !sql.trim()} className="w-full">
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Execute SQL
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
