import { catalog } from '@/data/biz_credit_catalog.json';
import { htmlToPdfBuffer } from '@/lib/letters/render';
import { Roadmap } from '@/lib/bizcredit/match';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildRoadmap } from '@/lib/bizcredit/engine';
import { roadmapHtml } from '@/lib/bizcredit/letter';
import OpenAI from 'openai';
import { rewriteReasonsJSON } from '@/lib/bizcredit/rewriteReasonsJSON';

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json().catch(() => ({}));

    const { data: row, error } = await admin
      .from('business_roadmaps')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const answers = body?.answers ?? row.answers;
    const nextVersion = (row.version ?? 1) + 1;

    // Build a *different* mix:
    const prevIds = [
      ...(row.roadmap?.steps?.vendors ?? []).map((x: any) => x.id),
      ...(row.roadmap?.steps?.monitoring ?? []).map((x: any) => x.id),
      ...(row.roadmap?.steps?.cards ?? []).map((x: any) => x.id),
      ...(row.roadmap?.steps?.lenders ?? []).map((x: any) => x.id),
    ];
    let roadmap = buildRoadmap(answers, catalog as any, {
      excludeIds: prevIds,
      seed: nextVersion,
    });

    // If catalog small and exclude removes too many, fall back to seeded shuffle only:
    const totalNew =
      roadmap.steps.vendors.length +
      roadmap.steps.monitoring.length +
      roadmap.steps.cards.length +
      roadmap.steps.lenders.length;
    if (totalNew < 6) {
      roadmap = buildRoadmap(answers, catalog as any, { seed: nextVersion });
    }

    // Reword reasons via GPT (structured JSON)
    const rewritten = await rewriteReasonsJSON(answers, roadmap);
    roadmap = { steps: { ...roadmap.steps, ...rewritten } };

    // Fresh HTML
    const html = roadmapHtml({
      a: answers,
      r: roadmap,
      dateISO: new Date().toISOString().slice(0, 10),
    });

    // Overwrite (or version) PDF and save everything
    const pdfBuf = await htmlToPdfBuffer(html);
    const bucket = 'biz-roadmaps';
    const newPath = row.pdf_path; // or use a versioned filename if you prefer
    const up = await admin.storage.from(bucket).upload(newPath, pdfBuf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (up.error) throw up.error;

    const { data: updated, error: updErr } = await admin
      .from('business_roadmaps')
      .update({
        answers,
        steps: roadmap.steps, // store the new structured steps (with rewritten reasons)
        html,
        version: nextVersion,
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (updErr) throw updErr;

    const { data: signed } = await admin.storage
      .from(bucket)
      .createSignedUrl(newPath, 3600);

    return NextResponse.json({
      row: updated,
      html,
      roadmap,
      pdfUrl: signed?.signedUrl,
    });
  } catch (e: any) {
    console.error('biz-credit/regenrate error', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to generate roadmap' },
      { status: 500 }
    );
  }
}
// return NextResponse.json({ roadmap, html, pdfUrl, runId: row?.id });
