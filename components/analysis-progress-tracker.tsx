"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface AnalysisProgressTrackerProps {
  analysisId: string
  onComplete: () => void
  onError: (error: string) => void
}

export function AnalysisProgressTracker({ analysisId, onComplete, onError }: AnalysisProgressTrackerProps) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<"initializing" | "extracting" | "analyzing" | "completed" | "error">(
    "initializing",
  )
  const [statusMessage, setStatusMessage] = useState("Initializing analysis...")
  const [elapsedTime, setElapsedTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const startTime = Date.now()
    let intervalId: NodeJS.Timeout
    let timeoutId: NodeJS.Timeout

    // Function to check analysis status
    const checkStatus = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("analyses")
          .select("status, notes, ocr_text, result")
          .eq("id", analysisId)
          .single()

        if (fetchError) {
          console.error("Error fetching analysis status:", fetchError)
          setError("Failed to fetch analysis status. Please refresh the page.")
          setStatus("error")
          onError("Failed to fetch analysis status")
          return
        }

        if (!data) {
          setError("Analysis not found")
          setStatus("error")
          onError("Analysis not found")
          return
        }

        // Update elapsed time
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))

        // Handle different statuses
        if (data.status === "error") {
          setError(data.notes || "An error occurred during analysis")
          setStatus("error")
          onError(data.notes || "An error occurred during analysis")
          return
        }

        if (data.status === "completed" && data.result) {
          setProgress(100)
          setStatus("completed")
          setStatusMessage("Analysis completed successfully!")
          onComplete()
          return
        }

        // Update progress based on the current state
        if (data.ocr_text && !data.result) {
          // Text extracted, now analyzing
          setStatus("analyzing")
          setStatusMessage("Analyzing your credit report...")
          setProgress(Math.min(75, progress + 5))
        } else if (data.notes && data.notes.includes("Processing")) {
          // Still extracting text
          setStatus("extracting")
          setStatusMessage("Extracting text from your credit report...")
          setProgress(Math.min(40, progress + 3))
        } else {
          // Still initializing
          setProgress(Math.min(20, progress + 2))
        }
      } catch (err) {
        console.error("Error in status check:", err)
        // Don't set error state here, just log it and continue polling
      }
    }

    // Initial check
    checkStatus()

    // Set up polling interval (every 3 seconds)
    intervalId = setInterval(checkStatus, 3000)

    // Set up timeout (5 minutes)
    timeoutId = setTimeout(
      () => {
        clearInterval(intervalId)
        if (status !== "completed") {
          setError("Analysis is taking longer than expected. It will continue in the background.")
          toast({
            title: "Analysis Taking Longer Than Expected",
            description: "Your analysis is still processing. You can check back later to see the results.",
          })
        }
      },
      5 * 60 * 1000,
    )

    // Clean up
    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [analysisId, onComplete, onError, progress, status, toast])

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (status === "error" && error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Analysis Error
          </CardTitle>
          <CardDescription>We encountered an issue while analyzing your credit report</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <p className="text-sm">You can try refreshing the page or returning to the dashboard to try again.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          {status === "completed" ? (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
              Analysis Complete
            </>
          ) : (
            <>
              {status === "initializing" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {status === "extracting" && <FileText className="mr-2 h-5 w-5" />}
              {status === "analyzing" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Credit Analysis in Progress
            </>
          )}
        </CardTitle>
        <CardDescription>{statusMessage}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            <span>Elapsed time: {formatTime(elapsedTime)}</span>
          </div>

          <div>
            {status === "initializing" && "Preparing analysis..."}
            {status === "extracting" && "Extracting text..."}
            {status === "analyzing" && "AI analysis in progress..."}
            {status === "completed" && "Analysis complete!"}
          </div>
        </div>

        {elapsedTime > 60 && status !== "completed" && (
          <p className="text-xs text-muted-foreground italic">
            Analysis can take 2-3 minutes for complex reports. Thank you for your patience.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
