export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

export async function GET() {
  const user = await getServerUser();
  const email = normalizeEmail(user?.email);

  if (!user || !email) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    );
  }

  const admin = createAdminClient();

  const [buyers, lenders, sellerProperties] = await Promise.all([
    admin
      .from('buyers')
      .select(
        'id,name,category,markets_served,relationship_stage,outreach_status,created_at,updated_at'
      )
      .ilike('contact_email', email)
      .order('updated_at', { ascending: false })
      .limit(10),
    admin
      .from('lenders')
      .select(
        'id,name,category,states_served,relationship_stage,outreach_status,created_at,updated_at'
      )
      .ilike('contact_email', email)
      .order('updated_at', { ascending: false })
      .limit(10),
    admin
      .from('leads')
      .select(
        'id,name,email,property_address,city,state,status,created_at,updated_at'
      )
      .eq('lead_type', 'sell_house')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const errors = [
    buyers.error ? 'Buyer profiles could not be loaded.' : '',
    lenders.error ? 'Lender profiles could not be loaded.' : '',
    sellerProperties.error ? 'Seller properties could not be loaded.' : '',
  ].filter(Boolean);

  return NextResponse.json({
    buyerProfiles: buyers.data || [],
    lenderProfiles: lenders.data || [],
    sellerProperties: sellerProperties.data || [],
    errors,
  });
}
