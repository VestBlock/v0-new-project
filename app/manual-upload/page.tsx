"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-client"

export default function ManualUploadPage() {
  const [creditReportText, setCreditReportText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!creditReportText.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your credit report text",
      })
      return
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to submit a credit report",
      })
      return
    }

    setIsSubmitting(true)

    try {
      console.log("Creating analysis record...")

      // First, create an analysis record in the database
      const { data: analysisData, error: analysisError } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          ocr_text: creditReportText,
          status: "processing",
          source: "manual",
        })
        .select()
        .single()

      if (analysisError) {
        console.error("Error creating analysis:", analysisError)
        throw new Error("Failed to create analysis record")
      }

      console.log("Analysis record created:", analysisData.id)

      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      console.log("Calling analyze API...")

      // Call the analyze API to process the text
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysisData.id,
          text: creditReportText,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to analyze credit report: ${response.status}`)
      }

      console.log("Analysis started successfully")

      toast({
        title: "Success",
        description: "Your credit report has been submitted for analysis",
      })

      // Redirect to the analysis page
      router.push(`/credit-analysis?id=${analysisData.id}`)
    } catch (error) {
      console.error("Error submitting credit report:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit credit report",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Manual Credit Report Upload</h1>

      <Card>
        <CardHeader>
          <CardTitle>Enter Your Credit Report Text</CardTitle>
          <CardDescription>
            Copy and paste the text from your credit report below. We'll analyze it to provide insights and
            recommendations.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <Textarea
              placeholder="Paste your credit report text here..."
              className="min-h-[300px]"
              value={creditReportText}
              onChange={(e) => setCreditReportText(e.target.value)}
              disabled={isSubmitting}
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" disabled={isSubmitting} onClick={() => router.push("/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit for Analysis"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Tips for Best Results</h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc pl-5 space-y-2">
              <li>Include as much detail as possible from your credit report</li>
              <li>Make sure to include account names, numbers, and status information</li>
              <li>Include information from all three major credit bureaus if available</li>
              <li>Remove any sensitive personal information like SSN, full account numbers, etc.</li>
              <li>For better results, copy the text directly rather than typing it manually</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
