import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function getSupabaseServerSingleton() {
  const cookieStorePromise = cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: async (name: string) => {
        const cookieStore = await cookieStorePromise;
        return cookieStore.get(name)?.value;
      },
      set: async (name: string, value: string, options: CookieOptions) => {
        try {
          const cookieStore = await cookieStorePromise;
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components can read cookies but cannot always write them.
        }
      },
      remove: async (name: string, options: CookieOptions) => {
        try {
          const cookieStore = await cookieStorePromise;
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Server Components can read cookies but cannot always write them.
        }
      },
    },
  });
}

export const createSupabaseServerClientForTest = getSupabaseServerSingleton;
export const createClient = getSupabaseServerSingleton;
export const getSupabaseServer = getSupabaseServerSingleton;
