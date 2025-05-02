"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Send, Bot, User, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ChatMessage } from "@/lib/chat"
import { useAuth } from "@/lib/auth-provider"

interface EnhancedChatTabProps {
  analysisId: string
  initialMessages?: ChatMessage[]
}

export function EnhancedChatTab({ analysisId, initialMessages = [] }: EnhancedChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
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
    }
  }, [analysisId])

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
      } else {
        throw new Error(data.error || "Failed to load chat messages")
      }
    } catch (err) {
      console.error("Error loading messages:", err)
      setError("Failed to load chat messages. Please try again.")
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to send message")
      }

      const data = await response.json()

      if (data.success) {
        setMessages(data.messages)
        setMetrics(data.metrics)
      } else {
        throw new Error(data.error || "Failed to get response")
      }
    } catch (err) {
      console.error("Error sending message:", err)
      setError(err instanceof Error ? err.message : "Failed to send message")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send message",
        variant: "destructive",
      })

      // Remove the optimistic message
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")))
    } finally {
      setIsLoading(false)
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

      {metrics && process.env.NODE_ENV === "development" && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">
          <details>
            <summary className="cursor-pointer">Performance Metrics</summary>
            <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="p-4 border-t">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your credit report..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </form>
      </div>
    </div>
  )
}
