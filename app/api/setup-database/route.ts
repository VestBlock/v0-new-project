export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = getSupabaseServer()

    // SQL setup script
    const setupSQL = `
-- Enable the necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  credit_score INTEGER,
  goals TEXT,
  income NUMERIC,
  business_ein TEXT,
  country TEXT DEFAULT 'United States',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'dispute_letter', 'credit_report', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit reports table
CREATE TABLE IF NOT EXISTS credit_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_text TEXT,
  credit_score INTEGER,
  negative_items JSONB,
  accounts JSONB,
  inquiries JSONB,
  public_records JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dispute letters table
CREATE TABLE IF NOT EXISTS dispute_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  letter_type TEXT NOT NULL, -- '609', 'goodwill', 'pay_for_delete', etc.
  creditor_name TEXT,
  account_number TEXT,
  letter_content TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'responded'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_letters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY IF NOT EXISTS "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for chat_history
CREATE POLICY IF NOT EXISTS "Users can view their own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for user_documents
CREATE POLICY IF NOT EXISTS "Users can view their own documents"
  ON user_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own documents"
  ON user_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for credit_reports
CREATE POLICY IF NOT EXISTS "Users can view their own credit reports"
  ON credit_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own credit reports"
  ON credit_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for dispute_letters
CREATE POLICY IF NOT EXISTS "Users can view their own dispute letters"
  ON dispute_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own dispute letters"
  ON dispute_letters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own dispute letters"
  ON dispute_letters FOR UPDATE
  USING (auth.uid() = user_id);
`

    // Execute the SQL script
    const { error } = await supabase.rpc("pgclient", { query: setupSQL })

    if (error) {
      console.error("Database setup error:", error)
      return NextResponse.json(
        {
          error: `Failed to run database setup: ${error.message}`,
          output: error.message,
        },
        { status: 500 },
      )
    }

    // Try to create storage buckets
    let output = "Database tables created successfully.\n\n"

    try {
      // Check if buckets exist first
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

      if (!bucketsError) {
        const existingBuckets = buckets?.map((b) => b.name) || []

        // Create credit-reports bucket if it doesn't exist
        if (!existingBuckets.includes("credit-reports")) {
          const { error: createError } = await supabase.storage.createBucket("credit-reports", {
            public: false,
            fileSizeLimit: 10485760, // 10MB
          })

          if (createError) {
            output += `Failed to create credit-reports bucket: ${createError.message}\n`
          } else {
            output += "Created credit-reports bucket successfully.\n"

            // Add bucket policies
            const { error: policyError } = await supabase.rpc("pgclient", {
              query: `
                BEGIN;
                
                -- For credit-reports bucket
                CREATE POLICY IF NOT EXISTS "Allow users to upload their own credit reports"
                ON storage.objects FOR INSERT
                TO authenticated
                WITH CHECK (
                  bucket_id = 'credit-reports' AND
                  auth.uid()::text = (storage.foldername(name))[1]
                );
                
                CREATE POLICY IF NOT EXISTS "Allow users to read their own credit reports"
                ON storage.objects FOR SELECT
                TO authenticated
                USING (
                  bucket_id = 'credit-reports' AND
                  auth.uid()::text = (storage.foldername(name))[1]
                );
                
                COMMIT;
              `,
            })

            if (policyError) {
              output += `Failed to create credit-reports bucket policies: ${policyError.message}\n`
            } else {
              output += "Created credit-reports bucket policies successfully.\n"
            }
          }
        } else {
          output += "credit-reports bucket already exists.\n"
        }

        // Create dispute-letters bucket if it doesn't exist
        if (!existingBuckets.includes("dispute-letters")) {
          const { error: createError } = await supabase.storage.createBucket("dispute-letters", {
            public: false,
            fileSizeLimit: 5242880, // 5MB
          })

          if (createError) {
            output += `Failed to create dispute-letters bucket: ${createError.message}\n`
          } else {
            output += "Created dispute-letters bucket successfully.\n"

            // Add bucket policies
            const { error: policyError } = await supabase.rpc("pgclient", {
              query: `
                BEGIN;
                
                -- For dispute-letters bucket
                CREATE POLICY IF NOT EXISTS "Allow users to upload their own dispute letters"
                ON storage.objects FOR INSERT
                TO authenticated
                WITH CHECK (
                  bucket_id = 'dispute-letters' AND
                  auth.uid()::text = (storage.foldername(name))[1]
                );
                
                CREATE POLICY IF NOT EXISTS "Allow users to read their own dispute letters"
                ON storage.objects FOR SELECT
                TO authenticated
                USING (
                  bucket_id = 'dispute-letters' AND
                  auth.uid()::text = (storage.foldername(name))[1]
                );
                
                COMMIT;
              `,
            })

            if (policyError) {
              output += `Failed to create dispute-letters bucket policies: ${policyError.message}\n`
            } else {
              output += "Created dispute-letters bucket policies successfully.\n"
            }
          }
        } else {
          output += "dispute-letters bucket already exists.\n"
        }
      } else {
        output += `Failed to check existing buckets: ${bucketsError.message}\n`
      }
    } catch (e) {
      output += `Error creating storage buckets: ${e instanceof Error ? e.message : String(e)}\n`
    }

    return NextResponse.json({
      success: true,
      output,
    })
  } catch (error) {
    console.error("Database setup error:", error)
    return NextResponse.json(
      {
        error: `Failed to run database setup: ${error instanceof Error ? error.message : String(error)}`,
        output: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    )
  }
}
