export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFundingEvent } from '@/lib/funding/events';
import { getLatestFundingProfile } from '@/lib/funding/repository';
import { fundingProfileSchema } from '@/lib/funding/schemas';
import { requireFundingUser } from '@/lib/funding/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const supabase = createAdminClient();
  const profile = await getLatestFundingProfile(supabase, user.id);

  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const parsed = fundingProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid funding profile.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const payload = {
    user_id: user.id,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('funding_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[funding-profile] save failed:', error);
    return NextResponse.json(
      { error: 'Unable to save funding profile.' },
      { status: 500 }
    );
  }

  await recordFundingEvent({
    userId: user.id,
    eventType: 'profile_saved',
    adminEventType: 'funding_profile_saved',
    entityId: data.id,
    metadata: {
      mode: data.mode,
      ficoEstimate: data.fico_estimate,
      utilization: data.credit_utilization,
    },
  });

  return NextResponse.json({ profile: data });
}
