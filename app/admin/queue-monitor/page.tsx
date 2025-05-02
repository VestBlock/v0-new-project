"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { ProcessingStatus } from "@/lib/openai-service"

interface QueueItem {
  id: string
  analysis_id: string
  user_id: string
  status: ProcessingStatus
  priority: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string | null
  attempts: number
  max_attempts: number
  metadata: any
}

interface QueueStats {
  totalItems: number
  byStatus: Record<string, number>
  avgProcessingTime: number
  successRate: number
}

export default function QueueMonitorPage() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const { toast } = useToast()

  // Fetch queue items
  const fetchQueueItems = async () => {
    setIsLoadingItems(true)
    try {
      const { data, error } = await supabase
        .from("openai_processing_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        throw error
      }

      setQueueItems(data || [])
    } catch (error) {
      console.error("Error fetching queue items:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch queue items",
      })
    } finally {
      setIsLoadingItems(false)
    }
  }

  // Calculate queue stats
  const calculateStats = async () => {
    setIsLoadingStats(true)
    try {
      // Fetch all queue items for stats calculation
      const { data, error } = await supabase
        .from("openai_processing_queue")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      const items = data || []

      // Count items by status
      const byStatus: Record<string, number> = {}
      items.forEach((item) => {
        byStatus[item.status] = (byStatus[item.status] || 0) + 1
      })

      // Calculate average processing time for completed items
      const completedItems = items.filter(
        (item) => item.status === ProcessingStatus.COMPLETED && item.started_at && item.completed_at,
      )

      let avgProcessingTime = 0
      if (completedItems.length > 0) {
        const totalProcessingTime = completedItems.reduce((sum, item) => {
          const startTime = new Date(item.started_at!).getTime()
          const endTime = new Date(item.completed_at!).getTime()
          return sum + (endTime - startTime)
        }, 0)
        avgProcessingTime = totalProcessingTime / completedItems.length / 1000 // in seconds
      }

      // Calculate success rate
      const totalCompleted = items.filter(
        (item) => item.status === ProcessingStatus.COMPLETED || item.status === ProcessingStatus.FAILED,
      ).length

      const successfullyCompleted = items.filter((item) => item.status === ProcessingStatus.COMPLETED).length

      const successRate = totalCompleted > 0 ? (successfullyCompleted / totalCompleted) * 100 : 0

      setQueueStats({
        totalItems: items.length,
        byStatus,
        avgProcessingTime,
        successRate,
      })
    } catch (error) {
      console.error("Error calculating queue stats:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to calculate queue statistics",
      })
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Load data on initial render
  useEffect(() => {
    fetchQueueItems()
    calculateStats()
  }, [])

  // Format timestamp
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "N/A"
    return new Date(timestamp).toLocaleString()
  }

  // Format duration
  const formatDuration = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return "N/A"

    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    const durationMs = end - start

    if (durationMs < 1000) {
      return `${durationMs}ms`
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(1)}s`
    } else {
      return `${(durationMs / 60000).toFixed(1)}m`
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case ProcessingStatus.QUEUED:
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            Queued
          </Badge>
        )
      case ProcessingStatus.PROCESSING:
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            Processing
          </Badge>
        )
      case ProcessingStatus.CHUNKING:
        return (
          <Badge variant="outline" className="border-purple-500 text-purple-500">
            Chunking
          </Badge>
        )
      case ProcessingStatus.ANALYZING:
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-500">
            Analyzing
          </Badge>
        )
      case ProcessingStatus.MERGING:
        return (
          <Badge variant="outline" className="border-indigo-500 text-indigo-500">
            Merging
          </Badge>
        )
      case ProcessingStatus.COMPLETED:
        return <Badge className="bg-green-500">Completed</Badge>
      case ProcessingStatus.FAILED:
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Retry a failed queue item
  const retryQueueItem = async (id: string) => {
    try {
      await supabase
        .from("openai_processing_queue")
        .update({
          status: ProcessingStatus.QUEUED,
          error: null,
          attempts: 0,
        })
        .eq("id", id)

      toast({
        title: "Success",
        description: "Queue item has been requeued for processing",
      })

      // Refresh the list
      fetchQueueItems()
    } catch (error) {
      console.error("Error retrying queue item:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to retry queue item",
      })
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">OpenAI Processing Queue Monitor</h1>

      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="queue">Queue Items</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Processing Queue</CardTitle>
                <CardDescription>Recent queue items and their status</CardDescription>
              </div>
              <Button variant="outline" onClick={fetchQueueItems} disabled={isLoadingItems}>
                {isLoadingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <p>Loading queue items...</p>
                </div>
              ) : queueItems.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Analysis ID</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queueItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatTimestamp(item.created_at)}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="font-mono text-xs">{item.analysis_id}</TableCell>
                          <TableCell>{formatDuration(item.started_at, item.completed_at)}</TableCell>
                          <TableCell>{`${item.attempts}/${item.max_attempts}`}</TableCell>
                          <TableCell className="max-w-xs truncate" title={item.error || ""}>
                            {item.error || "None"}
                          </TableCell>
                          <TableCell>
                            {item.status === ProcessingStatus.FAILED && (
                              <Button variant="outline" size="sm" onClick={() => retryQueueItem(item.id)}>
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No queue items available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Queue Statistics</CardTitle>
                <CardDescription>Performance metrics and status distribution</CardDescription>
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
              ) : queueStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <span className="text-2xl font-bold">{queueStats.totalItems}</span>
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
                          <span className="text-2xl font-bold">{queueStats.successRate.toFixed(1)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <Clock className="h-5 w-5 text-muted-foreground mr-2" />
                          <span className="text-2xl font-bold">
                            {queueStats.avgProcessingTime < 60
                              ? `${queueStats.avgProcessingTime.toFixed(1)}s`
                              : `${(queueStats.avgProcessingTime / 60).toFixed(1)}m`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Items by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(queueStats.byStatus).length > 0 ? (
                        <div className="space-y-4">
                          {Object.entries(queueStats.byStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <div className="flex items-center">
                                {status === ProcessingStatus.COMPLETED ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                ) : status === ProcessingStatus.FAILED ? (
                                  <XCircle className="h-4 w-4 text-red-500 mr-2" />
                                ) : status === ProcessingStatus.PROCESSING ? (
                                  <Loader2 className="h-4 w-4 text-yellow-500 animate-spin mr-2" />
                                ) : status === ProcessingStatus.QUEUED ? (
                                  <Clock className="h-4 w-4 text-blue-500 mr-2" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                                )}
                                <span>{status}</span>
                              </div>
                              <Badge variant="outline">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No status data available</p>
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
