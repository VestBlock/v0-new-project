"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Send, Bot, User, RefreshCw, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ChatMessage {
  id: string
  analysis_id: string
  user_id: string
  role: string
  content: string
  created_at: string
}

interface CreditChatProps {
  analysisId: string
  initialMessages?: ChatMessage[]
}

export default function CreditChat({ analysisId, initialMessages = [] }: CreditChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "unknown">("unknown")
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { user, getToken } = useAuth()

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
      setConnectionStatus("connected")
    }
  }, [analysisId])

  // Check OpenAI connection status
  useEffect(() => {
    checkConnectionStatus()
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
        setConnectionStatus("connected")
      } else {
        throw new Error(data.error || "Failed to load chat messages")
      }
    } catch (err) {
      console.error("Error loading messages:", err)
      setError("Failed to load chat messages. Please try again.")
      setConnectionStatus("disconnected")
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
  const checkConnectionStatus = async () => {
    if (!user) return

    try {
      setIsCheckingConnection(true)
      const token = await getToken()
      const response = await fetch("/api/check-openai", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        setConnectionStatus("disconnected")
        return
      }

      const data = await response.json()
      setConnectionStatus(data.success ? "connected" : "disconnected")
    } catch (err) {
      console.error("Error checking OpenAI connection:", err)
      setConnectionStatus("disconnected")
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
          }
          setMessages((prev) => [...prev.filter((msg) => !msg.id.startsWith("temp-")), userMessage, aiMessage])
        }

        setConnectionStatus("connected")
      } else {
        throw new Error(data.error || "Failed to get response")
      }
    } catch (err) {
      console.error("Error sending message:", err)
      setError(err instanceof Error ? err.message : "Failed to send message")
      setConnectionStatus("disconnected")
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
    }
  }

  // Retry connection
  const retryConnection = async () => {
    await checkConnectionStatus()
    if (connectionStatus === "connected") {
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

  return (
    <div className="flex flex-col h-full">
      {connectionStatus === "disconnected" && (
        <Alert variant="destructive" className="mb-4">
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
            <p>
              Ask questions about your credit report, get advice on improving your score, or learn about dispute
              options.
            </p>
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
                      <div className="text-xs opacity-70 text-right">{formatTime(message.created_at)}</div>
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

      <div className="p-4 border-t">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your credit report..."
            disabled={isLoading || connectionStatus === "disconnected"}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim() || connectionStatus === "disconnected"}>
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </form>
      </div>
    </div>
  )
}
