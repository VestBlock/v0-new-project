import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

const statuses = ['open', 'in_progress', 'waiting', 'completed', 'dismissed'];
const priorities = ['low', 'normal', 'high', 'urgent'];

async function requireAdmin() {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return {
      adminCheck,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: adminCheck.user ? 403 : 401 }
      ),
    };
  }

  return { adminCheck, response: null };
}

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const supabase = createAdminClient();
  let query = supabase
    .from('admin_tasks')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && statuses.includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const { adminCheck, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const title = String(body?.title || '').trim();

  if (!title) {
    return NextResponse.json({ error: 'title is required.' }, { status: 400 });
  }

  const priority = priorities.includes(body?.priority) ? body.priority : 'normal';
  const status = statuses.includes(body?.status) ? body.status : 'open';
  const supabase = createAdminClient();

  const payload = {
    title,
    description: body?.description || null,
    task_type: body?.taskType || body?.task_type || 'admin_followup',
    status,
    priority,
    assigned_to: body?.assignedTo || body?.assigned_to || null,
    user_id: body?.userId || body?.user_id || null,
    user_email: body?.userEmail || body?.user_email || null,
    entity_type: body?.entityType || body?.entity_type || null,
    entity_id: body?.entityId || body?.entity_id || null,
    source_event_id: body?.sourceEventId || body?.source_event_id || null,
    due_at: body?.dueAt || body?.due_at || null,
    metadata_json: body?.metadata || body?.metadata_json || {},
    created_by: adminCheck.user?.id || null,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('admin_tasks')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    eventType: 'admin_action',
    actorUserId: adminCheck.user?.id,
    entityType: 'admin_task',
    entityId: data.id,
    metadata: { action: 'task_created', status, priority },
  });

  return NextResponse.json({ task: data });
}

export async function PATCH(request: Request) {
  const { adminCheck, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const taskId = body?.taskId || body?.id;

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};

  if (body?.status !== undefined) {
    if (!statuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid task status.' }, { status: 400 });
    }
    payload.status = body.status;
    payload.completed_at =
      body.status === 'completed' ? new Date().toISOString() : null;
  }

  if (body?.priority !== undefined) {
    if (!priorities.includes(body.priority)) {
      return NextResponse.json({ error: 'Invalid task priority.' }, { status: 400 });
    }
    payload.priority = body.priority;
  }

  if (body?.assignedTo !== undefined) payload.assigned_to = body.assignedTo || null;
  if (body?.dueAt !== undefined) payload.due_at = body.dueAt || null;
  if (body?.description !== undefined) payload.description = body.description || null;
  if (body?.metadata !== undefined) payload.metadata_json = body.metadata || {};

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No task updates provided.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('admin_tasks')
    .update(payload)
    .eq('id', taskId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    eventType: 'admin_action',
    actorUserId: adminCheck.user?.id,
    entityType: 'admin_task',
    entityId: taskId,
    metadata: { action: 'task_updated', updates: payload },
  });

  return NextResponse.json({ task: data });
}
