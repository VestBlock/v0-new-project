export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import type { BizAnswers } from '@/lib/bizcredit/match';
import { buildRoadmap } from '@/lib/bizcredit/match';
import { roadmapHtml } from '@/lib/bizcredit/letter';
import catalog from '@/data/biz_credit_catalog.json';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerUser } from '@/lib/auth/admin';
// lazy pdf (same renderer you already use)
const toPdf = async (html: string) => {
  try {
    const { htmlToPdfBuffer } = await import('@/lib/letters/render');
    return await htmlToPdfBuffer(html);
  } catch {
    return null;
  }
};

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const supabaseAdmin = createAdminClient();
    const submitted = (await req.json()) as BizAnswers;
    const a = { ...submitted, user_id: user.id } as BizAnswers;

    const roadmap = buildRoadmap(a, catalog as any);
    const html = roadmapHtml({ a, r: roadmap });

    // optional polish (keeps HTML, edits tone only). If you don’t want AI here, delete.
    // try {
    //   const { polishGrantLetter } = await import('@/lib/grants/openai'); // reuse helper
    //   html = await polishGrantLetter(html as any, a as any, []); // cards [] ignored
    // } catch {}

    // PDF to private bucket
    let pdfPath: string | null = null,
      pdfUrl: string | undefined;
    const pdf = await toPdf(html);
    if (pdf) {
      pdfPath = `user_${user.id}/${Date.now()}_biz_roadmap.pdf`;
      const up = await supabaseAdmin.storage
        .from('biz-roadmaps')
        .upload(pdfPath, pdf, {
          contentType: 'application/pdf',
          upsert: false,
        }); // upload API :contentReference[oaicite:2]{index=2}
      if (up.error) throw up.error;

      const { data: s } = await supabaseAdmin.storage
        .from('biz-roadmaps')
        .createSignedUrl(pdfPath, 3600); // signed URL for 1h :contentReference[oaicite:3]{index=3}
      pdfUrl = s?.signedUrl;
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from('business_roadmaps')
      .insert({
        user_id: user.id,
        answers: a,
        steps: roadmap.steps,
        html,
        pdf_path: pdfPath,
        version: 1,
      })
      .select('id, pdf_path')
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ roadmap, html, pdfUrl, runId: row?.id });
  } catch (e: any) {
    console.error('biz-credit/run error', e);
    return NextResponse.json({ error: 'Failed to generate roadmap' }, { status: 500 });
  }
}
