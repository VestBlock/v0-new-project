export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isTrustedMutationOrigin } from '@/lib/security/sameOrigin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  requestId: z.string().uuid(),
  requestType: z.enum(['access', 'correction', 'export', 'deletion', 'restriction']),
  details: z.string().trim().max(1000).default(''),
});

export async function POST(request: Request) {
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data-rights request.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in before submitting a data-rights request.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const rightsPayload = {
    id: parsed.data.requestId,
    user_id: user.id,
    request_type: parsed.data.requestType,
    status: 'received',
    details: parsed.data.details || null,
    source: 'authenticated_web',
    received_at: now,
  };

  const { error: rightsError } = await admin
    .from('data_rights_requests')
    .upsert(rightsPayload, { onConflict: 'id', ignoreDuplicates: true });

  const taskPayload = {
      title: `Review ${parsed.data.requestType} data-rights request`,
      description: parsed.data.details || 'Authenticated request submitted without additional detail.',
      task_type: 'data_rights_request',
      status: 'open',
      priority: parsed.data.requestType === 'deletion' ? 'high' : 'normal',
      user_id: user.id,
      user_email: user.email || null,
      entity_type: 'data_rights_request',
      entity_id: parsed.data.requestId,
      metadata_json: { requestType: parsed.data.requestType, receivedAt: now },
  };

  const { data: existingTask, error: lookupError } = await admin
    .from('admin_tasks')
    .select('id')
    .eq('task_type', taskPayload.task_type)
    .eq('entity_type', taskPayload.entity_type)
    .eq('entity_id', taskPayload.entity_id)
    .maybeSingle();
  const taskError = lookupError || (existingTask ? null : (await admin.from('admin_tasks').insert(taskPayload)).error);

  if (taskError) {
    console.error('[privacy-request] task creation failed:', taskError.message);
    return NextResponse.json({ error: 'Unable to record the request.' }, { status: 500 });
  }

  if (rightsError) {
    console.warn('[privacy-request] rights ledger unavailable:', rightsError.message);
  }

  return NextResponse.json({ success: true, requestId: parsed.data.requestId }, { status: 202 });
}
