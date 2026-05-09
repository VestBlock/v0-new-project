export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateAndStoreServiceDeliverable,
  getServiceDeliverableForLead,
} from '@/lib/services/aiServiceDeliverables';
import { isServicePackageKey } from '@/lib/services/servicePackages';

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdminUser(user: User, supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const email = user.email?.toLowerCase();
  if (email && configuredAdminEmails().includes(email)) {
    return true;
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  return profile?.role === 'admin';
}

async function requireAdmin(request: NextRequest) {
  const supabaseAdmin = createAdminClient();
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (!authError && user) {
      const isAdmin = await isAdminUser(user, supabaseAdmin);
      return {
        supabaseAdmin,
        user,
        response: isAdmin
          ? null
          : NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }
  }

  const adminCheck = await checkAdminAccess();
  return {
    supabaseAdmin,
    user: adminCheck.user,
    response: adminCheck.isAdmin
      ? null
      : NextResponse.json(
          { error: 'Admin access required.' },
          { status: adminCheck.user ? 403 : 401 }
        ),
  };
}

async function loadLeadForDeliverable(leadId: string) {
  const supabaseAdmin = createAdminClient();
  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .select('id,name,email,phone,form_data')
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return lead;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { leadId } = await context.params;
  const result = await getServiceDeliverableForLead(leadId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Unable to load service deliverable.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ deliverable: result.deliverable });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { leadId } = await context.params;
  const lead = await loadLeadForDeliverable(leadId);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  const formData =
    lead.form_data && typeof lead.form_data === 'object' ? lead.form_data : {};
  const rawPackageKey = String(formData.packageKey || '');

  if (!isServicePackageKey(rawPackageKey)) {
    return NextResponse.json(
      { error: 'This lead does not have a supported service package attached.' },
      { status: 400 }
    );
  }

  const result = await generateAndStoreServiceDeliverable({
    leadId,
    packageKey: rawPackageKey,
    leadName: lead.name,
    leadEmail: lead.email,
    businessName: String(formData.businessName || ''),
    primaryGoal: String(formData.primaryGoal || formData.biggestGap || formData.message || ''),
    monthlyRevenueRange: String(formData.monthlyRevenueRange || formData.monthlyRevenueGoal || ''),
    creditScoreRange: String(formData.creditScoreRange || formData.credit_score || ''),
    timeline: String(formData.timeline || formData.cityFocus || formData.monthlyLeadVolume || ''),
    notes: String(formData.notes || ''),
    formData,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Unable to generate service deliverable.' },
      { status: 500 }
    );
  }

  const persisted = await getServiceDeliverableForLead(leadId);

  return NextResponse.json({
    success: true,
    deliverable: persisted.ok ? persisted.deliverable : null,
  });
}
