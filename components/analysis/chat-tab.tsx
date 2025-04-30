"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { getChatMessages, sendUserMessage, sendAssistantMessage } from "@/lib/chat"
import type { ChatMessage } from "@/lib/supabase"

export function ChatTab({ analysisId }: { analysisId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return

      try {
        const chatMessages = await getChatMessages(user.id, analysisId)
        setMessages(chatMessages)
      } catch (error) {
        console.error("Error fetching messages:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load chat messages. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [analysisId, user, toast])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if (!user || !input.trim()) return

    setIsSending(true)

    try {
      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        analysis_id: analysisId,
        user_id: user.id,
        role: "user",
        content: input.trim(),
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setInput("")

      // Send user message to server
      const { success, data: savedUserMessage } = await sendUserMessage({
        userId: user.id,
        analysisId,
        content: input.trim(),
      })

      if (!success) throw new Error("Failed to send message")

      // Show typing indicator
      const typingMessage: ChatMessage = {
        id: `typing-${Date.now()}`,
        analysis_id: analysisId,
        user_id: user.id,
        role: "assistant",
        content: "...",
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev.filter((m) => m.id !== userMessage.id), savedUserMessage, typingMessage])

      // Process with AI (simulated for now)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Generate AI response
      const aiResponse = await generateAIResponse(input.trim())

      // Remove typing indicator and add AI response
      setMessages((prev) => prev.filter((m) => m.id !== typingMessage.id))

      // Send assistant message to server
      const { data: savedAssistantMessage } = await sendAssistantMessage({
        userId: user.id,
        analysisId,
        content: aiResponse,
      })

      // Update messages with saved assistant message
      setMessages((prev) => [...prev, savedAssistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      })
    } finally {
      setIsSending(false)
    }
  }

  // Simulated AI response generator
  const generateAIResponse = async (userMessage: string): Promise<string> => {
    // In a real implementation, this would call an API endpoint that uses OpenAI
    const responses = [
      "I've analyzed your credit report and found several opportunities for improvement. The most impactful would be to reduce your credit utilization ratio by paying down your revolving credit accounts.",
      "Based on your credit history, I recommend disputing the collection account from ABC Collections. It appears to be over 7 years old and should no longer be on your report.",
      "Your payment history is generally good, but that recent late payment is affecting your score. Consider sending a goodwill letter to the creditor explaining the circumstances and requesting removal.",
      "I notice you have a high interest rate on your Capital One card. With your credit profile, you might qualify for a balance transfer to a card with 0% APR for 12-18 months, which could save you money while you pay it down.",
      "Looking at your credit mix, adding an installment loan could potentially improve your score over time, assuming you make all payments on time.",
    ]

    // Simple keyword matching for demo purposes
    if (userMessage.toLowerCase().includes("dispute")) {
      return "To dispute an item on your credit report, you'll need to send a letter to each credit bureau reporting the error. I can help you draft a dispute letter for specific accounts. Which account would you like to dispute?"
    } else if (userMessage.toLowerCase().includes("utilization")) {
      return "Credit utilization is the percentage of your available credit that you're using. Keeping it below 30% is ideal, but below 10% is even better for your score. Based on your report, your current utilization is around 45%, which is negatively impacting your score."
    } else if (userMessage.toLowerCase().includes("improve") || userMessage.toLowerCase().includes("boost")) {
      return "The fastest ways to improve your credit score are: 1) Pay down credit card balances, 2) Request credit limit increases, 3) Become an authorized user on someone else's well-established account, and 4) Dispute any inaccuracies on your report."
    }

    // Default to a random response
    return responses[Math.floor(Math.random() * responses.length)]
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle>AI Credit Assistant</CardTitle>
        <CardDescription>
          Chat with our AI assistant about your credit report and get personalized advice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="h-[400px] overflow-y-auto rounded-md border p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-muted-foreground">
                  No messages yet. Start chatting with the AI assistant to get personalized credit advice.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.content === "..." ? (
                        <div className="flex items-center space-x-1">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-current"></div>
                          <div
                            className="h-2 w-2 animate-bounce rounded-full bg-current"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                          <div
                            className="h-2 w-2 animate-bounce rounded-full bg-current"
                            style={{ animationDelay: "0.4s" }}
                          ></div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Textarea
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
            />
            <Button onClick={handleSendMessage} disabled={isSending || !input.trim()}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
