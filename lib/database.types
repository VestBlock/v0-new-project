export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      analyses: {
        Row: {
          id: string
          user_id: string
          file_path: string
          ocr_text: string
          status: string
          result: Json | null
          notes: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          file_path: string
          ocr_text: string
          status: string
          result?: Json | null
          notes?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          file_path?: string
          ocr_text?: string
          status?: string
          result?: Json | null
          notes?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          analysis_id: string
          user_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          analysis_id: string
          user_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          analysis_id?: string
          user_id?: string
          role?: string
          content?: string
          created_at?: string
        }
      }
      dispute_letters: {
        Row: {
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
        Insert: {
          id?: string
          analysis_id: string
          user_id: string
          bureau: string
          account_name: string
          account_number: string
          issue_type: string
          letter_content: string
          created_at?: string
        }
        Update: {
          id?: string
          analysis_id?: string
          user_id?: string
          bureau?: string
          account_name?: string
          account_number?: string
          issue_type?: string
          letter_content?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          is_pro: boolean
          role: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          is_pro?: boolean
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          is_pro?: boolean
          role?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
