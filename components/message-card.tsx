"use client"

import type { Message } from "ai/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm" // For GitHub Flavored Markdown (tables, strikethrough, etc.)
import { cn } from "@/lib/utils"

interface MessageCardProps {
  message: Message
}

export function MessageCard({ message }: MessageCardProps) {
  const isAssistant = message.role === "assistant"
  const isUser = message.role === "user"

  return (
    <div className={cn("flex mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "p-3 rounded-lg max-w-[80%] md:max-w-[70%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 break-words">
          {typeof message.content === "string" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          ) : (
            // Handle cases where content might be an array of parts (e.g., for multimodal)
            // For this application, we primarily expect string content.
            <p>Unsupported message format.</p>
          )}
        </div>
        {message.createdAt && !isUser && (
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {new Date(message.createdAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
