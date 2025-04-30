"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FileUp, Loader2, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase"
import type { Analysis } from "@/lib/supabase"

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([])
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true)
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchRecentAnalyses = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3)

        if (error) throw error

        setRecentAnalyses(data as Analysis[])
      } catch (error) {
        console.error("Error fetching recent analyses:", error)
      } finally {
        setIsLoadingAnalyses(false)
      }
    }

    fetchRecentAnalyses()
  }, [user])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please select a credit report file to upload.",
      })
      return
    }

    setIsUploading(true)

    try {
      // Create form data
      const formData = new FormData()
      formData.append("file", file)

      // Upload file to OCR endpoint
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload file")
      }

      const data = await response.json()

      // Redirect to analysis page
      router.push(`/credit-analysis?id=${data.analysisId}`)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading your credit report. Please try again.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access the dashboard.</CardDescription>
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
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Upload Credit Report</CardTitle>
            <CardDescription>
              Upload your credit report to get AI-powered analysis and personalized recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg p-12 text-center">
                <FileUp className="h-10 w-10 text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <h3 className="font-medium">Upload your credit report</h3>
                  <p className="text-sm text-muted-foreground">Drag and drop your file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports PDF, JPG, PNG (max 10MB)</p>
                </div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className="mt-4"
                >
                  Select File
                </Button>
              </div>

              {file && (
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-sm font-medium">Selected file:</p>
                  <p className="text-sm text-muted-foreground truncate">{file.name}</p>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Analyze Credit Report"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Your Account</CardTitle>
            <CardDescription>Manage your account and subscription.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Subscription</p>
                <p className="text-sm text-muted-foreground">
                  {user.isPro ? <span className="text-green-500">Pro Plan</span> : <span>Free Plan</span>}
                </p>
              </div>
              {!user.isPro && (
                <Button asChild className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500">
                  <a href="/pricing">Upgrade to Pro</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Analyses Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Recent Analyses</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/history">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoadingAnalyses ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : recentAnalyses.length === 0 ? (
          <Card className="card-glow">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No analyses yet</h3>
              <p className="text-muted-foreground text-center">
                You haven't uploaded any credit reports yet. Start by uploading a report for analysis.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {recentAnalyses.map((analysis) => (
              <Card key={analysis.id} className="card-glow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Credit Analysis</CardTitle>
                  <CardDescription>
                    {new Date(analysis.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div
                        className={`h-2 w-2 rounded-full mr-2 ${
                          analysis.status === "completed"
                            ? "bg-green-500"
                            : analysis.status === "processing"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      />
                      <p className="text-sm">{analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}</p>
                    </div>
                    <Button asChild className="w-full mt-2">
                      <Link href={`/credit-analysis?id=${analysis.id}`}>View Analysis</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
