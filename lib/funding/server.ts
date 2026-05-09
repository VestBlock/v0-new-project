import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/admin';

export async function requireFundingUser() {
  const user = await getServerUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      ),
    };
  }

  return { user, response: null };
}
