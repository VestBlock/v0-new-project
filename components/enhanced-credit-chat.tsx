"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Send, Bot, User, RefreshCw, AlertTriangle, Info, Clock, Wifi, WifiOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"

interface ChatMessage {
  id: string
  analysis_id: string
  user_id: string
  role: string
  content: string
  created_at: string
  metadata?: any
}

interface ConnectionStatus {
  status: "connected" | "disconnected" | "connecting" | "unknown"
  latencyMs?: number
  lastChecked?: Date
  message?: string
}

interface EnhancedCreditChatProps {
  analysisId: string
  initialMessages?: ChatMessage[]
  className?: string
}

export default function EnhancedCreditChat({
  analysisId,
  initialMessages = [],
  className = "",
}: EnhancedCreditChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "unknown",
  })
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)
  const [messageMetrics, setMessageMetrics] = useState<{
    tokenUsage?: { prompt: number; completion: number; total: number }
    processingTimeMs?: number
    model?: string
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { user, getToken } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load initial messages if not provided
  useEffect(() => {
    if (initialMessages.length === 0) {
      loadMessages()
    } else {
      // If we have initial messages, we're probably connected
      setConnectionStatus({
        status: "connected",
        lastChecked: new Date(),
      })
    }
  }, [analysisId])

  // Check OpenAI connection status
  useEffect(() => {
    checkConnectionStatus()

    // Set up periodic connection checks
    const intervalId = setInterval(() => {
      if (!isLoading && !isCheckingConnection) {
        checkConnectionStatus(false) // Silent check
      }
    }, 60000) // Check every minute

    return () => clearInterval(intervalId)
  }, [])

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Load messages from the server
  const loadMessages = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      setError(null)

      const token = await getToken()

      const response = await fetch(`/api/chat-messages?analysisId=${analysisId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to load chat messages")
      }

      const data = await response.json()
      if (data.success) {
        setMessages(data.messages)
        setConnectionStatus({
          status: "connected",
          lastChecked: new Date(),
          message: "Successfully loaded messages",
        })
      } else {
        throw new Error(data.error || "Failed to load chat messages")
      }
    } catch (err) {
      console.error("Error loading messages:", err)
      setError("Failed to load chat messages. Please try again.")
      setConnectionStatus({
        status: "disconnected",
        lastChecked: new Date(),
        message: err instanceof Error ? err.message : "Unknown error",
      })
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Check OpenAI connection status
  const checkConnectionStatus = async (showToast = true) => {
    if (!user) return

    try {
      setIsCheckingConnection(true)

      // Update status to connecting
      setConnectionStatus((prev) => ({
        ...prev,
        status: "connecting",
        lastChecked: new Date(),
      }))

      const token = await getToken()
      const startTime = Date.now()

      const response = await fetch("/api/openai-status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const latencyMs = Date.now() - startTime

      if (!response.ok) {
        setConnectionStatus({
          status: "disconnected",
          latencyMs,
          lastChecked: new Date(),
          message: `API error: ${response.status}`,
        })

        if (showToast) {
          toast({
            title: "Connection Issue",
            description: "Unable to connect to OpenAI services",
            variant: "destructive",
          })
        }
        return
      }

      const data = await response.json()

      setConnectionStatus({
        status: data.success ? "connected" : "disconnected",
        latencyMs,
        lastChecked: new Date(),
        message: data.message,
      })

      if (!data.success && showToast) {
        toast({
          title: "OpenAI Service Issue",
          description: data.message || "OpenAI services are currently experiencing issues",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error checking OpenAI connection:", err)
      setConnectionStatus({
        status: "disconnected",
        lastChecked: new Date(),
        message: err instanceof Error ? err.message : "Unknown error",
      })

      if (showToast) {
        toast({
          title: "Connection Error",
          description: "Failed to check OpenAI connection status",
          variant: "destructive",
        })
      }
    } finally {
      setIsCheckingConnection(false)
    }
  }

  // Send a message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || !user) return

    try {
      setIsLoading(true)
      setError(null)
      setMessageMetrics(null)

      // Optimistically add user message
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        analysis_id: analysisId,
        user_id: user.id,
        role: "user",
        content: input,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")

      const token = await getToken()
      const response = await fetch("/api/credit-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId,
          message: input,
          conversationHistory: messages.slice(-10), // Send last 10 messages for context
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to send message")
      }

      const data = await response.json()

      if (data.success) {
        // Save metrics
        if (data.metrics) {
          setMessageMetrics({
            tokenUsage: data.metrics.tokenUsage,
            processingTimeMs: data.metrics.processingTimeMs,
            model: data.metrics.model,
          })
        }

        // If we got a response with messages, use those
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        } else if (data.response) {
          // Otherwise, add the AI response to our messages
          const aiMessage: ChatMessage = {
            id: `temp-response-${Date.now()}`,
            analysis_id: analysisId,
            user_id: user.id,
            role: "assistant",
            content: data.response,
            created_at: new Date().toISOString(),
            metadata: data.metrics,
          }
          setMessages((prev) => [...prev.filter((msg) => !msg.id.startsWith("temp-")), userMessage, aiMessage])
        }

        setConnectionStatus({
          status: "connected",
          lastChecked: new Date(),
          message: "Message sent successfully",
        })
      } else {
        throw new Error(data.error || "Failed to get response")
      }
    } catch (err) {
      console.error("Error sending message:", err)
      setError(err instanceof Error ? err.message : "Failed to send message")
      setConnectionStatus({
        status: "disconnected",
        lastChecked: new Date(),
        message: err instanceof Error ? err.message : "Unknown error",
      })

      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send message",
        variant: "destructive",
      })

      // Add a system message about the error
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        analysis_id: analysisId,
        user_id: user.id,
        role: "system",
        content: "Sorry, I'm having trouble connecting to my knowledge base. Please try again in a moment.",
        created_at: new Date().toISOString(),
      }

      // Keep the user message but add the error message
      setMessages((prev) => [...prev.filter((msg) => !msg.id.includes("temp-response")), errorMessage])
    } finally {
      setIsLoading(false)

      // Focus the input field after sending
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  // Retry connection
  const retryConnection = async () => {
    await checkConnectionStatus(true)
    if (connectionStatus.status === "connected") {
      loadMessages()
    } else {
      toast({
        title: "Still Disconnected",
        description: "We're still having trouble connecting to our AI service. Please try again later.",
        variant: "destructive",
      })
    }
  }

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (e) {
      return ""
    }
  }

  // Get connection status indicator
  const getConnectionStatusIndicator = () => {
    switch (connectionStatus.status) {
      case "connected":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-green-500">
                  <Wifi className="h-4 w-4 mr-1" />
                  <span className="text-xs">Connected</span>
                  {connectionStatus.latencyMs && <span className="text-xs ml-1">({connectionStatus.latencyMs}ms)</span>}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>OpenAI services are operational</p>
                {connectionStatus.lastChecked && (
                  <p className="text-xs">Last checked: {connectionStatus.lastChecked.toLocaleTimeString()}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case "disconnected":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-red-500">
                  <WifiOff className="h-4 w-4 mr-1" />
                  <span className="text-xs">Disconnected</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>OpenAI services are currently unavailable</p>
                {connectionStatus.message && <p className="text-xs">{connectionStatus.message}</p>}
                {connectionStatus.lastChecked && (
                  <p className="text-xs">Last checked: {connectionStatus.lastChecked.toLocaleTimeString()}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case "connecting":
        return (
          <div className="flex items-center text-yellow-500">
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            <span className="text-xs">Connecting...</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center text-gray-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span className="text-xs">Unknown</span>
          </div>
        )
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <CardHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center">
            <Bot className="mr-2 h-5 w-5" />
            Credit AI Assistant
          </CardTitle>
          <CardDescription>Ask questions about your credit report and get personalized advice</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {getConnectionStatusIndicator()}
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkConnectionStatus(true)}
            disabled={isCheckingConnection}
          >
            {isCheckingConnection ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {connectionStatus.status === "disconnected" && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Issue</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>We're having trouble connecting to our AI service. Some features may be limited.</span>
            <Button variant="outline" size="sm" onClick={retryConnection} disabled={isCheckingConnection}>
              {isCheckingConnection ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" /> Retry
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
            <Bot size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Chat with your Credit AI Assistant</h3>
            <p className="mb-4">
              Ask questions about your credit report, get advice on improving your score, or learn about dispute
              options.
            </p>
            <div className="w-full max-w-md space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setInput("What's the best way to improve my credit score?")}
              >
                What's the best way to improve my credit score?
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setInput("How can I dispute items on my credit report?")}
              >
                How can I dispute items on my credit report?
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setInput("What credit cards would be good for me?")}
              >
                What credit cards would be good for me?
              </Button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`flex items-start gap-2 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-8 w-8">
                  {message.role === "user" ? (
                    <>
                      <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                      <AvatarFallback>
                        <User size={16} />
                      </AvatarFallback>
                    </>
                  ) : message.role === "system" ? (
                    <>
                      <AvatarImage src="/placeholder.svg?height=32&width=32" alt="System" />
                      <AvatarFallback>
                        <AlertCircle size={16} />
                      </AvatarFallback>
                    </>
                  ) : (
                    <>
                      <AvatarImage src="/futuristic-robot-vestblock.png" alt="AI" />
                      <AvatarFallback>
                        <Bot size={16} />
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>

                <Card
                  className={`${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.role === "system"
                        ? "bg-destructive text-destructive-foreground"
                        : ""
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="space-y-1">
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs opacity-70 text-right flex justify-end items-center gap-1">
                        {message.role === "assistant" && message.metadata && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Model: {message.metadata.model || "Unknown"}</p>
                                <p>Processing time: {message.metadata.processingTimeMs}ms</p>
                                <p>Tokens: {message.metadata.tokenUsage?.total || "Unknown"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 max-w-[80%]">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/futuristic-robot-vestblock.png" alt="AI" />
                <AvatarFallback>
                  <Bot size={16} />
                </AvatarFallback>
              </Avatar>

              <Card>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RefreshCw size={14} className="animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                    <Progress value={45} className="h-1 w-[200px]" />
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[170px]" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <Card className="bg-destructive/10 border-destructive">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-destructive" />
                <span className="text-sm">{error}</span>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messageMetrics && (
        <div className="px-4 py-1 border-t text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {messageMetrics.model || "Unknown model"}
            </Badge>
            {messageMetrics.tokenUsage && <span>Tokens: {messageMetrics.tokenUsage.total}</span>}
          </div>
          <div>
            <Clock className="h-3 w-3 inline mr-1" />
            {messageMetrics.processingTimeMs ? `${(messageMetrics.processingTimeMs / 1000).toFixed(2)}s` : "Unknown"}
          </div>
        </div>
      )}

      <div className="p-4 border-t">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your credit report..."
            disabled={isLoading || connectionStatus.status === "disconnected"}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim() || connectionStatus.status === "disconnected"}>
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </form>
      </div>
    </div>
  )
}
