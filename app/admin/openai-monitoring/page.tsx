"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, BarChart3, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase-client"
import { checkOpenAIConnectivity } from "@/lib/openai-client"

// Types for OpenAI logs
interface OpenAILog {
  id: string
  request_id: string
  user_id: string | null
  model: string
  prompt_length: number
  success: boolean
  error_type: string | null
  error_message: string | null
  response_length: number | null
  latency_ms: number | null
  retry_count: number | null
  timestamp: string
  created_at: string
}

// Types for stats
interface OpenAIStats {
  totalRequests: number
  successRate: number
  averageLatency: number
  errorsByType: Record<string, number>
  requestsByModel: Record<string, number>
  requestsOverTime: Array<{ date: string; count: number; success: number; failed: number }>
}

export default function OpenAIMonitoringPage() {
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false)
  const [connectivityResult, setConnectivityResult] = useState<{
    success?: boolean
    message?: string
    error?: string
    latencyMs?: number
    apiKeyValid?: boolean
    apiKeyPrefix?: string
  } | null>(null)

  const [logs, setLogs] = useState<OpenAILog[]>([])
  const [stats, setStats] = useState<OpenAIStats | null>(null)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const { toast } = useToast()

  // Check OpenAI connectivity
  const checkConnectivity = async () => {
    setIsCheckingConnectivity(true)
    setConnectivityResult(null)

    try {
      const result = await checkOpenAIConnectivity()
      setConnectivityResult(result)

      if (result.success) {
        toast({
          title: "Success",
          description: "OpenAI API is accessible and working correctly",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message || "OpenAI API is not working",
        })
      }
    } catch (error) {
      console.error("Error checking OpenAI connectivity:", error)
      setConnectivityResult({
        success: false,
        message: "Error checking OpenAI API",
        error: error instanceof Error ? error.message : "Unknown error",
      })

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to check OpenAI API connectivity",
      })
    } finally {
      setIsCheckingConnectivity(false)
    }
  }

  // Fetch OpenAI logs
  const fetchLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const { data, error } = await supabase
        .from("openai_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100)

      if (error) {
        throw error
      }

      setLogs(data || [])
    } catch (error) {
      console.error("Error fetching OpenAI logs:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch OpenAI logs",
      })
    } finally {
      setIsLoadingLogs(false)
    }
  }

  // Calculate OpenAI stats
  const calculateStats = async () => {
    setIsLoadingStats(true)
    try {
      // Fetch all logs for stats calculation
      const { data, error } = await supabase.from("openai_logs").select("*").order("timestamp", { ascending: false })

      if (error) {
        throw error
      }

      const logs = data || []

      // Calculate basic stats
      const totalRequests = logs.length
      const successfulRequests = logs.filter((log) => log.success).length
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0

      // Calculate average latency
      const validLatencies = logs.filter((log) => log.latency_ms !== null).map((log) => log.latency_ms as number)
      const averageLatency =
        validLatencies.length > 0
          ? validLatencies.reduce((sum, latency) => sum + latency, 0) / validLatencies.length
          : 0

      // Count errors by type
      const errorsByType: Record<string, number> = {}
      logs
        .filter((log) => !log.success && log.error_type)
        .forEach((log) => {
          const errorType = log.error_type || "unknown"
          errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
        })

      // Count requests by model
      const requestsByModel: Record<string, number> = {}
      logs.forEach((log) => {
        const model = log.model || "unknown"
        requestsByModel[model] = (requestsByModel[model] || 0) + 1
      })

      // Group requests by day for time series
      const requestsByDay: Record<string, { total: number; success: number; failed: number }> = {}
      logs.forEach((log) => {
        const date = new Date(log.timestamp).toISOString().split("T")[0]
        if (!requestsByDay[date]) {
          requestsByDay[date] = { total: 0, success: 0, failed: 0 }
        }
        requestsByDay[date].total++
        if (log.success) {
          requestsByDay[date].success++
        } else {
          requestsByDay[date].failed++
        }
      })

      // Convert to array and sort by date
      const requestsOverTime = Object.entries(requestsByDay)
        .map(([date, counts]) => ({
          date,
          count: counts.total,
          success: counts.success,
          failed: counts.failed,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setStats({
        totalRequests,
        successRate,
        averageLatency,
        errorsByType,
        requestsByModel,
        requestsOverTime,
      })
    } catch (error) {
      console.error("Error calculating OpenAI stats:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to calculate OpenAI statistics",
      })
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Load data on initial render
  useEffect(() => {
    checkConnectivity()
    fetchLogs()
    calculateStats()
  }, [])

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  // Get status badge color
  const getStatusBadge = (success: boolean, errorType: string | null) => {
    if (success) {
      return <Badge className="bg-green-500">Success</Badge>
    }

    switch (errorType) {
      case "authentication":
        return <Badge variant="destructive">Auth Error</Badge>
      case "rate_limit":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            Rate Limited
          </Badge>
        )
      case "quota_exceeded":
        return <Badge variant="destructive">Quota Exceeded</Badge>
      case "timeout":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            Timeout
          </Badge>
        )
      case "server":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            Server Error
          </Badge>
        )
      case "connection":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            Connection Error
          </Badge>
        )
      default:
        return <Badge variant="destructive">Error</Badge>
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">OpenAI API Monitoring</h1>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList>
          <TabsTrigger value="status">API Status</TabsTrigger>
          <TabsTrigger value="logs">Request Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI API Status</CardTitle>
              <CardDescription>Check if the OpenAI API is accessible and working correctly</CardDescription>
            </CardHeader>
            <CardContent>
              {isCheckingConnectivity ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <p>Checking OpenAI API connectivity...</p>
                </div>
              ) : connectivityResult ? (
                <div className="space-y-4">
                  <div className="flex items-center">
                    {connectivityResult.success ? (
                      <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500 mr-2" />
                    )}
                    <span className="text-lg font-medium">
                      {connectivityResult.success ? "API is working" : "API is not working"}
                    </span>
                  </div>

                  <div className="rounded-md bg-muted p-4">
                    <p className="font-medium">Status:</p>
                    <p className="text-sm">{connectivityResult.message}</p>

                    {connectivityResult.latencyMs !== undefined && (
                      <div className="mt-2">
                        <p className="font-medium">Latency:</p>
                        <p className="text-sm">{connectivityResult.latencyMs}ms</p>
                      </div>
                    )}

                    {connectivityResult.apiKeyPrefix && (
                      <div className="mt-2">
                        <p className="font-medium">API Key:</p>
                        <p className="text-sm">{connectivityResult.apiKeyPrefix}</p>
                      </div>
                    )}

                    {connectivityResult.error && (
                      <div className="mt-2">
                        <p className="font-medium">Error:</p>
                        <p className="text-sm text-red-500">{connectivityResult.error}</p>
                      </div>
                    )}
                  </div>

                  {!connectivityResult.success && (
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
              <Button onClick={checkConnectivity} disabled={isCheckingConnectivity} className="w-full">
                {isCheckingConnectivity ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check API Status
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>OpenAI API Request Logs</CardTitle>
                <CardDescription>Recent API requests and their status</CardDescription>
              </div>
              <Button variant="outline" onClick={fetchLogs} disabled={isLoadingLogs}>
                {isLoadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <p>Loading logs...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>Retries</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                          <TableCell>{log.model}</TableCell>
                          <TableCell>{getStatusBadge(log.success, log.error_type)}</TableCell>
                          <TableCell>{log.latency_ms ? `${log.latency_ms}ms` : "N/A"}</TableCell>
                          <TableCell>{log.retry_count || 0}</TableCell>
                          <TableCell className="max-w-xs truncate" title={log.error_message || ""}>
                            {log.error_message || "None"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No logs available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>OpenAI API Statistics</CardTitle>
                <CardDescription>Usage statistics and performance metrics</CardDescription>
              </div>
              <Button variant="outline" onClick={calculateStats} disabled={isLoadingStats}>
                {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <p>Calculating statistics...</p>
                </div>
              ) : stats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <BarChart3 className="h-5 w-5 text-muted-foreground mr-2" />
                          <span className="text-2xl font-bold">{stats.totalRequests}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-muted-foreground mr-2" />
                          <span className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <Clock className="h-5 w-5 text-muted-foreground mr-2" />
                          <span className="text-2xl font-bold">{stats.averageLatency.toFixed(0)}ms</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Errors by Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.keys(stats.errorsByType).length > 0 ? (
                          <ul className="space-y-2">
                            {Object.entries(stats.errorsByType).map(([type, count]) => (
                              <li key={type} className="flex justify-between items-center">
                                <span className="text-sm">{type}</span>
                                <Badge variant="outline">{count}</Badge>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No errors recorded</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Requests by Model</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.keys(stats.requestsByModel).length > 0 ? (
                          <ul className="space-y-2">
                            {Object.entries(stats.requestsByModel).map(([model, count]) => (
                              <li key={model} className="flex justify-between items-center">
                                <span className="text-sm">{model}</span>
                                <Badge variant="outline">{count}</Badge>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No model data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Requests Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stats.requestsOverTime.length > 0 ? (
                        <div className="h-[200px] w-full">
                          {/* Simple visualization of requests over time */}
                          <div className="flex h-full items-end space-x-2">
                            {stats.requestsOverTime.map((day) => {
                              const maxHeight = 180
                              const maxCount = Math.max(...stats.requestsOverTime.map((d) => d.count))
                              const height = day.count > 0 ? (day.count / maxCount) * maxHeight : 0

                              return (
                                <div key={day.date} className="flex flex-col items-center flex-1">
                                  <div className="w-full flex flex-col items-center">
                                    <div className="w-full bg-primary/20 rounded-t" style={{ height: `${height}px` }}>
                                      <div
                                        className="w-full bg-red-500/50 rounded-t"
                                        style={{ height: `${(day.failed / day.count) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <span className="text-xs mt-2 rotate-45 origin-left">
                                    {day.date.split("-").slice(1).join("/")}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No time series data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No statistics available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
