export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Define interfaces for the roadmap structure
export interface DetailedSubStep {
  id: string // Could be a generated ID or index
  title: string
  details?: string
  completed: boolean // For future interactivity
  // Add any other relevant fields for sub-steps
}

export interface RoadmapResource {
  id: string // Could be a generated ID or index
  name: string
  url?: string
  description?: string
  type?: "article" | "tool" | "service" | "video" // Optional: to categorize resources
}

export interface RoadmapStep {
  id: string // Could be a generated ID or index
  title: string
  description: string
  category: string // e.g., "Credit Health", "Savings & Budgeting", "Debt Management", "Business Funding"
  priority: "High" | "Medium" | "Low"
  status: "Pending" | "In Progress" | "Completed" // Default to "Pending" for future interactivity
  estimated_timeline_text?: string // e.g., "1-2 weeks", "1 month", "Ongoing"
  potential_impact_points?: number // For credit score related steps
  detailed_sub_steps?: DetailedSubStep[]
  resources?: RoadmapResource[]
  // Old subSteps can be deprecated or kept for simpler versions if needed
  // sub_steps?: { title: string; completed: boolean }[] // Deprecated in favor of detailed_sub_steps
  // estimated_duration_days?: number // Deprecated in favor of estimated_timeline_text
}

export interface RoadmapData {
  overview?: string // A brief overview of the entire roadmap strategy
  steps: RoadmapStep[]
  generated_for_goal_title?: string // Title of the goal this roadmap was generated for
  generated_for_goal_id?: string // ID of the goal
}

export interface AiCreditCardRecommendation {
  name: string
  description: string
  bestFor?: string
  minimumCredit?: string
  link?: string
  // Add other relevant fields
}

export interface AiSideHustleRecommendation {
  name: string
  description: string
  potentialEarnings?: string
  timeCommitment?: string
  difficulty?: "easy" | "medium" | "hard" | string
  // Add other relevant fields
}

