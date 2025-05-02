"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Send } from "lucide-react"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

export default function SimpleChat({ context }: { context?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "Welcome to VestBlock Credit Chat. How can I help you today?" },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    // Add user message
    const userMessage = { role: "user" as const, content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          context,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Add assistant response
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }])
      } else {
        // Add error message
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `Error: ${data.error || "Failed to get response"}`,
          },
        ])
      }
    } catch (error) {
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Credit Assistant</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto flex flex-col gap-4 p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg max-w-[80%] ${
              message.role === "user"
                ? "bg-primary text-primary-foreground self-end"
                : message.role === "system"
                  ? "bg-muted self-center text-center"
                  : "bg-muted self-start"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && (
          <div className="self-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex w-full gap-2"
        >
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
