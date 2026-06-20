import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'This legacy PayPal webhook endpoint is retired. Use /api/webhook, which verifies PayPal signatures.',
    },
    { status: 410 }
  );
}
