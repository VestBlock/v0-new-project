"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { FileText, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase"
import type { Analysis } from "@/lib/supabase"

function HistoryContent() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        setAnalyses(data as Analysis[])
        setFilteredAnalyses(data as Analysis[])
      } catch (error) {
        console.error("Error fetching analyses:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load your analysis history. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalyses()
  }, [user, toast])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredAnalyses(analyses)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredAnalyses(
        analyses.filter((analysis) => {
          // Search in notes
          if (analysis.notes && analysis.notes.toLowerCase().includes(query)) {
            return true
          }

          // Search in OCR text
          if (analysis.ocr_text && analysis.ocr_text.toLowerCase().includes(query)) {
            return true
          }

          // Search in result data if available
          if (analysis.result) {
            const resultStr = JSON.stringify(analysis.result).toLowerCase()
            if (resultStr.includes(query)) {
              return true
            }
          }

          return false
        }),
      )
    }
  }, [searchQuery, analyses])

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-500"
      case "processing":
        return "bg-yellow-500/10 text-yellow-500"
      case "error":
        return "bg-red-500/10 text-red-500"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  if (isLoading) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Loading your analysis history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Analysis History</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search analyses..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredAnalyses.length === 0 ? (
        <Card className="card-glow">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            {analyses.length === 0 ? (
              <>
                <h3 className="text-xl font-medium mb-2">No analyses found</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't uploaded any credit reports yet. Start by uploading a report for analysis.
                </p>
                <Button asChild>
                  <Link href="/dashboard">Upload Credit Report</Link>
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-medium mb-2">No matching analyses</h3>
                <p className="text-muted-foreground mb-4">
                  No analyses match your search query. Try a different search term.
                </p>
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAnalyses.map((analysis) => (
            <Card key={analysis.id} className="card-glow overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">
                    Credit Analysis
                    <div
                      className={`inline-block ml-2 px-2 py-0.5 text-xs rounded-full ${getStatusColor(analysis.status)}`}
                    >
                      {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                    </div>
                  </CardTitle>
                </div>
                <CardDescription>{format(new Date(analysis.created_at), "MMMM d, yyyy 'at' h:mm a")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.notes ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{analysis.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No notes added</p>
                  )}

                  <Button asChild className="w-full mt-4">
                    <Link href={`/credit-analysis?id=${analysis.id}`}>View Analysis</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-10">
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg">Loading history...</p>
          </div>
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  )
}
