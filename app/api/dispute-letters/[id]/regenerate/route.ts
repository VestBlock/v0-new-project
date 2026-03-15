export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await req.json();
    if (!userId)
      return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // 1) Load the existing row (we will UPDATE it)
    const { data: orig, error }: any = await supabaseAdmin
      .from('dispute_letters')
      .select(
        'id, user_id, bureau, letter_type, items, num_items, html, pdf_path, version'
      )
      .eq('id', params.id)
      .maybeSingle();

    if (error || !orig)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (orig.user_id !== userId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2) Profile for letter header (fallbacks ok)
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name,address_street,address_city,address_state,address_zip')
      .eq('id', userId)
      .maybeSingle();
    console.log('🚀 ~ POST ~ profile:', profile);

    const fullName = profile?.full_name || 'Your Name';
    const addressLine1 = profile?.address_street || 'Address Street';
    const city = profile?.address_city || 'City';
    const state = profile?.address_state || 'ST';
    const zip = profile?.address_zip || '00000';
    const dateISO = new Date().toISOString().slice(0, 10);

    // 1) fetch new body from AI
    const [{ letterHtml }, { htmlToPdfBuffer }, { generateLetterBodyHTML }] =
      await Promise.all([
        import('@/lib/letters/templates'),
        import('@/lib/letters/render'),
        import('@/lib/letters/ai'),
      ]);

    // attempt up to 2 variants if the model happens to echo same text
    const crypto = await import('crypto');
    const prevHash = crypto
      .createHash('sha256')
      .update(String(orig.html || ''), 'utf8')
      .digest('hex');

    async function draftOnce(ver: number) {
      const bodyHtml = await generateLetterBodyHTML({
        fullName,
        addressLine1,
        city,
        state,
        zip,
        bureau: orig.bureau as any,
        letterType: orig.letter_type as any,
        items: Array.isArray(orig.items) ? orig.items : [],
        dateISO,
        version: ver,
        previousHtml: String(orig.html || ''),
      });
      const html = letterHtml({
        fullName,
        addressLine1,
        city,
        state,
        zip,
        bureau: orig.bureau as any,
        letterType: orig.letter_type as any,
        items: Array.isArray(orig.items) ? orig.items : [],
        dateISO,
        bodyHtml, // <-- inject fresh AI body
      });
      const hash = crypto
        .createHash('sha256')
        .update(html, 'utf8')
        .digest('hex');
      return { html, hash };
    }

    const try1 = await draftOnce((orig.version ?? 1) + 1);
    let picked = try1;

    if (try1.hash === prevHash) {
      // rare: re-roll with a different style/version
      const try2 = await draftOnce((orig.version ?? 1) + 2);
      picked = try2.hash !== prevHash ? try2 : try1;
    }

    // 2) PDF bytes
    const pdfBuf = await htmlToPdfBuffer(picked.html);

    // 3) replace the SAME storage object (no new row)
    const storage = supabaseAdmin.storage.from('dispute-letters');
    let rep = await storage.update(orig.pdf_path, pdfBuf, {
      contentType: 'application/pdf',
      cacheControl: '0',
    });
    if (rep.error && /not.*found/i.test(rep.error.message || '')) {
      rep = await storage.upload(orig.pdf_path, pdfBuf, {
        contentType: 'application/pdf',
        cacheControl: '0',
        upsert: true,
      });
    }
    if (rep.error)
      return NextResponse.json(
        { error: 'PDF replace failed' },
        { status: 500 }
      );

    // 4) update the same DB row (bump version + html)
    const nextVersion = (orig.version ?? 1) + 1;
    const { error: updErr } = await supabaseAdmin
      .from('dispute_letters')
      .update({
        html: picked.html,
        num_items: Array.isArray(orig.items)
          ? orig.items.length
          : orig.num_items,
        status: 'Ready',
        version: nextVersion,
        // (optional display fields, only if they exist in your live table)
        account_name:
          Array.isArray(orig.items) && orig.items.length === 1
            ? orig.items[0]?.creditor ||
              orig.items[0]?.account_type ||
              'Account'
            : 'Multiple Accounts',
      })
      .eq('id', orig.id);

    if (updErr) {
      console.error('row update error:', updErr);
      return NextResponse.json({ error: 'Row update failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: orig.id, version: nextVersion });
  } catch (e) {
    console.error('regenerate (replace) error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
