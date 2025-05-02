"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, BarChart } from "lucide-react"
import { getOpenAIStats, getRecentOpenAIErrors, getOpenAIUsageByUser } from "@/lib/openai-monitor"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export default function OpenAIPerformancePage() {
  const [stats, setStats] = useState<any>(null)
  const [errors, setErrors] = useState<any[]>([])
  const [userUsage, setUserUsage] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30) // Default to 30 days

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [statsData, errorsData, usageData] = await Promise.all([
          getOpenAIStats(timeRange),
          getRecentOpenAIErrors(20),
          getOpenAIUsageByUser(timeRange),
        ])

        setStats(statsData)
        setErrors(errorsData)
        setUserUsage(usageData)
      } catch (error) {
        console.error("Error loading OpenAI monitoring data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [timeRange])

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Loading OpenAI performance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">OpenAI Integration Performance</h1>

      <div className="mb-6">
        <Tabs defaultValue="30" onValueChange={(value) => setTimeRange(Number.parseInt(value))}>
          <TabsList>
            <TabsTrigger value="7">Last 7 Days</TabsTrigger>
            <TabsTrigger value="30">Last 30 Days</TabsTrigger>
            <TabsTrigger value="90">Last 90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <BarChart className="h-4 w-4 text-muted-foreground mr-2" />
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
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="text-2xl font-bold">{(stats.averageLatency / 1000).toFixed(1)}s</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Est. Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="text-2xl font-bold">${stats.costEstimate.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Requests Over Time</CardTitle>
                <CardDescription>Daily request volume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ChartContainer
                    config={{
                      requests: {
                        label: "Requests",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.requestsPerDay}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="count" stroke="var(--color-requests)" name="Requests" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Breakdown</CardTitle>
                <CardDescription>Types of errors encountered</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.errorBreakdown).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(stats.errorBreakdown).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                          <span className="capitalize">{type.replace(/_/g, " ")}</span>
                        </div>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mb-2" />
                    <p>No errors in this time period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Last 20 error events</CardDescription>
              </CardHeader>
              <CardContent>
                {errors.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Error Type</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>Model</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errors.map((error) => (
                          <TableRow key={error.id}>
                            <TableCell>{new Date(error.timestamp).toLocaleString()}</TableCell>
                            <TableCell>
                              <span className="capitalize">{error.error_type?.replace(/_/g, " ") || "Unknown"}</span>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{error.error_message || "No message"}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {error.user_id?.substring(0, 8) || "N/A"}...
                            </TableCell>
                            <TableCell>{error.model || "Unknown"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mb-2" />
                    <p>No errors in this time period</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Usage</CardTitle>
                <CardDescription>OpenAI usage by user</CardDescription>
              </CardHeader>
              <CardContent>
                {userUsage.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Request Count</TableHead>
                          <TableHead>Success Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userUsage.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-mono text-xs">
                              {user.user_id?.substring(0, 8) || "N/A"}...
                            </TableCell>
                            <TableCell>{user.request_count}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                {user.success_rate >= 90 ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                ) : user.success_rate >= 70 ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500 mr-2" />
                                )}
                                {user.success_rate.toFixed(1)}%
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mb-2" />
                    <p>No usage data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
