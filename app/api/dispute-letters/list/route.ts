// app/api/dispute-letters/list/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
// import { createServerClient } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('dispute_letters')
    .select('id, created_at, bureau, letter_type, num_items, status')
    .order('created_at', { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ letters: data });
}
