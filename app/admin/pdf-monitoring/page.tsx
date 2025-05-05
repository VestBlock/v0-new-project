"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, FileText, Clock, AlertTriangle, CheckCircle, BarChart4 } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Bar,
  BarChart,
} from "recharts"

export default function PDFMonitoringPage() {
  const [metrics, setMetrics] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30) // Default to 30 days

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        // Get date range
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - timeRange)
        const startDateStr = startDate.toISOString()

        // Fetch metrics
        const { data: metricsData, error: metricsError } = await supabase
          .from("pdf_processing_metrics")
          .select("*")
          .gte("timestamp", startDateStr)
          .order("timestamp", { ascending: false })
          .limit(100)

        if (metricsError) throw metricsError
        setMetrics(metricsData || [])

        // Fetch logs
        const { data: logsData, error: logsError } = await supabase
          .from("pdf_processing_logs")
          .select("*")
          .gte("timestamp", startDateStr)
          .eq("event", "processing_error")
          .order("timestamp", { ascending: false })
          .limit(50)

        if (logsError) throw logsError
        setLogs(logsData || [])

        // Calculate statistics
        if (metricsData) {
          const totalProcessed = metricsData.length
          const successfulProcessed = metricsData.filter(
            (m) => m.extraction_time_ms > 0 && m.analysis_time_ms > 0,
          ).length
          const successRate = totalProcessed > 0 ? (successfulProcessed / totalProcessed) * 100 : 0

          const avgExtractionTime =
            metricsData.reduce((sum, m) => sum + (m.extraction_time_ms || 0), 0) / (successfulProcessed || 1)
          const avgAnalysisTime =
            metricsData.reduce((sum, m) => sum + (m.analysis_time_ms || 0), 0) / (successfulProcessed || 1)
          const avgTotalTime =
            metricsData.reduce((sum, m) => sum + (m.total_time_ms || 0), 0) / (successfulProcessed || 1)

          const avgFileSize = metricsData.reduce((sum, m) => sum + (m.file_size_bytes || 0), 0) / (totalProcessed || 1)
          const avgTextLength =
            metricsData.reduce((sum, m) => sum + (m.text_length || 0), 0) / (successfulProcessed || 1)

          // Process by day
          const processingByDay: Record<string, { count: number; avgTime: number }> = {}
          metricsData.forEach((m) => {
            const date = new Date(m.timestamp).toISOString().split("T")[0]
            if (!processingByDay[date]) {
              processingByDay[date] = { count: 0, avgTime: 0 }
            }
            processingByDay[date].count++
            processingByDay[date].avgTime += m.total_time_ms || 0
          })

          // Calculate average time per day
          Object.keys(processingByDay).forEach((date) => {
            processingByDay[date].avgTime = processingByDay[date].avgTime / processingByDay[date].count
          })

          // Convert to array for chart
          const processingByDayArray = Object.entries(processingByDay)
            .map(([date, data]) => ({
              date,
              count: data.count,
              avgTime: data.avgTime / 1000, // Convert to seconds
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

          setStats({
            totalProcessed,
            successRate,
            avgExtractionTime,
            avgAnalysisTime,
            avgTotalTime,
            avgFileSize,
            avgTextLength,
            processingByDay: processingByDayArray,
          })
        }
      } catch (error) {
        console.error("Error loading PDF monitoring data:", error)
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
          <p className="mt-4 text-lg">Loading PDF processing data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">PDF Processing Monitor</h1>

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
                <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <FileText className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="text-2xl font-bold">{stats.totalProcessed}</span>
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
                <CardTitle className="text-sm font-medium">Avg. Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="text-2xl font-bold">{(stats.avgTotalTime / 1000).toFixed(1)}s</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. File Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <BarChart4 className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="text-2xl font-bold">{(stats.avgFileSize / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Processing Volume</CardTitle>
                <CardDescription>Daily processing volume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.processingByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="PDFs Processed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Time</CardTitle>
                <CardDescription>Average processing time (seconds)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.processingByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgTime" stroke="#82ca9d" name="Avg. Time (s)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Processing Errors</CardTitle>
                <CardDescription>Last 50 error events</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                            <TableCell>{log.file_name || "Unknown"}</TableCell>
                            <TableCell className="max-w-xs truncate">{log.error_message || "Unknown error"}</TableCell>
                            <TableCell className="max-w-xs truncate">{log.details || "No details"}</TableCell>
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
                <CardTitle>Recent Processing Metrics</CardTitle>
                <CardDescription>Last 100 processed files</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Extraction</TableHead>
                          <TableHead>Analysis</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Text Length</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.map((metric) => (
                          <TableRow key={metric.id}>
                            <TableCell>{new Date(metric.timestamp).toLocaleString()}</TableCell>
                            <TableCell className="max-w-xs truncate">{metric.file_name || "Unknown"}</TableCell>
                            <TableCell>
                              {metric.file_size_bytes
                                ? `${(metric.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {metric.extraction_time_ms ? `${(metric.extraction_time_ms / 1000).toFixed(1)}s` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {metric.analysis_time_ms ? `${(metric.analysis_time_ms / 1000).toFixed(1)}s` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {metric.total_time_ms ? `${(metric.total_time_ms / 1000).toFixed(1)}s` : "N/A"}
                            </TableCell>
                            <TableCell>{metric.text_length ? `${metric.text_length} chars` : "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mb-2" />
                    <p>No processing metrics available</p>
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
