import { supabase } from "./supabase"

export type DisputeLetter = {
  id: string
  analysis_id: string
  user_id: string
  bureau: string
  account_name: string
  account_number: string
  issue_type: string
  letter_content: string
  created_at: string
}

type CreateDisputeLetterParams = {
  analysisId: string
  userId: string
  bureau: string
  accountName: string
  accountNumber: string
  issueType: string
  letterContent: string
}

export async function createDisputeLetter({
  analysisId,
  userId,
  bureau,
  accountName,
  accountNumber,
  issueType,
  letterContent,
}: CreateDisputeLetterParams) {
  try {
    if (!analysisId || !userId || !bureau || !accountName || !accountNumber || !issueType || !letterContent) {
      throw new Error("Missing required parameters for creating dispute letter")
    }

    const { data, error } = await supabase
      .from("dispute_letters")
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        bureau,
        account_name: accountName,
        account_number: accountNumber,
        issue_type: issueType,
        letter_content: letterContent,
      })
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      throw new Error("No data returned after creating dispute letter")
    }

    return { success: true, letter: data[0] as DisputeLetter }
  } catch (error) {
    console.error("Error creating dispute letter:", error)
    return { success: false, error }
  }
}

export async function getDisputeLetters(analysisId: string) {
  try {
    if (!analysisId) {
      throw new Error("Analysis ID is required to get dispute letters")
    }

    const { data, error } = await supabase
      .from("dispute_letters")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, letters: data as DisputeLetter[] }
  } catch (error) {
    console.error("Error getting dispute letters:", error)
    return { success: false, error, letters: [] }
  }
}

export async function getDisputeLetter(letterId: string) {
  try {
    if (!letterId) {
      throw new Error("Letter ID is required to get a dispute letter")
    }

    const { data, error } = await supabase.from("dispute_letters").select("*").eq("id", letterId).single()

    if (error) throw error

    return { success: true, letter: data as DisputeLetter }
  } catch (error) {
    console.error("Error getting dispute letter:", error)
    return { success: false, error }
  }
}

export async function deleteDisputeLetter(letterId: string) {
  try {
    if (!letterId) {
      throw new Error("Letter ID is required to delete a dispute letter")
    }

    const { error } = await supabase.from("dispute_letters").delete().eq("id", letterId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting dispute letter:", error)
    return { success: false, error }
  }
}
