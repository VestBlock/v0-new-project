"use client"

import { useState, useEffect } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { updateAnalysisNotes } from "@/lib/analyses"

interface NotesTabProps {
  analysisId: string
}

export function NotesTab({ analysisId }: NotesTabProps) {
  const [notes, setNotes] = useState("")
  const [originalNotes, setOriginalNotes] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchNotes = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const { data, error } = await fetch(`/api/analysis/${analysisId}`).then((res) => res.json())

        if (error) {
          throw new Error(error)
        }

        // Get notes from the analysis data
        const analysisNotes = data?.notes || ""
        setNotes(analysisNotes)
        setOriginalNotes(analysisNotes)
      } catch (error) {
        console.error("Error fetching notes:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load notes. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchNotes()
  }, [analysisId, user, toast])

  const handleSaveNotes = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      const { success, error } = await updateAnalysisNotes(analysisId, notes)

      if (!success) {
        throw error
      }

      setOriginalNotes(notes)
      toast({
        title: "Notes Saved",
        description: "Your notes have been saved successfully.",
      })
    } catch (error) {
      console.error("Error saving notes:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save notes. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle>Personal Notes</CardTitle>
        <CardDescription>Add your own notes about this credit analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add your notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[200px]"
        />
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">These notes are private and only visible to you.</p>
        <Button onClick={handleSaveNotes} disabled={isSaving || notes === originalNotes}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Notes
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
