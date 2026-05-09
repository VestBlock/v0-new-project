export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyticsServerEnabled } from '@/lib/analytics/server';

export async function GET() {
  const startedAt = Date.now();
  const services = {
    analytics: analyticsServerEnabled(),
    supabase: false,
  };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('leads')
      .select('id', { head: true, count: 'estimated' })
      .limit(1);

    if (error) {
      throw error;
    }

    services.supabase = true;

    return NextResponse.json({
      ok: true,
      status: 'healthy',
      runtime: 'nodejs',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      services,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[health] check failed:', error);

    return NextResponse.json(
      {
        ok: false,
        status: 'degraded',
        runtime: 'nodejs',
        services,
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        error:
          process.env.NODE_ENV === 'production'
            ? 'Health check failed'
            : error?.message || 'Health check failed',
      },
      { status: 503 }
    );
  }
}
