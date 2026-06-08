export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/admin';
import { ensureSignupGrowthSystem } from '@/lib/auth/signup-growth-system';
import { getServiceDeliverableForLead } from '@/lib/services/aiServiceDeliverables';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const user = await getServerUser();

  if (!user?.email) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  await ensureSignupGrowthSystem({
    email: user.email,
    userId: user.id,
    fullName:
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null,
  });

  const supportedLeadTypes = ['business_funding', 'ai_assistant', 'website_upgrade', 'visibility_expansion'];
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,name,email,created_at,updated_at,form_data,status,lead_type')
    .eq('email', user.email)
    .in('lead_type', supportedLeadTypes)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Unable to load your services right now.' },
      { status: 500 }
    );
  }

  const deliverables = await Promise.all(
    (leads || []).map(async (lead) => {
      const loaded = await getServiceDeliverableForLead(lead.id);
      const deliverable = loaded.ok ? loaded.deliverable : null;
      return {
        leadId: lead.id,
        submittedAt: lead.created_at,
        updatedAt: lead.updated_at,
        leadStatus: lead.status,
        packageKey: String(lead.form_data?.packageKey || ''),
        packageTitle:
          String(lead.form_data?.packageTitle || '') || 'VestBlock service request',
        businessName: String(lead.form_data?.businessName || ''),
        primaryGoal: String(lead.form_data?.primaryGoal || ''),
        templateKey: String(lead.form_data?.templateKey || ''),
        templateTitle: String(lead.form_data?.templateTitle || ''),
        templateIndustry: String(lead.form_data?.templateIndustry || ''),
        templateFirstFocus: Array.isArray(lead.form_data?.templateFirstFocus)
          ? lead.form_data.templateFirstFocus.filter(
              (item: unknown): item is string =>
                typeof item === 'string' && item.trim().length > 0
            )
          : [],
        deliverable,
      };
    })
  );

  const markViewed = ['1', 'true', 'yes'].includes(new URL(request.url).searchParams.get('markViewed')?.toLowerCase() || '')
  if (markViewed) {
    const viewedLeadIds = deliverables
      .filter((item) => item.deliverable?.status === 'sent_to_client' && !item.deliverable?.customerViewedAt)
      .map((item) => item.leadId)

    if (viewedLeadIds.length) {
      await admin
        .from('service_deliverables')
        .update({
          customer_viewed_at: new Date().toISOString(),
          customer_response_status: 'viewed',
        })
        .in('lead_id', viewedLeadIds)
    }
  }

  return NextResponse.json({ deliverables });
}
