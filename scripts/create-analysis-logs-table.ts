/**
 * Migration script to create analysis logs table
 * Run with: npx ts-node scripts/create-analysis-logs-table.ts
 */

import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials. Please check your environment variables.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createAnalysisLogsTable() {
  console.log("Creating analysis_logs table...")

  try {
    // Create the analysis_logs table
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS analysis_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
          user_id UUID,
          event TEXT NOT NULL,
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_analysis_logs_analysis_id ON analysis_logs(analysis_id);
        CREATE INDEX IF NOT EXISTS idx_analysis_logs_user_id ON analysis_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_analysis_logs_event ON analysis_logs(event);
        CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs(created_at);
      `,
    })

    if (error) {
      throw error
    }

    console.log("Successfully created analysis_logs table")

    // Create the system_logs table
    console.log("Creating system_logs table...")

    const { error: systemLogsError } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS system_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          event TEXT NOT NULL,
          user_id UUID,
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_system_logs_event ON system_logs(event);
        CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
      `,
    })

    if (systemLogsError) {
      throw systemLogsError
    }

    console.log("Successfully created system_logs table")

    // Add metrics column to analyses table if it doesn't exist
    console.log("Adding metrics column to analyses table...")

    const { error: alterTableError } = await supabase.rpc("exec_sql", {
      sql: `
        ALTER TABLE analyses ADD COLUMN IF NOT EXISTS metrics JSONB;
        ALTER TABLE analyses ADD COLUMN IF NOT EXISTS error_type TEXT;
      `,
    })

    if (alterTableError) {
      throw alterTableError
    }

    console.log("Successfully added metrics column to analyses table")

    console.log("Migration completed successfully!")
  } catch (error) {
    console.error("Error creating tables:", error)
  }
}

// Run the migration
createAnalysisLogsTable()
