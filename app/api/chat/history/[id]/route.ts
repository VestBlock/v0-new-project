import { NextRequest, NextResponse } from 'next/server';
import { getChatConversation } from '@/lib/chat/history';
import { getSupabaseServer } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await getChatConversation(user.id, id);
    return NextResponse.json({ conversation });
  } catch (error: any) {
    const message = error?.code === 'PGRST116' ? 'Conversation not found' : 'Failed to load conversation';
    const status = error?.code === 'PGRST116' ? 404 : 500;

    console.error('[chat/history/:id] fetch failed:', error);
    return NextResponse.json({ error: message, details: error?.message || 'Unknown error' }, { status });
  }
}
