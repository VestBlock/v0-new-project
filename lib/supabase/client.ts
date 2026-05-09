import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

let supabaseClient: SupabaseClient<Database> | undefined;
let missingEnvServerPlaceholder: SupabaseClient<Database> | undefined;

function createServerPlaceholderClient() {
  if (missingEnvServerPlaceholder) {
    return missingEnvServerPlaceholder;
  }

  const placeholder = new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(
          `[supabase-client] Attempted to access "${String(
            property
          )}" while rendering without Supabase browser env vars.`
        );
      },
    }
  ) as SupabaseClient<Database>;

  missingEnvServerPlaceholder = placeholder;
  return placeholder;
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      return createServerPlaceholderClient();
    }

    throw new Error(
      'Supabase browser env vars are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  supabaseClient = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
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
