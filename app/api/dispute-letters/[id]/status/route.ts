export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { markDisputeLetterMailed } from '@/lib/workflows/disputeLetterAutomation';

const supportedStatuses = ['mailed'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const userId = String(body?.userId || '').trim();
    const status = String(body?.status || '').trim().toLowerCase();

    if (!userId) {
      return NextResponse.json({ error: 'userId required.' }, { status: 400 });
    }

    if (!supportedStatuses.includes(status as (typeof supportedStatuses)[number])) {
      return NextResponse.json(
        { error: 'Unsupported dispute-letter status.' },
        { status: 400 }
      );
    }

    const result = await markDisputeLetterMailed({ letterId: id, userId });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Could not update dispute letter.' },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ ok: true, letter: result.letter });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[dispute-letter-status] update failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
