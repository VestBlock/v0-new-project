export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { checkAdminAccess } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/system/logEvent';

const leadStatuses = ['new', 'contacted', 'qualified', 'closed'];

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function cleanLeadSearch(value: string) {
  return value.replace(/[,%()]/g, ' ').trim();
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

async function requireLeadAdmin(request: NextRequest) {
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

  if (!adminCheck.isAdmin) {
    return {
      supabaseAdmin,
      user: adminCheck.user,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: adminCheck.user ? 403 : 401 }
      ),
    };
  }

  return { supabaseAdmin, user: adminCheck.user, response: null };
}

export async function GET(request: NextRequest) {
  try {
    const { supabaseAdmin, response } = await requireLeadAdmin(request);
    if (response) return response;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const leadType = searchParams.get('lead_type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (leadType && leadType !== 'all') {
      query = query.eq('lead_type', leadType);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59');
    }

    if (search) {
      const cleanedSearch = cleanLeadSearch(search);
      if (cleanedSearch) {
        query = query.or(
          `name.ilike.%${cleanedSearch}%,email.ilike.%${cleanedSearch}%,phone.ilike.%${cleanedSearch}%`
        );
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: leads, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    return NextResponse.json({
      leads: leads || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });

  } catch (error: any) {
    console.error('Admin leads API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update lead status
export async function PATCH(request: NextRequest) {
  try {
    const { supabaseAdmin, user, response } = await requireLeadAdmin(request);
    if (response) return response;

    const { id, status, notes } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!leadStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid lead status.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lead',
      entityId: id,
      metadata: {
        action: 'lead_updated',
        status,
        notesUpdated: notes !== undefined,
        leadType: data.lead_type,
        leadEmail: data.email,
      },
    });

    return NextResponse.json({ success: true, lead: data });

  } catch (error: any) {
    console.error('Admin leads update error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
