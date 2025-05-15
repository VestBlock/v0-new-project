import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const supabase = createServerSupabaseClient();

    // Get the current user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if the user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Prevent admins from deleting themselves
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete user data in this order to maintain referential integrity
    // 1. Delete chat messages
    await supabase.from('chat_messages').delete().eq('user_id', userId);

    // 2. Delete dispute letters
    await supabase.from('dispute_letters').delete().eq('user_id', userId);

    // 3. Delete notifications
    await supabase.from('notifications').delete().eq('user_id', userId);

    // 4. Delete analyses
    await supabase.from('analyses').delete().eq('user_id', userId);

    // 5. Delete profile
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    // 6. Delete auth user (requires auth admin privileges)
    // Note: In a real app, you might want to use Supabase admin functions to delete the auth user

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete user API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
