import { NextRequest, NextResponse } from 'next/server';
import { sendUserSignupCreditReportStartEmail } from '@/lib/email/sendEmail';

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

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const result = await sendUserSignupCreditReportStartEmail({
      userEmail: email,
      userId,
      fullName,
    });

    return NextResponse.json({
      ok: Boolean(result?.ok),
      skipped: Boolean((result as { skipped?: boolean } | undefined)?.skipped),
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
