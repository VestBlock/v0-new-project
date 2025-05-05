"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Trash2, Eye, FileText } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import type { Analysis } from "@/lib/supabase-client"

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchAnalyses()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredAnalyses(analyses)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredAnalyses(
        analyses.filter(
          (analysis) =>
            analysis.id.toLowerCase().includes(query) ||
            analysis.user_id.toLowerCase().includes(query) ||
            (analysis.ocr_text && analysis.ocr_text.toLowerCase().includes(query)),
        ),
      )
    }
  }, [searchQuery, analyses])

  async function fetchAnalyses() {
    try {
      setIsLoading(true)
      const response = await fetch("/api/admin/analyses")

      if (!response.ok) {
        throw new Error("Failed to fetch analyses")
      }

      const data = await response.json()
      setAnalyses(data)
      setFilteredAnalyses(data)
    } catch (error) {
      console.error("Error fetching analyses:", error)
      toast({
        title: "Error",
        description: "Failed to load analyses. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleDeleteAnalysis(analysis: Analysis) {
    setSelectedAnalysis(analysis)
    setIsDeleteDialogOpen(true)
  }

  function handleViewAnalysis(analysis: Analysis) {
    window.open(`/credit-analysis/${analysis.id}`, "_blank")
  }

  async function handleConfirmDelete() {
    if (!selectedAnalysis) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/admin/delete-analysis/${selectedAnalysis.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete analysis")
      }

      // Remove the analysis from the local state
      setAnalyses(analyses.filter((a) => a.id !== selectedAnalysis.id))

      toast({
        title: "Success",
        description: "Analysis deleted successfully",
      })

      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting analysis:", error)
      toast({
        title: "Error",
        description: "Failed to delete analysis. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Analysis Management</h1>

      <div className="mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search analyses..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => fetchAnalyses()}>Refresh</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading analyses...</span>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div>
            <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-medium">No analyses found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try a different search term" : "No analyses exist in the system yet"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAnalyses.map((analysis) => (
                <TableRow key={analysis.id}>
                  <TableCell className="font-medium">{analysis.id.substring(0, 8)}...</TableCell>
                  <TableCell>{analysis.user_id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    {analysis.status === "completed" ? (
                      <Badge variant="success">Completed</Badge>
                    ) : analysis.status === "processing" ? (
                      <Badge variant="secondary">Processing</Badge>
                    ) : (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(analysis.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {analysis.completed_at ? new Date(analysis.completed_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewAnalysis(analysis)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAnalysis(analysis)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Analysis Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the analysis and all associated data including
              dispute letters and chat messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
