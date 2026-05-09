import { NextResponse } from 'next/server';
import { listChatConversations } from '@/lib/chat/history';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await listChatConversations(user.id);
    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('[chat/history] list failed:', error);
    return NextResponse.json(
      { error: 'Failed to load chat history', details: error?.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
