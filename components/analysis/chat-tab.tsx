"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Send } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-client"
import { OpenAIErrorDisplay } from "@/components/openai-error-display"
import { OpenAIErrorType } from "@/lib/openai-client"

interface ChatMessage {
  id: string
  role: string
  content: string
  created_at: string
}

interface ChatTabProps {
  analysisId: string
}

export function ChatTab({ analysisId }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<{ type: string; message: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  // Fetch chat messages
  const fetchMessages = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: true })

      if (error) {
        throw error
      }

      setMessages(data || [])

      // If no messages, add a welcome message
      if (data.length === 0) {
        const welcomeMessage = {
          id: "welcome",
          role: "assistant",
          content:
            "Hello! I'm your AI credit assistant. I've analyzed your credit report and can answer questions about your credit situation, recommend dispute strategies, suggest credit improvement tactics, and more. How can I help you today?",
          created_at: new Date().toISOString(),
        }
        setMessages([welcomeMessage])
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error)
      setError({
        type: "unknown",
        message: "Failed to load chat messages. Please try refreshing the page.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Send a new message
  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return

    try {
      setIsSending(true)
      setError(null)

      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Send the message to the API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId,
          message: newMessage,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()

        // Parse the error type if available
        let errorType = "unknown"
        if (errorData.details && errorData.details.includes("authentication")) {
          errorType = OpenAIErrorType.AUTHENTICATION
        } else if (errorData.details && errorData.details.includes("rate limit")) {
          errorType = OpenAIErrorType.RATE_LIMIT
        } else if (errorData.details && errorData.details.includes("quota")) {
          errorType = OpenAIErrorType.QUOTA_EXCEEDED
        } else if (errorData.details && errorData.details.includes("timeout")) {
          errorType = OpenAIErrorType.TIMEOUT
        } else if (errorData.details && errorData.details.includes("connection")) {
          errorType = OpenAIErrorType.CONNECTION
        }

        throw new Error(errorData.error || "Failed to send message", { cause: errorType })
      }

      const data = await response.json()
      setMessages(data.messages || [])
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)

      // Extract error type from cause if available
      const errorType = error instanceof Error && error.cause ? String(error.cause) : "unknown"

      setError({
        type: errorType,
        message: error instanceof Error ? error.message : "Failed to send message. Please try again.",
      })

      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
      })
    } finally {
      setIsSending(false)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch messages on mount
  useEffect(() => {
    fetchMessages()
  }, [analysisId, user])

  // Handle Enter key to send message
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0">
        <CardTitle>Chat with AI Assistant</CardTitle>
        <CardDescription>
          Ask questions about your credit report, dispute strategies, or credit improvement tactics
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="border rounded-lg p-4 h-[400px] overflow-y-auto">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
              {message.role !== "user" && (
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src="/futuristic-robot-vestblock.png" alt="AI" />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.role === "system"
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 ml-2">
                  <AvatarFallback>You</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && <OpenAIErrorDisplay errorType={error.type} errorMessage={error.message} onRetry={fetchMessages} />}

        <div className="flex space-x-2">
          <Textarea
            placeholder="Type your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isSending}
          />
          <Button onClick={sendMessage} disabled={isSending || !newMessage.trim()}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="px-0 text-xs text-muted-foreground">
        <p>
          The AI assistant uses the analysis of your credit report to provide personalized advice. For complex financial
          decisions, please consult with a financial advisor.
        </p>
      </CardFooter>
    </Card>
  )
}
