import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type UploadStatus = "uploading" | "processing" | "success" | "error"

interface UploadStatusMessageProps {
  status: UploadStatus
  fileName: string
  fileSize: number
  progress?: number
  result?: {
    creditScore?: number
    negativeItems?: number
    accounts?: number
  }
  error?: string
}

export function UploadStatusMessage({
  status,
  fileName,
  fileSize,
  progress = 0,
  result,
  error,
}: UploadStatusMessageProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "uploading":
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
      case "processing":
        return <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-400" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-400" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploading credit report..."
      case "processing":
        return "Processing credit report..."
      case "success":
        return "Credit report processed successfully!"
      case "error":
        return "Error processing credit report"
    }
  }

  return (
    <Card
      className={`p-4 ${
        status === "error"
          ? "bg-red-500/10 border-red-500"
          : status === "success"
            ? "bg-green-500/10 border-green-500"
            : "bg-blue-500/10 border-blue-500"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">{getStatusIcon()}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-medium">{getStatusText()}</p>
            {status === "uploading" && <span className="text-sm">{progress}%</span>}
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            {fileName} ({(fileSize / 1024).toFixed(1)} KB)
          </p>

          {(status === "uploading" || status === "processing") && (
            <Progress value={progress} className={`h-1 mt-2 ${status === "processing" ? "bg-yellow-500/20" : ""}`} />
          )}

          {status === "success" && result && (
            <div className="mt-2 space-y-1">
              {result.creditScore && (
                <p className="text-sm">
                  Credit Score: <span className="font-medium text-cyan-400">{result.creditScore}</span>
                </p>
              )}
              {result.negativeItems !== undefined && <p className="text-sm">Negative Items: {result.negativeItems}</p>}
              {result.accounts !== undefined && <p className="text-sm">Accounts: {result.accounts}</p>}
            </div>
          )}

          {status === "error" && error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    </Card>
  )
}
