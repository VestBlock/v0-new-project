"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock, BarChart } from "lucide-react"

export default function ApiMonitorPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null)
  const [verificationLogs, setVerificationLogs] = useState<any[]>([])
  const [verificationStats, setVerificationStats] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month">("day")

  useEffect(() => {
    loadData()
  }, [timeframe])

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      // Load diagnostics data
      const diagResponse = await fetch("/api/diagnostics")
      if (!diagResponse.ok) {
        throw new Error(`Diagnostics API error: ${diagResponse.status} ${diagResponse.statusText}`)
      }
      const diagData = await diagResponse.json()
      setDiagnosticsData(diagData)

      // Load verification logs
      const logsResponse = await fetch("/api/admin/verification-logs")
      if (!logsResponse.ok) {
        throw new Error(`Logs API error: ${logsResponse.status} ${logsResponse.statusText}`)
      }
      const logsData = await logsResponse.json()
      setVerificationLogs(logsData.logs || [])

      // Load verification stats
      const statsResponse = await fetch(`/api/admin/verification-stats?timeframe=${timeframe}`)
      if (!statsResponse.ok) {
        throw new Error(`Stats API error: ${statsResponse.status} ${statsResponse.statusText}`)
      }
      const statsData = await statsResponse.json()
      setVerificationStats(statsData.stats || null)

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error loading data")
      setLoading(false)
    }
  }

  async function runDiagnostics() {
    setRefreshing(true)

    try {
      const response = await fetch("/api/diagnostics")
      if (!response.ok) {
        throw new Error(`Diagnostics API error: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setDiagnosticsData(data)
      setRefreshing(false)

      // Reload all data
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error running diagnostics")
      setRefreshing(false)
    }
  }

  function getStatusIcon(status: string) {
    if (status === "success") return <CheckCircle className="h-5 w-5 text-green-500" />
    if (status === "error") return <XCircle className="h-5 w-5 text-red-500" />
    if (status === "warning") return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    return <Clock className="h-5 w-5 text-gray-500" />
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">API Monitoring Dashboard</h1>
        <Button onClick={runDiagnostics} disabled={refreshing} className="flex items-center gap-2">
          {refreshing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Diagnostics
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">API Endpoints</TabsTrigger>
          <TabsTrigger value="verification">Verification Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="openai">OpenAI Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* System Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Overall system health</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnosticsData?.overallStatus || "unknown")}
                    <span className="text-lg font-medium">
                      {diagnosticsData?.overallStatus === "success"
                        ? "All Systems Operational"
                        : diagnosticsData?.overallStatus === "error"
                          ? "System Issues Detected"
                          : "Status Unknown"}
                    </span>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <p className="text-sm text-gray-500">
                  Last updated:{" "}
                  {loading ? "Loading..." : new Date(diagnosticsData?.timestamp || Date.now()).toLocaleString()}
                </p>
              </CardFooter>
            </Card>

            {/* OpenAI Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>OpenAI Connection</CardTitle>
                <CardDescription>Real-time OpenAI API status</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(diagnosticsData?.tests?.openai?.status || "unknown")}
                      <span className="text-lg font-medium">
                        {diagnosticsData?.tests?.openai?.status === "success"
                          ? "Connected"
                          : diagnosticsData?.tests?.openai?.status === "error"
                            ? "Connection Error"
                            : "Status Unknown"}
                      </span>
                    </div>
                    <p className="text-sm">
                      {diagnosticsData?.tests?.openai?.message || "No status message available"}
                    </p>
                    {diagnosticsData?.tests?.openai?.latencyMs && (
                      <p className="text-sm">Latency: {diagnosticsData.tests.openai.latencyMs}ms</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mock Data Detection Card */}
            <Card>
              <CardHeader>
                <CardTitle>Mock Data Detection</CardTitle>
                <CardDescription>Analysis of recent API responses</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : verificationStats ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(verificationStats.mockDataPercentage > 20 ? "warning" : "success")}
                      <span className="text-lg font-medium">
                        {verificationStats.mockDataCount} mock responses detected
                      </span>
                    </div>
                    <p className="text-sm">
                      {verificationStats.mockDataPercentage.toFixed(1)}% of responses contain mock data (last{" "}
                      {timeframe})
                    </p>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => setTimeframe("day")}>
                        Day
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setTimeframe("week")} className="ml-2">
                        Week
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setTimeframe("month")} className="ml-2">
                        Month
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm">No verification stats available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint Status</CardTitle>
              <CardDescription>Status of critical API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Health Endpoint */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(diagnosticsData?.tests?.endpoints?.health?.status || "unknown")}
                        <span className="font-medium">/api/health</span>
                      </div>
                      <Badge
                        variant={
                          diagnosticsData?.tests?.endpoints?.health?.status === "success" ? "outline" : "destructive"
                        }
                      >
                        {diagnosticsData?.tests?.endpoints?.health?.statusCode || "Unknown"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Latency: {diagnosticsData?.tests?.endpoints?.health?.latencyMs || "Unknown"}ms
                    </div>
                  </div>

                  {/* Add more endpoints here */}
                  {verificationStats?.endpointDistribution && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">Endpoint Distribution (Last {timeframe})</h3>
                      <div className="space-y-2">
                        {Object.entries(verificationStats.endpointDistribution).map(
                          ([endpoint, count]: [string, any]) => (
                            <div key={endpoint} className="flex justify-between items-center">
                              <span className="text-sm">{endpoint}</span>
                              <Badge variant="outline">{count} requests</Badge>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle>API Verification Logs</CardTitle>
              <CardDescription>Recent API response verification results</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {verificationLogs.length === 0 ? (
                    <p className="text-center py-4 text-gray-500">No verification logs available</p>
                  ) : (
                    verificationLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.is_valid ? "success" : log.is_mock_data ? "warning" : "error")}
                            <span className="font-medium">{log.endpoint}</span>
                          </div>
                          <Badge variant={log.is_mock_data ? "destructive" : log.is_valid ? "outline" : "secondary"}>
                            {log.is_mock_data ? "Mock Data" : log.is_valid ? "Valid" : "Invalid"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          <div>Response Time: {log.response_time_ms}ms</div>
                          <div>Mock Confidence: {log.mock_confidence}%</div>
                          <div>Timestamp: {new Date(log.timestamp).toLocaleString()}</div>
                        </div>
                        {log.issues && log.issues.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">Issues:</p>
                            <ul className="text-sm text-red-500 list-disc list-inside">
                              {log.issues.map((issue: string, i: number) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>API Verification Statistics</CardTitle>
              <CardDescription>Analytics for API verification over the last {timeframe}</CardDescription>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={timeframe === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe("day")}
                >
                  Day
                </Button>
                <Button
                  variant={timeframe === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe("week")}
                >
                  Week
                </Button>
                <Button
                  variant={timeframe === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe("month")}
                >
                  Month
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !verificationStats ? (
                <p className="text-center py-4 text-gray-500">No statistics available</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-gray-500">Total Requests</div>
                      <div className="text-2xl font-bold">{verificationStats.totalRequests}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-gray-500">Mock Data Detected</div>
                      <div className="text-2xl font-bold">{verificationStats.mockDataCount}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-gray-500">Mock Data Percentage</div>
                      <div className="text-2xl font-bold">{verificationStats.mockDataPercentage.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <BarChart className="h-5 w-5" />
                      Endpoint Distribution
                    </h3>
                    <div className="border rounded-lg p-4">
                      {Object.entries(verificationStats.endpointDistribution).length === 0 ? (
                        <p className="text-center py-4 text-gray-500">No endpoint data available</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(verificationStats.endpointDistribution).map(
                            ([endpoint, count]: [string, any]) => {
                              const percentage = (count / verificationStats.totalRequests) * 100
                              return (
                                <div key={endpoint}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium">{endpoint}</span>
                                    <span className="text-sm text-gray-500">
                                      {count} ({percentage.toFixed(1)}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                      className="bg-blue-600 h-2.5 rounded-full"
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openai">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI Integration Status</CardTitle>
              <CardDescription>Detailed OpenAI API connection information</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Connection Status */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">Connection Status</h3>
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(diagnosticsData?.tests?.openai?.status || "unknown")}
                        <span>
                          {diagnosticsData?.tests?.openai?.status === "success"
                            ? "Connected"
                            : diagnosticsData?.tests?.openai?.status === "error"
                              ? "Connection Error"
                              : "Status Unknown"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {diagnosticsData?.tests?.openai?.message || "No status message available"}
                      </p>
                    </div>

                    {/* Performance Metrics */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">Performance Metrics</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Latency:</span>
                          <span className="text-sm font-medium">
                            {diagnosticsData?.tests?.openai?.latencyMs || "Unknown"}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">API Key Status:</span>
                          <span className="text-sm font-medium">
                            {process.env.OPENAI_API_KEY ? "Configured" : "Not Configured"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent API Calls */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Recent OpenAI API Calls</h3>
                    {verificationLogs.filter(
                      (log) =>
                        log.endpoint.includes("openai") ||
                        log.endpoint.includes("analyze") ||
                        log.endpoint.includes("chat"),
                    ).length > 0 ? (
                      <div className="space-y-2">
                        {verificationLogs
                          .filter(
                            (log) =>
                              log.endpoint.includes("openai") ||
                              log.endpoint.includes("analyze") ||
                              log.endpoint.includes("chat"),
                          )
                          .slice(0, 5)
                          .map((log) => (
                            <div key={log.id} className="text-sm border-b pb-2">
                              <div className="flex justify-between">
                                <span>{log.endpoint}</span>
                                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {getStatusIcon(log.is_mock_data ? "warning" : log.is_valid ? "success" : "error")}
                                <span
                                  className={
                                    log.is_mock_data
                                      ? "text-yellow-600"
                                      : log.is_valid
                                        ? "text-green-600"
                                        : "text-red-600"
                                  }
                                >
                                  {log.is_mock_data
                                    ? "Mock Data"
                                    : log.is_valid
                                      ? "Valid Response"
                                      : "Invalid Response"}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No recent OpenAI API calls found in logs.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
