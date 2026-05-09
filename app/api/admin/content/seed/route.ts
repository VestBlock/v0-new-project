import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkAdminAccess } from '@/lib/auth/admin';
import { logEvent } from '@/lib/system/logEvent';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  seedVestblockContentAssets,
  vestblockSeedContentAssets,
} from '@/lib/content/seedAssets';

const seedSchema = z.object({
  publish: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(true),
  slugs: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    );
  }

  const parsed = seedSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid seed request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const seeded = await seedVestblockContentAssets({
      supabase,
      actorUserId: adminCheck.user?.id ?? null,
      publish: parsed.data.publish,
      overwrite: parsed.data.overwrite,
      slugs: parsed.data.slugs,
    });

    await logEvent({
      eventType: 'content_generated',
      actorUserId: adminCheck.user?.id,
      entityType: 'content_batch',
      entityId: null,
      metadata: {
        seedType: 'launch-content',
        seededCount: seeded.length,
        publish: parsed.data.publish,
        slugs:
          parsed.data.slugs && parsed.data.slugs.length > 0
            ? parsed.data.slugs
            : vestblockSeedContentAssets.map((asset) => asset.slug),
      },
    });

    return NextResponse.json({
      seededCount: seeded.length,
      contentAssets: seeded,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to seed content assets.',
      },
      { status: 500 }
    );
  }
}
