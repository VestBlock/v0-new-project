import { NextRequest, NextResponse } from 'next/server';
import { ensureSignupGrowthSystem } from '@/lib/auth/signup-growth-system';
import { sendUserSignupGrowthSystemReadyEmail } from '@/lib/email/sendEmail';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const email = user.email.trim().toLowerCase();
    const fullName = String(user.user_metadata?.full_name || body?.fullName || '').trim() || null;
    const userId = user.id;
    const skipEmail = body?.skipEmail === true;

    if (!isValidEmail(email)) {
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