export interface AiDetailedAnalysis {
  // Define structure based on what your AI will provide, e.g.:
  overall_summary: string // This might be redundant if ai_summary is used
  credit_score_analysis?: { score?: number; bureau?: string; factors?: string[] }
  account_summary?: { total: number; positive: number; negative: number; open: number; closed: number }
  negative_items?: { type: string; creditor: string; details: string; recommendations?: string }[]
  inquiries?: { creditor: string; date: string; impact?: string }[]
  public_records?: { type: string; details: string }[]
  utilization_analysis?: { overall_ratio?: number; card_details?: { name: string; ratio: number }[] }
  // ... other sections your AI might generate
}

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          user_id: string // This should be the auth.users.id
          full_name: string | null
          email: string | null
          credit_score: number | null
          goals: string | null // General goals text
          income: number | null
          business_ein: string | null
          country: string | null
          financial_goal: Json | null // Stores the *primary* financial goal {id, title, description, customDetails}
          created_at: string
          updated_at: string
          // New fields for storing AI recommendations if not in analysis_jobs
          ai_side_hustle_recommendations?: Json | null
          ai_credit_card_recommendations?: Json | null
        }
        Insert: {
          id?: string // Should be user_id from auth
          user_id: string
          full_name?: string | null
          email?: string | null
          credit_score?: number | null
          goals?: string | null
          income?: number | null
          business_ein?: string | null
          country?: string | null
          financial_goal?: Json | null
          created_at?: string
          updated_at?: string
          ai_side_hustle_recommendations?: Json | null
          ai_credit_card_recommendations?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          email?: string | null
          credit_score?: number | null
          goals?: string | null
          income?: string | null // Corrected from string
          business_ein?: string | null
          country?: string | null
          financial_goal?: Json | null
          created_at?: string
          updated_at?: string
          ai_side_hustle_recommendations?: Json | null
          ai_credit_card_recommendations?: Json | null
        }
      }
      chat_history: {
        Row: {
          id: string
          user_id: string
          messages: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          messages: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          messages?: Json
          created_at?: string
        }
      }
      user_documents: {
        Row: {
          id: string
          user_id: string
          document_name: string
          document_url: string
          document_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_name: string
          document_url: string
          document_type: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_name?: string
          document_url?: string
          document_type?: string
          created_at?: string
        }
      }
      credit_reports: {
        Row: {
          id: string
          user_id: string | null
          report_text: string | null
          ai_analysis: string | null // This could be a summary or key findings string
          // Detailed analysis components could be stored as JSONB if needed here too
          // or linked to analysis_jobs if that's the primary store
          credit_score: number | null
          negative_items: Json | null
          accounts: Json | null
          inquiries: Json | null
          public_records: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          report_text?: string | null
          ai_analysis?: string | null
          credit_score?: number | null
          negative_items?: Json | null
          accounts?: Json | null
          inquiries?: Json | null
          public_records?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          report_text?: string | null
          ai_analysis?: string | null
          credit_score?: number | null
          negative_items?: Json | null
          accounts?: Json | null
          inquiries?: Json | null
          public_records?: Json | null // Corrected from string
          created_at?: string
        }
      }
      dispute_letters: {
        Row: {
          id: string
          user_id: string
          letter_type: string
          creditor_name: string | null
          account_number: string | null
          letter_content: string | null
          pdf_url: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          letter_type: string
          creditor_name?: string | null
          account_number?: string | null
          letter_content?: string | null
          pdf_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          letter_type?: string
          creditor_name?: string | null
          account_number?: string | null
          letter_content?: string | null
          pdf_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      // This table stores the generated roadmaps for users, potentially multiple per user if they explore different goals.
      user_roadmaps: {
        Row: {
          id: string // UUID, primary key
          user_id: string // Foreign key to auth.users.id
          financial_goal_id: string // ID of the financial goal this roadmap is for (e.g., "improve-credit")
          financial_goal_title: string // Title of the goal, for easier display
          financial_goal_custom_details: string | null // User's custom details for this goal at time of generation
          credit_score_at_generation: number | null // User's credit score when this roadmap was made
          roadmap_data: RoadmapData // The detailed roadmap JSONB
          generated_at: string // Timestamp
          is_primary: boolean // Optional: flag if this is linked to their main profile goal
        }
        Insert: {
          id?: string
          user_id: string
          financial_goal_id: string
          financial_goal_title: string
          financial_goal_custom_details?: string | null
          credit_score_at_generation?: number | null
          roadmap_data: RoadmapData
          generated_at?: string
          is_primary?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          financial_goal_id?: string
          financial_goal_title?: string
          financial_goal_custom_details?: string | null
          credit_score_at_generation?: number | null
          roadmap_data?: RoadmapData
          generated_at?: string
          is_primary?: boolean
        }
      }
      analysis_jobs: {
        Row: {
          id: string
          user_id: string
          created_at: string
          updated_at: string
          financial_goal_title: string | null
          financial_goal_details: Json | null // Assuming FinancialGoal type is complex
          original_file_name: string | null
          file_type: string | null // 'pdf' or 'txt'
          file_size_bytes: number | null
          status: string // e.g., "pending_upload", "pdfco_processing", "text_extracted", "ai_processing", "completed", "failed"
          error_message: string | null
          pdfco_file_id: string | null
          pdfco_job_id: string | null
          extracted_text_url: string | null // URL from PDF.co for the text file
          extracted_text: string | null
          is_likely_credit_report: boolean | null
          ai_summary: string | null
          ai_detailed_analysis: AiDetailedAnalysis | null // Typed JSONB
          ai_credit_card_recommendations: AiCreditCardRecommendation[] | null // Typed JSONB
          ai_side_hustle_recommendations: AiSideHustleRecommendation[] | null // Typed JSONB
          ai_roadmap_data: RoadmapData | null // Typed JSONB
          text_extraction_completed_at: string | null
          ai_analysis_completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          updated_at?: string
          financial_goal_title?: string | null
          financial_goal_details?: Json | null
          original_file_name?: string | null
          file_type?: string | null
          file_size_bytes?: number | null
          status: string // Must provide initial status
          error_message?: string | null
          pdfco_file_id?: string | null
          pdfco_job_id?: string | null
          extracted_text_url?: string | null
          extracted_text?: string | null
          is_likely_credit_report?: boolean | null
          ai_summary?: string | null
          ai_detailed_analysis?: AiDetailedAnalysis | null
          ai_credit_card_recommendations?: AiCreditCardRecommendation[] | null
          ai_side_hustle_recommendations?: AiSideHustleRecommendation[] | null
          ai_roadmap_data?: RoadmapData | null
          text_extraction_completed_at?: string | null
          ai_analysis_completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
          financial_goal_title?: string | null
          financial_goal_details?: Json | null
          original_file_name?: string | null
          file_type?: string | null
          file_size_bytes?: number | null
          status?: string
          error_message?: string | null
          pdfco_file_id?: string | null
          pdfco_job_id?: string | null
          extracted_text_url?: string | null
          extracted_text?: string | null
          is_likely_credit_report?: boolean | null
          ai_summary?: string | null
          ai_detailed_analysis?: AiDetailedAnalysis | null
          ai_credit_card_recommendations?: AiCreditCardRecommendation[] | null
          ai_side_hustle_recommendations?: AiSideHustleRecommendation[] | null
          ai_roadmap_data?: RoadmapData | null
          text_extraction_completed_at?: string | null
          ai_analysis_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users" // Assuming you have an auth.users table
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        // Assuming this table exists
        Row: {
          id: string
          job_id: string
          user_id: string | null // Should ideally be NOT NULL and match job's user_id
          summary: string | null
          detailed_analysis_json: string | null // Raw JSON from AI for detailed plan
          credit_card_recommendations_json: string | null // Raw JSON
          side_hustle_recommendations_json: string | null // Raw JSON
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          summary?: string | null
          detailed_analysis_json?: string | null
          credit_card_recommendations_json?: string | null
          side_hustle_recommendations_json?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          user_id?: string
          summary?: string | null
          detailed_analysis_json?: string | null
          credit_card_recommendations_json?: string | null
          side_hustle_recommendations_json?: string | null
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// You might also want to export the Row type for convenience
export type AnalysisJob = Database["public"]["Tables"]["analysis_jobs"]["Row"]
// Ensure FinancialGoal type from financial-goals-selector is compatible or use a shared definition
export type { FinancialGoal } from "@/components/financial-goals-selector" // Assuming this path
