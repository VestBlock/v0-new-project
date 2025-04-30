"use client"

import { useState, useEffect } from "react"
import { Loader2, Save, Trash2, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { getNotes, createNote, updateNote, deleteNote } from "@/lib/notes"
import type { UserNote } from "@/lib/supabase"

export function NotesTab({ analysisId }: { analysisId: string }) {
  const [notes, setNotes] = useState<UserNote[]>([])
  const [newNote, setNewNote] = useState("")
  const [editingNote, setEditingNote] = useState<{ id: string; content: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchNotes = async () => {
      if (!user) return

      try {
        const userNotes = await getNotes(user.id, analysisId)
        setNotes(userNotes)
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

  const handleSaveNote = async () => {
    if (!user || !newNote.trim()) return

    setIsSaving(true)

    try {
      const { success, data, error } = await createNote({
        userId: user.id,
        analysisId,
        content: newNote.trim(),
      })

      if (!success || error) throw error

      setNotes([data, ...notes])
      setNewNote("")

      toast({
        title: "Note saved",
        description: "Your note has been saved successfully.",
      })
    } catch (error) {
      console.error("Error saving note:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save note. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateNote = async () => {
    if (!user || !editingNote) return

    setIsSaving(true)

    try {
      const { success, error } = await updateNote(editingNote.id, editingNote.content)

      if (!success || error) throw error

      setNotes(
        notes.map((note) =>
          note.id === editingNote.id
            ? { ...note, content: editingNote.content, updated_at: new Date().toISOString() }
            : note,
        ),
      )
      setEditingNote(null)

      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating note:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update note. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return

    setIsDeleting(noteId)

    try {
      const { success, error } = await deleteNote(noteId)

      if (!success || error) throw error

      setNotes(notes.filter((note) => note.id !== noteId))

      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting note:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete note. Please try again.",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Add Note</CardTitle>
          <CardDescription>Add personal notes about your credit report or analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Add your notes here..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
            <Button onClick={handleSaveNote} disabled={isSaving || !newNote.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Note
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Your Notes</CardTitle>
          <CardDescription>Notes you've added to this analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No notes yet. Add your first note above.</p>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border p-4">
                  {editingNote?.id === note.id ? (
                    <div className="space-y-4">
                      <Textarea
                        value={editingNote.content}
                        onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                        rows={4}
                      />
                      <div className="flex space-x-2">
                        <Button onClick={handleUpdateNote} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setEditingNote(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingNote({ id: note.id, content: note.content })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={isDeleting === note.id}
                          >
                            {isDeleting === note.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
