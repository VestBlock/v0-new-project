import { supabase } from "./supabase"
import type { Analysis } from "./supabase"

export async function getAnalysis(analysisId: string, userId: string): Promise<Analysis | null> {
  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", userId)
      .single()

    if (error) throw error

    return data as Analysis
  } catch (error) {
    console.error("Error getting analysis:", error)
    return null
  }
}

export async function getUserAnalyses(userId: string): Promise<Analysis[]> {
  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return data as Analysis[]
  } catch (error) {
    console.error("Error getting user analyses:", error)
    return []
  }
}

export async function searchAnalyses(userId: string, query: string): Promise<Analysis[]> {
  try {
    // Search in notes and OCR text
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .or(`notes.ilike.%${query}%,ocr_text.ilike.%${query}%`)
      .order("created_at", { ascending: false })

    if (error) throw error

    return data as Analysis[]
  } catch (error) {
    console.error("Error searching analyses:", error)
    return []
  }
}

export async function updateAnalysisNotes(analysisId: string, notes: string) {
  try {
    const { error } = await supabase.from("analyses").update({ notes }).eq("id", analysisId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error updating analysis notes:", error)
    return { success: false, error }
  }
}
