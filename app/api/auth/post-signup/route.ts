import { NextRequest, NextResponse } from 'next/server';
import { ensureSignupGrowthSystem } from '@/lib/auth/signup-growth-system';
import { sendUserSignupGrowthSystemReadyEmail } from '@/lib/email/sendEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const fullName = String(body?.fullName || '').trim() || null;
    const userId = String(body?.userId || '').trim() || null;
    const skipEmail = body?.skipEmail === true;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const provisionResult = await ensureSignupGrowthSystem({ email, userId, fullName });

    if (!provisionResult.ok) {
      return NextResponse.json(
        {
          error: provisionResult.error || 'Unable to provision signup growth system.',
        },
        { status: 500 }
      );
    }

    const emailResult = provisionResult.created && !skipEmail
      ? await sendUserSignupGrowthSystemReadyEmail({
          userEmail: email,
          userId,
          fullName,
        })
      : { ok: true, skipped: true };

    return NextResponse.json({
      ok: true,
      provisioned: true,
      created: provisionResult.created,
      leadId: provisionResult.leadId,
      emailSent: Boolean(emailResult?.ok),
      emailSkipped: Boolean((emailResult as { skipped?: boolean } | undefined)?.skipped),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to process signup email.',
      },
      { status: 500 }
    );
  }
}
