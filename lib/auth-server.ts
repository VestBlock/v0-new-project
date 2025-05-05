import { createServerSupabaseClient } from "./supabase-server"

/**
 * Gets the user session on the server side
 */
export async function getServerSession() {
  const supabase = createServerSupabaseClient()

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { session: null, user: null, profile: null }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    if (profileError) {
      console.error("[AUTH] Error fetching user profile:", profileError)
    }

    return {
      session,
      user: session.user,
      profile: profile || null,
    }
  } catch (error) {
    console.error("[AUTH] Error getting server session:", error)
    return { session: null, user: null, profile: null }
  }
}