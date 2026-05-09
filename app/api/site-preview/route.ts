export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateSitePreview } from '@/lib/services/sitePreview';

const sitePreviewSchema = z.object({
  websiteUrl: z.string().trim().min(3).max(240),
  businessName: z.string().trim().max(160).optional().or(z.literal('')),
  industry: z.string().trim().max(120).optional().or(z.literal('')),
  primaryOffer: z.string().trim().max(180).optional().or(z.literal('')),
  cityFocus: z.string().trim().max(180).optional().or(z.literal('')),
  packageType: z.enum(['ai_assistant', 'visibility_expansion']),
});

export async function POST(req: Request) {
  try {
    const parsed = sitePreviewSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Enter a valid website URL to generate a preview.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const preview = await generateSitePreview(parsed.data);
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to generate the website preview right now.',
      },
      { status: 500 }
    );
  }
}
