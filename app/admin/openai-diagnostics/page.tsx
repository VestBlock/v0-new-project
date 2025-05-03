"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock, Key, MessageSquare, Database, Zap } from "lucide-react"

export default function OpenAIDiagnosticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null)
  const [chatResults, setChatResults] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [analysisId, setAnalysisId] = useState("")
  const [testChat, setTestChat] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      // Load diagnostics data
      const response = await fetch(`/api/admin/openai-diagnostics?testChat=${testChat}&analysisId=${analysisId}`)
      if (!response.ok) {
        throw new Error(`Diagnostics API error: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setDiagnosticsData(data.diagnostics)
      setChatResults(data.chat)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error loading data")
      setLoading(false)
    }
  }

  async function runDiagnostics() {
    setRefreshing(true)

    try {
      const response = await fetch(`/api/admin/openai-diagnostics?testChat=${testChat}&analysisId=${analysisId}`)
      if (!response.ok) {
        throw new Error(`Diagnostics API error: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setDiagnosticsData(data.diagnostics)
      setChatResults(data.chat)
      setRefreshing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error running diagnostics")
      setRefreshing(false)
    }
  }

  function getStatusIcon(status: string) {
    if (status === "success" || status === "healthy") return <CheckCircle className="h-5 w-5 text-green-500" />
    if (status === "error" || status === "critical") return <XCircle className="h-5 w-5 text-red-500" />
    if (status === "warning") return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    return <Clock className="h-5 w-5 text-gray-500" />
  }

  function getStatusColor(status: string) {
    if (status === "success" || status === "healthy") return "text-green-500"
    if (status === "error" || status === "critical") return "text-red-500"
    if (status === "warning") return "text-yellow-500"
    return "text-gray-500"
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">OpenAI Integration Diagnostics</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Analysis ID (optional)"
              value={analysisId}
              onChange={(e) => setAnalysisId(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" onClick={() => setTestChat(!testChat)} className={testChat ? "bg-blue-100" : ""}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {testChat ? "Testing Chat" : "Test Chat"}
            </Button>
          </div>
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
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="mock-data">Mock Data</TabsTrigger>
          <TabsTrigger value="chat">Chat Functionality</TabsTrigger>
          <TabsTrigger value="api-calls">Recent API Calls</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Overall Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Status</CardTitle>
                <CardDescription>OpenAI integration health</CardDescription>
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
                    <span
                      className={`text-lg font-medium ${getStatusColor(diagnosticsData?.overallStatus || "unknown")}`}
                    >
                      {diagnosticsData?.overallStatus === "healthy"
                        ? "Healthy"
                        : diagnosticsData?.overallStatus === "warning"
                          ? "Warning"
                          : diagnosticsData?.overallStatus === "error"
                            ? "Error"
                            : diagnosticsData?.overallStatus === "critical"
                              ? "Critical"
                              : "Unknown"}
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

            {/* API Key Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Key Status
                </CardTitle>
                <CardDescription>OpenAI API key configuration</CardDescription>
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
                      {diagnosticsData?.apiKeyConfigured ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-lg font-medium">
                        {diagnosticsData?.apiKeyConfigured ? "API Key Configured" : "API Key Missing"}
                      </span>
                    </div>
                    {!diagnosticsData?.apiKeyConfigured && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTitle>Critical Issue</AlertTitle>
                        <AlertDescription>
                          The OpenAI API key is not configured. This will prevent all OpenAI functionality from working.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connection Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Connection Status
                </CardTitle>
                <CardDescription>OpenAI API connectivity</CardDescription>
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
                      {getStatusIcon(diagnosticsData?.directConnection?.success ? "success" : "error")}
                      <span className="text-lg font-medium">
                        {diagnosticsData?.directConnection?.success ? "Connected" : "Connection Failed"}
                      </span>
                    </div>
                    <p className="text-sm">
                      {diagnosticsData?.directConnection?.message || "No status message available"}
                    </p>
                    {diagnosticsData?.directConnection?.latencyMs && (
                      <p className="text-sm">Latency: {diagnosticsData.directConnection.latencyMs}ms</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mock Data Detection Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Mock Data Detection
              </CardTitle>
              <CardDescription>Analysis of recent credit analyses</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : !diagnosticsData?.mockDataDetection?.success ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {diagnosticsData?.mockDataDetection?.message || "Failed to analyze mock data"}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(
                      diagnosticsData.mockDataDetection.suspiciousPercentage > 50
                        ? "warning"
                        : diagnosticsData.mockDataDetection.suspiciousPercentage > 0
                          ? "warning"
                          : "success",
                    )}
                    <span className="text-lg font-medium">
                      {diagnosticsData.mockDataDetection.suspiciousCount} of{" "}
                      {diagnosticsData.mockDataDetection.totalAnalyzed} analyses contain potential mock data
                    </span>
                  </div>

                  {diagnosticsData.mockDataDetection.suspiciousPercentage > 0 && (
                    <Alert
                      variant={diagnosticsData.mockDataDetection.suspiciousPercentage > 50 ? "destructive" : "warning"}
                    >
                      <AlertTitle>
                        {diagnosticsData.mockDataDetection.suspiciousPercentage > 50
                          ? "Critical Issue"
                          : "Potential Issue"}
                      </AlertTitle>
                      <AlertDescription>
                        {diagnosticsData.mockDataDetection.suspiciousPercentage.toFixed(1)}% of recent analyses appear
                        to contain mock data. This suggests that the OpenAI integration may not be working correctly.
                      </AlertDescription>
                    </Alert>
                  )}

                  {diagnosticsData.mockDataDetection.suspiciousIds.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Suspicious Analysis IDs:</h3>
                      <div className="flex flex-wrap gap-2">
                        {diagnosticsData.mockDataDetection.suspiciousIds.map((id: string) => (
                          <Badge key={id} variant="outline">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Functionality Summary */}
          {chatResults && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Chat Functionality
                </CardTitle>
                <CardDescription>Status of the chat feature</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(chatResults.overallStatus)}
                      <span className={`text-lg font-medium ${getStatusColor(chatResults.overallStatus)}`}>
                        {chatResults.overallStatus === "healthy"
                          ? "Chat Functionality Working"
                          : chatResults.overallStatus === "warning"
                            ? "Chat Functionality Issues"
                            : chatResults.overallStatus === "error"
                              ? "Chat Functionality Broken"
                              : "Unknown Status"}
                      </span>
                    </div>

                    {chatResults.overallStatus !== "healthy" && (
                      <Alert variant={chatResults.overallStatus === "error" ? "destructive" : "warning"}>
                        <AlertTitle>
                          {chatResults.overallStatus === "error" ? "Critical Issue" : "Potential Issue"}
                        </AlertTitle>
                        <AlertDescription>
                          {chatResults.chatEndpoint?.message || "Chat functionality is not working correctly."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {chatResults.chatMessages && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">Chat Messages:</h3>
                        <p className="text-sm">
                          {chatResults.chatMessages.success
                            ? `Found ${chatResults.chatMessages.messageCount} messages for the specified analysis.`
                            : "Failed to retrieve chat messages."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="connection">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct Connection Card */}
            <Card>
              <CardHeader>
                <CardTitle>Direct Connection</CardTitle>
                <CardDescription>OpenAI API direct connection test</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(diagnosticsData?.directConnection?.success ? "success" : "error")}
                      <span className="text-lg font-medium">
                        {diagnosticsData?.directConnection?.success ? "Connected" : "Connection Failed"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        <span className="text-sm">
                          {diagnosticsData?.directConnection?.success ? "Success" : "Failed"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Message:</span>
                        <span className="text-sm">{diagnosticsData?.directConnection?.message || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Latency:</span>
                        <span className="text-sm">
                          {diagnosticsData?.directConnection?.latencyMs
                            ? `${diagnosticsData.directConnection.latencyMs}ms`
                            : "N/A"}
                        </span>
                      </div>
                      {diagnosticsData?.directConnection?.apiKeyValid !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">API Key Valid:</span>
                          <span className="text-sm">{diagnosticsData.directConnection.apiKeyValid ? "Yes" : "No"}</span>
                        </div>
                      )}
                    </div>

                    {!diagnosticsData?.directConnection?.success && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTitle>Connection Error</AlertTitle>
                        <AlertDescription>
                          {diagnosticsData?.directConnection?.error || "Failed to connect to OpenAI API"}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Library Card */}
            <Card>
              <CardHeader>
                <CardTitle>Client Library</CardTitle>
                <CardDescription>OpenAI client library test</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(diagnosticsData?.clientLibrary?.success ? "success" : "error")}
                      <span className="text-lg font-medium">
                        {diagnosticsData?.clientLibrary?.success ? "Working" : "Not Working"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        <span className="text-sm">
                          {diagnosticsData?.clientLibrary?.success ? "Success" : "Failed"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Message:</span>
                        <span className="text-sm">{diagnosticsData?.clientLibrary?.message || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Latency:</span>
                        <span className="text-sm">
                          {diagnosticsData?.clientLibrary?.latencyMs
                            ? `${diagnosticsData.clientLibrary.latencyMs}ms`
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {diagnosticsData?.clientLibrary?.success && diagnosticsData?.clientLibrary?.response && (
                      <div className="mt-2 p-3 bg-gray-100 rounded-md">
                        <p className="text-sm font-medium mb-1">Response:</p>
                        <p className="text-sm">{diagnosticsData.clientLibrary.response}</p>
                      </div>
                    )}

                    {!diagnosticsData?.clientLibrary?.success && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTitle>Client Library Error</AlertTitle>
                        <AlertDescription>
                          {diagnosticsData?.clientLibrary?.message || "Failed to use OpenAI client library"}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mock-data">
          <Card>
            <CardHeader>
              <CardTitle>Mock Data Detection</CardTitle>
              <CardDescription>Analysis of recent credit analyses for mock data</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !diagnosticsData?.mockDataDetection?.success ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {diagnosticsData?.mockDataDetection?.message || "Failed to analyze mock data"}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-gray-500">Total Analyses</div>
                      <div className="text-2xl font-bold">{diagnosticsData.mockDataDetection.totalAnalyzed}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-gray-500">Suspicious Analyses</div>
                      <div className="text-2xl font-bold">{diagnosticsData.mockDataDetection.suspiciousCount}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-gray-500">Suspicious Percentage</div>
                      <div className="text-2xl font-bold">
                        {diagnosticsData.mockDataDetection.suspiciousPercentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {diagnosticsData.mockDataDetection.suspiciousIds.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Suspicious Analysis IDs</h3>
                      <div className="border rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {diagnosticsData.mockDataDetection.suspiciousIds.map((id: string) => (
                            <div key={id} className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{id}</code>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <Alert
                          variant={
                            diagnosticsData.mockDataDetection.suspiciousPercentage > 50 ? "destructive" : "warning"
                          }
                        >
                          <AlertTitle>
                            {diagnosticsData.mockDataDetection.suspiciousPercentage > 50
                              ? "Critical Issue"
                              : "Potential Issue"}
                          </AlertTitle>
                          <AlertDescription>
                            <p>
                              {diagnosticsData.mockDataDetection.suspiciousPercentage.toFixed(1)}% of recent analyses
                              appear to contain mock data. This suggests that the OpenAI integration may not be working
                              correctly.
                            </p>
                            <p className="mt-2">Possible causes:</p>
                            <ul className="list-disc list-inside mt-1">
                              <li>OpenAI API key is invalid or expired</li>
                              <li>Network connectivity issues to OpenAI API</li>
                              <li>Fallback to mock data when API calls fail</li>
                              <li>Testing code in production</li>
                            </ul>
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  ) : (
                    <Alert variant="success">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>No Mock Data Detected</AlertTitle>
                      <AlertDescription>
                        All analyzed credit reports appear to contain real data from OpenAI.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          {chatResults ? (
            <Card>
              <CardHeader>
                <CardTitle>Chat Functionality</CardTitle>
                <CardDescription>Status of the chat feature</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Chat Endpoint Status */}
                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2">Chat Endpoint</h3>
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(chatResults.chatEndpoint?.success ? "success" : "error")}
                          <span
                            className={`font-medium ${getStatusColor(chatResults.chatEndpoint?.success ? "success" : "error")}`}
                          >
                            {chatResults.chatEndpoint?.success ? "Working" : "Not Working"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {chatResults.chatEndpoint?.message || "No status message available"}
                        </p>
                        {chatResults.chatEndpoint?.latencyMs && (
                          <p className="text-sm text-gray-500 mt-1">Latency: {chatResults.chatEndpoint.latencyMs}ms</p>
                        )}
                      </div>

                      {/* Chat Messages Status */}
                      {chatResults.chatMessages && (
                        <div className="border rounded-lg p-4">
                          <h3 className="font-medium mb-2">Chat Messages</h3>
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(chatResults.chatMessages?.success ? "success" : "error")}
                            <span
                              className={`font-medium ${getStatusColor(chatResults.chatMessages?.success ? "success" : "error")}`}
                            >
                              {chatResults.chatMessages?.success ? "Available" : "Unavailable"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {chatResults.chatMessages?.success
                              ? `Found ${chatResults.chatMessages.messageCount} messages for the specified analysis.`
                              : chatResults.chatMessages?.message || "Failed to retrieve chat messages."}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Chat Messages Preview */}
                    {chatResults.chatMessages?.success && chatResults.chatMessages.messages?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Recent Chat Messages</h3>
                        <div className="border rounded-lg p-4 space-y-3">
                          {chatResults.chatMessages.messages.map((message: any) => (
                            <div key={message.id} className="border-b pb-2">
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  {message.role === "user"
                                    ? "User"
                                    : message.role === "assistant"
                                      ? "AI Assistant"
                                      : message.role === "system"
                                        ? "System"
                                        : message.role}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {new Date(message.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm mt-1">
                                {message.content.length > 100
                                  ? `${message.content.substring(0, 100)}...`
                                  : message.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overall Status */}
                    <Alert
                      variant={
                        chatResults.overallStatus === "healthy"
                          ? "default"
                          : chatResults.overallStatus === "warning"
                            ? "warning"
                            : "destructive"
                      }
                    >
                      <AlertTitle>
                        {chatResults.overallStatus === "healthy"
                          ? "Chat Functionality Working"
                          : chatResults.overallStatus === "warning"
                            ? "Chat Functionality Issues"
                            : "Chat Functionality Broken"}
                      </AlertTitle>
                      <AlertDescription>
                        {chatResults.overallStatus === "healthy"
                          ? "The chat functionality appears to be working correctly."
                          : chatResults.overallStatus === "warning"
                            ? "The chat functionality has some issues but may still work partially."
                            : "The chat functionality is not working. Please check the OpenAI integration."}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Chat Testing Not Enabled</h3>
              <p className="text-gray-500 mb-4">
                Enable chat testing to see detailed information about the chat functionality.
              </p>
              <Button
                onClick={() => {
                  setTestChat(true)
                  runDiagnostics()
                }}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Test Chat Functionality
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="api-calls">
          <Card>
            <CardHeader>
              <CardTitle>Recent OpenAI API Calls</CardTitle>
              <CardDescription>Last 5 API calls to OpenAI</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !diagnosticsData?.recentApiCalls || diagnosticsData.recentApiCalls.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Recent API Calls</h3>
                  <p className="text-gray-500">No recent OpenAI API calls were found in the logs.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {diagnosticsData.recentApiCalls.map((call: any) => (
                    <div key={call.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(call.success ? "success" : "error")}
                            <span className="font-medium">{call.model}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">Request ID: {call.request_id}</p>
                        </div>
                        <Badge variant={call.success ? "outline" : "destructive"}>
                          {call.success ? "Success" : "Failed"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Timestamp</p>
                          <p className="text-sm">{new Date(call.timestamp).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Latency</p>
                          <p className="text-sm">{call.latency_ms}ms</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Prompt Length</p>
                          <p className="text-sm">{call.prompt_length} chars</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Response Length</p>
                          <p className="text-sm">{call.response_length || "N/A"}</p>
                        </div>
                      </div>

                      {!call.success && call.error_message && (
                        <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-800">
                          <p className="font-medium">Error: {call.error_type}</p>
                          <p>{call.error_message}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
