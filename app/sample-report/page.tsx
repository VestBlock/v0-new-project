"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase"

export default function SampleReportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleUseSample = async () => {
    setIsSubmitting(true)

    try {
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Sample credit report text
      const sampleReportText = `
CREDIT REPORT

Name: John Doe
Report Date: 04/30/2025

CREDIT SCORE: 680

ACCOUNTS:
- Bank of America Credit Card
  Account #: XXXX-XXXX-XXXX-1234
  Status: Current
  Balance: $2,500
  Credit Limit: $5,000
  Payment History: Good
  
- Chase Auto Loan
  Account #: LOAN12345
  Status: Current
  Balance: $15,000
  Original Amount: $25,000
  Payment History: Good
  
- Capital One Credit Card
  Account #: XXXX-XXXX-XXXX-5678
  Status: Late 30 days
  Balance: $1,800
  Credit Limit: $2,000
  Payment History: Fair
  
NEGATIVE ITEMS:
- Collection Account
  Creditor: ABC Collections
  Original Creditor: Sprint
  Account #: COLL98765
  Amount: $450
  Status: Open
  Date Reported: 01/15/2025
  
- Late Payment
  Creditor: Capital One
  Account #: XXXX-XXXX-XXXX-5678
  Date: 03/15/2025
  Status: 30 days late
      `

      // Create an analysis record directly
      const { data: analysisData, error: analysisError } = await supabase
        .from("analyses")
        .insert({
          user_id: user?.id,
          ocr_text: sampleReportText,
          status: "processing",
          file_path: "sample-report",
        })
        .select()

      if (analysisError) {
        throw analysisError
      }

      // Start the GPT analysis process
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysisData[0].id,
          text: sampleReportText,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to analyze text")
      }

      // Redirect to analysis page
      router.push(`/credit-analysis?id=${analysisData[0].id}`)
    } catch (error) {
      console.error("Sample report error:", error)
      toast({
        variant: "destructive",
        title: "Submission failed",
        description:
          error instanceof Error ? error.message : "There was an error processing the sample report. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/login">Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Sample Credit Report</h1>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Use Sample Credit Report</CardTitle>
          <CardDescription>
            Don't have a credit report handy? Use our sample report to see how VestBlock works.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm">Our sample report includes:</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Credit score of 680</li>
                <li>3 credit accounts (2 credit cards, 1 auto loan)</li>
                <li>1 collection account</li>
                <li>1 late payment</li>
              </ul>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Note:</p>
              <p className="text-sm text-muted-foreground">
                This is a fictional report for demonstration purposes only. The analysis will be based on this sample
                data.
              </p>
            </div>
            <Button
              onClick={handleUseSample}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Use Sample Report"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
