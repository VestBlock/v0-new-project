import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Analysis = Database['public']['Tables']['analyses']['Row'];
export type CreditScore = Database['public']['Tables']['credit_scores']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type DisputeLetter =
  Database['public']['Tables']['dispute_letters']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Found' : 'Missing');

// Simple client singleton
let supabaseInstance: ReturnType<typeof createClient> | null = null;

// Browser client - with proper error handling
export const supabase = (() => {
  // If environment variables are missing, return a stub client
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: Supabase URL or Anon Key is missing');
    return createStubClient();
  }

  // Return existing instance if available
  if (supabaseInstance) return supabaseInstance;

  try {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  } catch (error) {
    console.error('ERROR: Failed to create Supabase client:', error);
    return createStubClient();
  }
})();

// Create a stub client that gracefully handles errors
function createStubClient() {
  return {
    auth: {
      getSession: async () => ({
        data: { session: null },
        error: new Error('Supabase not initialized'),
      }),
      signOut: async () => ({ error: new Error('Supabase not initialized') }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: null,
            error: new Error('Supabase not initialized'),
          }),
        }),
      }),
    }),
    // Add other stub methods as needed
  } as any;
}

// Helper to check if Supabase is properly initialized
export function isSupabaseInitialized() {
  return !!supabaseUrl && !!supabaseAnonKey && !!supabaseInstance;
}
