import { supabase } from "./supabase-client"
import type { Notification } from "./supabase"

type CreateNotificationParams = {
  userId: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
}

export async function createNotification({ userId, title, message, type }: CreateNotificationParams) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error creating notification:", error)
    return { success: false, error }
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error marking notification as read:", error)
    return { success: false, error }
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    return { success: false, error }
  }
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)

    if (error) throw error

    return count || 0
  } catch (error) {
    console.error("Error getting unread notifications count:", error)
    return 0
  }
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error

    return data as Notification[]
  } catch (error) {
    console.error("Error getting notifications:", error)
    return []
  }
}
