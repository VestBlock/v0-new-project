import { NextRequest, NextResponse } from 'next/server';
import { serve } from 'inngest/next';

import { inngest } from '@/lib/inngest/client';
import { processGrowthServiceRequestFunction } from '@/lib/inngest/functions';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inngestHandler = serve({
  client: inngest,
  functions: [processGrowthServiceRequestFunction],
});

function isInngestConfigured() {
  return Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV === '1');
}

export async function GET(request: NextRequest) {
  if (!isInngestConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        'Inngest is installed, but it is not active until INNGEST_EVENT_KEY or INNGEST_DEV=1 is configured.',
    });
  }

  return inngestHandler.GET(request, undefined);
}

export async function POST(request: NextRequest) {
  if (!isInngestConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          'Inngest is not configured. Set INNGEST_EVENT_KEY or INNGEST_DEV=1 before posting workflow events here.',
      },
      { status: 503 }
    );
  }

  return inngestHandler.POST(request, undefined);
}

export async function PUT(request: NextRequest) {
  if (!isInngestConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          'Inngest is not configured. Set INNGEST_EVENT_KEY or INNGEST_DEV=1 before updating workflow state here.',
      },
      { status: 503 }
    );
  }

  return inngestHandler.PUT(request, undefined);
}
