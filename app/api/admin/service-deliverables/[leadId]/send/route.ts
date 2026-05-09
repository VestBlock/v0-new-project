export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { checkAdminAccess } from '@/lib/auth/admin';
import { sendUserServiceDeliverableReadyEmail } from '@/lib/email/sendEmail';
import {
  getServiceDeliverableForLead,
  markServiceDeliverableSent,
} from '@/lib/services/aiServiceDeliverables';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

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
        user,
        response: isAdmin
          ? null
          : NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }
  }

  const adminCheck = await checkAdminAccess();
  return {
    user: adminCheck.user,
    response: adminCheck.isAdmin
      ? null
      : NextResponse.json(
          { error: 'Admin access required.' },
          { status: adminCheck.user ? 403 : 401 }
        ),
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const { leadId } = await context.params;
  const admin = createAdminClient();

  const { data: lead, error: leadError } = await admin
    .from('leads')
    .select('id,name,email,form_data')
    .eq('id', leadId)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json(
      { error: 'Lead does not have an email address for delivery.' },
      { status: 400 }
    );
  }

  const deliverableResult = await getServiceDeliverableForLead(leadId);
  if (!deliverableResult.ok || !deliverableResult.deliverable) {
    return NextResponse.json(
      { error: 'No service deliverable is available for this lead yet.' },
      { status: 400 }
    );
  }

  const deliverable = deliverableResult.deliverable;
  if (deliverable.status === 'generating' || deliverable.status === 'requested') {
    return NextResponse.json(
      { error: 'This deliverable is still being prepared.' },
      { status: 400 }
    );
  }

  const deliverableJson =
    deliverable.deliverableJson && typeof deliverable.deliverableJson === 'object'
      ? deliverable.deliverableJson
      : {};

  const recommendedActions = Array.isArray((deliverableJson as any).recommendedActions)
    ? (deliverableJson as any).recommendedActions
    : [];
  const customerMessage =
    typeof (deliverableJson as any).customerMessage === 'string'
      ? (deliverableJson as any).customerMessage
      : null;

  const emailResult = await sendUserServiceDeliverableReadyEmail({
    userEmail: lead.email,
    packageTitle: deliverable.title || 'VestBlock service deliverable',
    summary: deliverable.summary || deliverable.previewText || 'Your service deliverable is ready.',
    recommendedActions,
    customerMessage,
  });

  if (!emailResult.ok) {
    return NextResponse.json(
      { error: emailResult.error || 'Unable to send deliverable email.' },
      { status: 500 }
    );
  }

  await markServiceDeliverableSent({
    leadId,
    packageKey: deliverable.packageKey,
    title: deliverable.title,
    summary: deliverable.summary,
    previewText: deliverable.previewText,
    deliverableJson: deliverable.deliverableJson || {},
    deliverableMarkdown: deliverable.deliverableMarkdown,
    generatedAt: deliverable.generatedAt,
    providerMessageId: emailResult.id ?? null,
  });

  await logEvent({
    eventType: 'service_deliverable_sent',
    actorUserId: user?.id,
    entityType: 'lead',
    entityId: leadId,
    metadata: {
      packageKey: deliverable.packageKey,
      leadEmail: lead.email,
      providerMessageId: emailResult.id ?? null,
    },
  });

  const refreshed = await getServiceDeliverableForLead(leadId);

  return NextResponse.json({
    success: true,
    deliverable: refreshed.ok ? refreshed.deliverable : null,
  });
}
