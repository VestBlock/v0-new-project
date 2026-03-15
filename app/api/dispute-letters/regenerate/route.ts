// app/api/dispute-letters/regenerate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { htmlToPdfBuffer } from '@/lib/letters/render';
import { letterHtml, LetterPayload } from '@/lib/letters/templates';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: NextRequest) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data: row, error: selErr } = await supabase
    .from('dispute_letters')
    .select('*')
    .eq('id', id)
    .single();

  if (selErr || !row || row.user_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // mark regenerating
  await supabase
    .from('dispute_letters')
    .update({ status: 'Regenerating' })
    .eq('id', id);

  try {
    // Reuse same items and payload, bump version
    const payload: LetterPayload = {
      fullName:
        row.items?.fullName ?? user.user_metadata?.full_name ?? 'Your Name',
      addressLine1: user.user_metadata?.address_line1 ?? 'Address Line 1',
      addressLine2: user.user_metadata?.address_line2 ?? '',
      city: user.user_metadata?.city ?? 'City',
      state: user.user_metadata?.state ?? 'ST',
      zip: user.user_metadata?.zip ?? '00000',
      dateISO: new Date().toISOString().slice(0, 10),
      bureau: row.bureau,
      letterType: row.letter_type,
      items: row.items,
    };

    const html = letterHtml(payload);
    const pdf = await htmlToPdfBuffer(html);

    const pdfPath = `user_${user.id}/${
      row.bureau
    }/${Date.now()}_${row.letter_type.replace(/\s+/g, '_')}_v${
      (row.version || 1) + 1
    }.pdf`;
    const upPdf = await supabase.storage
      .from('dispute-letters')
      .upload(pdfPath, pdf, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (upPdf.error) throw upPdf.error;

    const { error: updErr } = await supabase
      .from('dispute_letters')
      .update({
        html,
        pdf_path: pdfPath,
        status: 'Ready',
        version: (row.version || 1) + 1,
      })
      .eq('id', id);

    if (updErr) throw updErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await supabase
      .from('dispute_letters')
      .update({ status: 'Error' })
      .eq('id', id);
    return NextResponse.json(
      { error: e?.message ?? 'regenerate failed' },
      { status: 500 }
    );
  }
}
