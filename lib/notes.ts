import { supabase } from "./supabase"
import type { UserNote } from "./supabase"

type CreateNoteParams = {
  userId: string
  analysisId: string
  content: string
}

export async function createNote({ userId, analysisId, content }: CreateNoteParams) {
  try {
    const { data, error } = await supabase
      .from("user_notes")
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        content,
      })
      .select()

    if (error) throw error

    return { success: true, data: data[0] as UserNote }
  } catch (error) {
    console.error("Error creating note:", error)
    return { success: false, error }
  }
}

export async function updateNote(noteId: string, content: string) {
  try {
    const { error } = await supabase
      .from("user_notes")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", noteId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error updating note:", error)
    return { success: false, error }
  }
}

export async function deleteNote(noteId: string) {
  try {
    const { error } = await supabase.from("user_notes").delete().eq("id", noteId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting note:", error)
    return { success: false, error }
  }
}

export async function getNotes(userId: string, analysisId: string): Promise<UserNote[]> {
  try {
    const { data, error } = await supabase
      .from("user_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return data as UserNote[]
  } catch (error) {
    console.error("Error getting notes:", error)
    return []
  }
}
