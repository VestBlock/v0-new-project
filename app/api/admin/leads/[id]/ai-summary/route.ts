export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { buildLeadAgentQualification } from '@/lib/ai/leadAgentQualification';
import { buildAiLeadScoreSummary } from '@/lib/ai/leadScoring';
import { buildAiOutreachDraft } from '@/lib/ai/outreachWriter';
import { requireLeadAdmin } from '@/lib/leads/admin-auth';
import { getLeadById } from '@/lib/leads/repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireLeadAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const leadBundle = await getLeadById(id);
    const { lead } = leadBundle;
    const [scoreSummary, outreachDraft] = await Promise.all([
      buildAiLeadScoreSummary(lead),
      buildAiOutreachDraft(lead),
    ]);
    const leadAgentQualification = await buildLeadAgentQualification(leadBundle, {
      scoreSummary,
      outreachDraft,
    })

    return NextResponse.json({
      success: true,
      leadId: id,
      scoreSummary,
      outreachDraft,
      leadAgentQualification,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to build AI summary.',
      },
      { status: 500 }
    );
  }
}
