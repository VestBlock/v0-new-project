import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a single supabase client for the browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a server-side client (for API routes)
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Types for our database tables
export type Profile = {
  id: string
  email: string
  full_name?: string
  phone?: string
  is_pro: boolean
  role?: string
  created_at: string
  updated_at: string
}

export type Analysis = {
  id: string
  user_id: string
  file_path: string
  ocr_text?: string
  status: "processing" | "completed" | "error"
  result?: any
  created_at: string
  completed_at?: string
  notes?: string
}

export type ChatMessage = {
  id: string
  analysis_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

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

export type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  is_read: boolean
  created_at: string
}

export type UserNote = {
  id: string
  analysis_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}
