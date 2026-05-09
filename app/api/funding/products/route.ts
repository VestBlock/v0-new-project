export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getFundingProducts } from '@/lib/funding/repository';
import { requireFundingUser } from '@/lib/funding/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { user, response } = await requireFundingUser();
  if (response || !user) return response;

  const supabase = createAdminClient();
  const products = await getFundingProducts(supabase);

  return NextResponse.json({ products });
}
