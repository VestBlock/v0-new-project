import { supabase } from "./supabase"

export type ChatMessage = {
  id: string
  analysis_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

type SendChatMessageParams = {
  analysisId: string
  userId: string
  content: string
}

export async function getChatMessages(analysisId: string) {
  try {
    console.log("Getting chat messages for analysis:", analysisId)

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error getting chat messages:", error)
      throw error
    }

    console.log("Chat messages retrieved successfully:", data?.length || 0)
    return { success: true, messages: data as ChatMessage[] }
  } catch (error) {
    console.error("Error getting chat messages:", error)
    return { success: false, error, messages: [] }
  }
}

export async function sendChatMessage({ analysisId, userId, content }: SendChatMessageParams) {
  try {
    console.log("Sending chat message:", { analysisId, userId, contentLength: content.length })

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        role: "user",
        content,
      })
      .select()

    if (error) {
      console.error("Error sending chat message:", error)
      throw error
    }

    console.log("Chat message sent successfully")
    return { success: true, message: data[0] as ChatMessage }
  } catch (error) {
    console.error("Error sending chat message:", error)
    return { success: false, error }
  }
}

export async function addAIMessage({ analysisId, userId, content }: SendChatMessageParams) {
  try {
    console.log("Adding AI message:", { analysisId, userId, contentLength: content.length })

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        role: "assistant",
        content,
      })
      .select()

    if (error) {
      console.error("Error adding AI message:", error)
      throw error
    }

    console.log("AI message added successfully")
    return { success: true, message: data[0] as ChatMessage }
  } catch (error) {
    console.error("Error adding AI message:", error)
    return { success: false, error }
  }
}
