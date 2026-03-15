"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/file-upload"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { FileText, ArrowRight } from "lucide-react"

export default function UploadReportPage()

{
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { user } = useAuth()
  
  const { toast } = useToast()
  const router = useRouter()
  const supabase = getSupabaseClient()
  
  const handleUploadComplete = (url: string) => {
    setUploadedUrl(url)
  }

  const handleProcessReport = async () => {
    if (!uploadedUrl || !user) return

    setIsProcessing(true)
    try {
      const response = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: uploadedUrl }),
      })

      if (!response.ok) {
        throw new Error("Failed to process report")
      }

      const data = await response.json()

      const { error } = await supabase.from("credit_reports").insert({
        user_id: user.id,
        report_text: data.text,
        credit_score: data.creditScore || null,
        negative_items: data.negativeItems || null,
        accounts: data.accounts || null,
        inquiries: data.inquiries || null,
        public_records: data.publicRecords || null,
      })

      if (error) throw error

      toast({
        title: "Report processed",
        description: "Your credit report has been successfully processed.",
      })
      router.push("/chat?prompt=analyze+my+credit+report")
    } catch (error: any) {
      console.error("Report processing error:", error)
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process your credit report",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-2 gradient-text">Upload Credit Report</h1>
          <p className="text-muted-foreground mb-8">
            Upload your credit report for AI analysis and personalized recommendations.
          </p>
          <div className="space-y-8">
            <FileUpload
              bucket="credit-reports"
              folder={user?.id}
              acceptedFileTypes=".pdf,.jpg,.jpeg,.png,.txt"
              maxSizeMB={20}
              onUploadComplete={handleUploadComplete}
              buttonText="Select Credit Report"
            />
            {uploadedUrl && (
              <Card className="p-6 bg-card/80 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-cyan-400" />
                    <div>
                      <p className="font-medium">Credit Report Uploaded</p>
                      <p className="text-sm text-muted-foreground">Your report is ready for processing</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleProcessReport}
                    disabled={isProcessing}
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    {isProcessing ? "Processing..." : "Process Report"}
                    {!isProcessing && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
