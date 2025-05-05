import { supabase } from "./supabase-client"

export type Note = {
  id: string
  analysis_id: string
  user_id: string
  title: string
  content: string
  created_at: string
}

type CreateNoteParams = {
  analysisId: string
  userId: string
  title: string
  content: string
}

type UpdateNoteParams = {
  noteId: string
  title?: string
  content?: string
}

export async function createNote({ analysisId, userId, title, content }: CreateNoteParams) {
  try {
    const { data, error } = await supabase
      .from("notes")
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        title,
        content,
      })
      .select()

    if (error) throw error

    return { success: true, note: data[0] as Note }
  } catch (error) {
    console.error("Error creating note:", error)
    return { success: false, error }
  }
}

export async function getNotes(analysisId: string) {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, notes: data as Note[] }
  } catch (error) {
    console.error("Error getting notes:", error)
    return { success: false, error, notes: [] }
  }
}

export async function updateNote({ noteId, title, content }: UpdateNoteParams) {
  try {
    const updates: { title?: string; content?: string } = {}
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content

    const { data, error } = await supabase.from("notes").update(updates).eq("id", noteId).select()

    if (error) throw error

    return { success: true, note: data[0] as Note }
  } catch (error) {
    console.error("Error updating note:", error)
    return { success: false, error }
  }
}

export async function deleteNote(noteId: string) {
  try {
    const { error } = await supabase.from("notes").delete().eq("id", noteId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting note:", error)
    return { success: false, error }
  }
}
