import { supabase } from "./supabase"
import type { DisputeLetter } from "./supabase"

type CreateDisputeLetterParams = {
  userId: string
  analysisId: string
  bureau: string
  accountName: string
  accountNumber: string
  issueType: string
  letterContent: string
}

export async function createDisputeLetter({
  userId,
  analysisId,
  bureau,
  accountName,
  accountNumber,
  issueType,
  letterContent,
}: CreateDisputeLetterParams) {
  try {
    const { data, error } = await supabase
      .from("dispute_letters")
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        bureau,
        account_name: accountName,
        account_number: accountNumber,
        issue_type: issueType,
        letter_content: letterContent,
      })
      .select()

    if (error) throw error

    return { success: true, data: data[0] as DisputeLetter }
  } catch (error) {
    console.error("Error creating dispute letter:", error)
    return { success: false, error }
  }
}

export async function getDisputeLetters(userId: string, analysisId: string): Promise<DisputeLetter[]> {
  try {
    const { data, error } = await supabase
      .from("dispute_letters")
      .select("*")
      .eq("user_id", userId)
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return data as DisputeLetter[]
  } catch (error) {
    console.error("Error getting dispute letters:", error)
    return []
  }
}

export async function getDisputeLetter(letterId: string): Promise<DisputeLetter | null> {
  try {
    const { data, error } = await supabase.from("dispute_letters").select("*").eq("id", letterId).single()

    if (error) throw error

    return data as DisputeLetter
  } catch (error) {
    console.error("Error getting dispute letter:", error)
    return null
  }
}
