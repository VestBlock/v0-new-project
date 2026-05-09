export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import type {
  Answers,
  GrantCard,
  GrantSource,
} from '@/lib/grants/match';
import { normalizeAll, shortlist, toCards } from '@/lib/grants/match';
import { grantLetterHtml } from '@/lib/grants/letter';
import raw from '@/data/grants.json'; // typed via resolveJsonModule
import { polishGrantLetter } from '@/lib/grants/openai';
import { createAdminClient } from '@/lib/supabase/admin';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const htmlToPdf = async (html: string) => {
  try {
    const { htmlToPdfBuffer } = await import('@/lib/letters/render');
    return await htmlToPdfBuffer(html);
  } catch {
    return null; // still return HTML if PDF engine isn't available
  }
};

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = (await req.json()) as Answers;
    if (!body?.user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const source = raw as { grants?: GrantSource[] };
    const all = normalizeAll(source.grants ?? []);
    const picks = shortlist(all, body, 5);
    const cards: GrantCard[] = toCards(picks, body);

    let letterHtml = grantLetterHtml({ user: body, cards });

    try {
      letterHtml = await polishGrantLetter(letterHtml, body, cards);
    } catch (error) {
      console.error('[grants/run] letter polish failed:', getErrorMessage(error));
      throw error;
    }

    const pdf = await htmlToPdf(letterHtml);
    let pdfPath: string | null = null;
    if (pdf) {
      pdfPath = `user_${body.user_id}/${Date.now()}_grant_letter.pdf`;
      const up = await supabaseAdmin.storage
        .from('grant-letters')
        .upload(pdfPath, pdf, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (up.error) throw up.error;
    }

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

    let pdfUrl: string | undefined;
    if (row?.pdf_path) {
      const { data: s } = await supabaseAdmin.storage
        .from('grant-letters')
        .createSignedUrl(row.pdf_path, 3600);
      pdfUrl = s?.signedUrl;
    }

    return NextResponse.json({
      cards,
      letterHtml,
      pdfUrl,
      runId: row?.id,
    });
  } catch (error) {
    console.error('[grants/run] request failed:', getErrorMessage(error));
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Failed to run grants' },
      { status: 500 }
    );
  }
}
