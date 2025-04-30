import { supabase } from "./supabase"
import type { ChatMessage } from "./supabase"

type SendMessageParams = {
  userId: string
  analysisId: string
  content: string
}

export async function sendUserMessage({ userId, analysisId, content }: SendMessageParams) {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        role: "user",
        content,
      })
      .select()

    if (error) throw error

    return { success: true, data: data[0] as ChatMessage }
  } catch (error) {
    console.error("Error sending user message:", error)
    return { success: false, error }
  }
}

export async function sendAssistantMessage({ userId, analysisId, content }: SendMessageParams) {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        role: "assistant",
        content,
      })
      .select()

    if (error) throw error

    return { success: true, data: data[0] as ChatMessage }
  } catch (error) {
    console.error("Error sending assistant message:", error)
    return { success: false, error }
  }
}

export async function getChatMessages(userId: string, analysisId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return data as ChatMessage[]
  } catch (error) {
    console.error("Error getting chat messages:", error)
    return []
  }
}
