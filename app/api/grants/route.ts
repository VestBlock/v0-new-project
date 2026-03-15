export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  Answers,
  Grant,
  GrantCard,
  GrantSource,
} from '@/lib/grants/match';
import { normalizeAll, shortlist, toCards } from '@/lib/grants/match';
import { grantLetterHtml } from '@/lib/grants/letter';
import raw from '@/data/grants.json'; // typed via resolveJsonModule
import { polishGrantLetter } from '@/lib/grants/openai';
// lazy import for PDF (keeps edge bundles small)
const htmlToPdf = async (html: string) => {
  try {
    const { htmlToPdfBuffer } = await import('@/lib/letters/render');
    return await htmlToPdfBuffer(html);
  } catch {
    return null; // still return HTML if PDF engine isn't available
  }
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Answers;
    if (!body?.user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    console.log('🚀 ~ POST ~ grants:', raw);
    // const all = (grants as unknown as Grant[]).filter(
    //   (g) => g?.name && g?.link
    // );
    const all = normalizeAll((raw as any).grants as GrantSource[]);
    console.log('🚀 ~ POST ~ all:', all);
    const picks = shortlist(all, body, 5);
    const cards: GrantCard[] = toCards(picks, body);

    // Build letter HTML (optionally you can refine with OpenAI later—grounded by these cards). :contentReference[oaicite:4]{index=4}
    let letterHtml = grantLetterHtml({ user: body, cards });

    try {
      letterHtml = await polishGrantLetter(letterHtml, body, cards);
    } catch (error) {
      console.log('🚀 ~ POST ~ error:', error);
      throw error;
    }

    // Render PDF (optional)
    const pdf = await htmlToPdf(letterHtml);
    let pdfPath: string | null = null;
    if (pdf) {
      pdfPath = `user_${body.user_id}/${Date.now()}_grant_letter.pdf`;
      const up = await supabaseAdmin.storage
        .from('grant-letters')
        .upload(pdfPath, pdf, {
          contentType: 'application/pdf',
          upsert: false,
        }); // standard upload API :contentReference[oaicite:5]{index=5}
      if (up.error) throw up.error;
    }

    // Save run
    const { data: row, error: insErr } = await supabaseAdmin
      .from('grant_runs')
      .insert({
        user_id: body.user_id,
        answers: body,
        grants: cards,
        letter_html: letterHtml,
        pdf_path: pdfPath,
        // version: 1,
      })
      .select('id, pdf_path')
      .single();
    if (insErr) throw insErr;

    // Sign URL for immediate download (client can also sign later) :contentReference[oaicite:6]{index=6}
    let pdfUrl: string | undefined;
    if (row?.pdf_path) {
      const { data: s } = await supabaseAdmin.storage
        .from('grant-letters')
        .createSignedUrl(row.pdf_path, 3600); // 1 hour
      pdfUrl = s?.signedUrl;
    }

    return NextResponse.json({
      cards,
      letterHtml,
      pdfUrl,
      runId: row?.id,
    });
  } catch (e: any) {
    console.error('grants/run error', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to run grants' },
      { status: 500 }
    );
  }
}
