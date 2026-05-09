import { NextResponse } from 'next/server';
import { z } from 'zod';

import { vestblockAeoTopics } from '@/lib/aeo/topics';
import { checkAdminAccess } from '@/lib/auth/admin';
import { seedVestblockTopicContentAssets } from '@/lib/content/topicSeedAssets';
import { logEvent } from '@/lib/system/logEvent';
import { createAdminClient } from '@/lib/supabase/admin';

const clusterValues = Array.from(
  new Set(vestblockAeoTopics.map((topic) => topic.cluster))
) as [string, ...string[]];

const seedSchema = z.object({
  publish: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  slugs: z.array(z.string()).optional(),
  clusters: z.array(z.enum(clusterValues)).optional(),
  limit: z.number().int().positive().max(100).optional(),
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
      { error: 'Invalid AEO seed request.', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const seeded = await seedVestblockTopicContentAssets({
      supabase,
      actorUserId: adminCheck.user?.id ?? null,
      publish: parsed.data.publish,
      overwrite: parsed.data.overwrite,
      slugs: parsed.data.slugs,
      clusters: parsed.data.clusters as
        | typeof vestblockAeoTopics[number]['cluster'][]
        | undefined,
      limit: parsed.data.limit,
    });

    await logEvent({
      eventType: 'content_generated',
      actorUserId: adminCheck.user?.id,
      entityType: 'content_batch',
      entityId: null,
      metadata: {
        seedType: 'aeo-topic-library',
        seededCount: seeded.length,
        publish: parsed.data.publish,
        overwrite: parsed.data.overwrite,
        clusters: parsed.data.clusters ?? null,
        slugs: parsed.data.slugs ?? null,
        limit: parsed.data.limit ?? null,
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
          error instanceof Error
            ? error.message
            : 'Unable to seed AEO topic pages.',
      },
      { status: 500 }
    );
  }
}
