export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/dispute-letters/:id/pdf?userId=...&download=1
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId =
      req.nextUrl.searchParams.get('userId') ||
      req.headers.get('x-user-id') ||
      '';

    const wantDownload = req.nextUrl.searchParams.get('download') === '1';
    if (!userId)
      return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // 1) Look up the letter and authorize
    const { data: row, error } = await supabaseAdmin
      .from('dispute_letters')
      .select('user_id, pdf_path, created_at, bureau, letter_type')
      .eq('id', params.id)
      .maybeSingle();

    if (error || !row)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.user_id !== userId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2) Sign URL from private bucket
    const fileName = `${row.bureau}_${row.letter_type}_${new Date(
      row.created_at
    )
      .toISOString()
      .slice(0, 10)}.pdf`.replace(/\s+/g, '_');

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from('dispute-letters')
      .createSignedUrl(row.pdf_path, 3600, {
        // `download` triggers Content-Disposition for attachment; can pass a filename
        download: wantDownload ? fileName : false,
      });

    if (signErr || !signed?.signedUrl)
      return NextResponse.json(
        { error: 'Could not sign URL' },
        { status: 500 }
      );

    return NextResponse.json({ url: signed.signedUrl });
  } catch (e) {
    console.error('pdf url error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
