"use client"

import { AlertTriangle, RefreshCw, Zap, Wifi, Clock, Shield, HelpCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { OpenAIErrorType } from "@/lib/openai-client"

interface OpenAIErrorDisplayProps {
  errorType: OpenAIErrorType | string
  errorMessage?: string
  onRetry?: () => void
  showHelp?: boolean
}

export function OpenAIErrorDisplay({ errorType, errorMessage, onRetry, showHelp = true }: OpenAIErrorDisplayProps) {
  // Default error message if none provided
  const defaultMessage = "We encountered an issue connecting to our AI service."

  // Get the appropriate icon and message based on error type
  let Icon = AlertTriangle
  let title = "AI Service Error"
  let description = errorMessage || defaultMessage
  let helpText = ""

  switch (errorType) {
    case OpenAIErrorType.AUTHENTICATION:
      Icon = Shield
      title = "Authentication Error"
      description = errorMessage || "We're having trouble authenticating with our AI service."
      helpText = "This is a system issue. Please contact support if the problem persists."
      break

    case OpenAIErrorType.RATE_LIMIT:
      Icon = Zap
      title = "Service Busy"
      description = errorMessage || "Our AI service is experiencing high demand right now."
      helpText = "Please try again in a few minutes when demand has decreased."
      break

    case OpenAIErrorType.QUOTA_EXCEEDED:
      Icon = Clock
      title = "Service Limit Reached"
      description = errorMessage || "We've reached our AI service usage limit."
      helpText = "Please try again later or contact support if this persists."
      break

    case OpenAIErrorType.TIMEOUT:
      Icon = Clock
      title = "Request Timeout"
      description = errorMessage || "The AI service took too long to respond."
      helpText = "Try again with a shorter request or try again later."
      break

    case OpenAIErrorType.CONNECTION:
      Icon = Wifi
      title = "Connection Error"
      description = errorMessage || "We couldn't connect to our AI service."
      helpText = "Please check your internet connection and try again."
      break

    case OpenAIErrorType.SERVER:
      Icon = AlertTriangle
      title = "Server Error"
      description = errorMessage || "The AI service is experiencing technical difficulties."
      helpText = "This is a temporary issue. Please try again later."
      break
  }

  return (
    <Alert variant="destructive" className="my-4">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>{description}</p>

        {showHelp && helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}

        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        )}

        {showHelp && (
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <HelpCircle className="h-3 w-3 mr-1" />
            <span>
              If this problem persists, please contact{" "}
              <a href="mailto:support@vestblock.io" className="underline">
                support@vestblock.io
              </a>
            </span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
