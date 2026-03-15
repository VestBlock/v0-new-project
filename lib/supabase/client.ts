import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

let supabaseClient: SupabaseClient<Database> | undefined;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Persist & auto-refresh your session in localStorage
        persistSession: true,
        autoRefreshToken: true,

        // ← Generate & store a PKCE code_verifier for you
        flowType: 'pkce',

        // ← On page load, look for ?code=… or ?access_token=… in the URL and
        // automatically swap it for a real session
        detectSessionInUrl: true,
      },
    }
  );

  return supabaseClient;
}
