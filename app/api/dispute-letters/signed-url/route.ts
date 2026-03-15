// app/api/dispute-letters/signed-url/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(req: NextRequest) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data: row, error: selErr } = await supabase
    .from('dispute_letters')
    .select('pdf_path,user_id')
    .eq('id', id)
    .single();

  if (selErr || !row || row.user_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: signed, error } = await supabase.storage
    .from('dispute-letters')
    .createSignedUrl(row.pdf_path, 60 * 10); // 10 minutes

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl });
}
