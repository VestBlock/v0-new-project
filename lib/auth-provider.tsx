"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "./supabase"
import type { Profile } from "./supabase"
import { createServerSupabaseClient } from "./supabase"

// Types
type User = {
  id: string
  email: string
  fullName?: string
  phone?: string
  isPro: boolean
  role?: string
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Omit<Profile, "id" | "email" | "created_at" | "updated_at">>) => Promise<{ error: any }>
  sendPasswordResetEmail: (email: string) => Promise<{ error: any }>
  refreshUser: () => Promise<void>
}

// Add this function after the imports but before the AuthContext definition

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

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Fetch user profile from Supabase
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (error) {
      console.error("Error fetching profile:", error)
      return null
    }

    return data as Profile
  }

  // Update user state based on profile data
  const updateUserState = (profileData: Profile | null) => {
    if (profileData) {
      setProfile(profileData)
      setUser({
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        phone: profileData.phone,
        isPro: profileData.is_pro,
        role: profileData.role,
      })
    } else {
      setProfile(null)
      setUser(null)
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      const profileData = await fetchProfile(session.user.id)
      updateUserState(profileData)
    } else {
      updateUserState(null)
    }
  }

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        const profileData = await fetchProfile(session.user.id)
        updateUserState(profileData)
      }

      setLoading(false)
    }

    getSession()

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const profileData = await fetchProfile(session.user.id)
        updateUserState(profileData)
      } else {
        updateUserState(null)
      }

      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const updateProfile = async (data: Partial<Omit<Profile, "id" | "email" | "created_at" | "updated_at">>) => {
    if (!user) return { error: new Error("No user logged in") }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone,
      })
      .eq("id", user.id)

    if (!error) {
      await refreshUser()
    }

    return { error }
  }

  const sendPasswordResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
