export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getFundingProgressSummary } from '@/lib/funding/repository';
import { requireFundingUser } from '@/lib/funding/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const { searchParams } = new URL(req.url);
  const recommendationId = searchParams.get('recommendationId');
  const supabase = createAdminClient();
  const progress = await getFundingProgressSummary(
    supabase,
    user.id,
    recommendationId
  );

  return NextResponse.json({ progress });
}
