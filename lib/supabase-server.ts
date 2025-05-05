import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

// Re-export types from client
export type {
  Profile,
  Analysis,
  CreditScore,
  Notification,
  ChatMessage,
  DisputeLetter,
  Note,
} from './supabase-client';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server client
export function createServerSupabaseClient() {
  // Early return with clear error if env vars are missing
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Cannot create server Supabase client: Missing URL or Anon Key'
    );
  }

  const cookieStore = cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
}

// Admin client
export function createAdminSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Cannot create admin Supabase client: Missing URL or Service Key'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}
