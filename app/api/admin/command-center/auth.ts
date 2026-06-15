import { NextResponse } from 'next/server'

import type { AdminCheck } from '@/lib/auth/admin'

export function commandCenterAuthError(adminCheck: AdminCheck) {
  return NextResponse.json(
    {
      error: adminCheck.user
        ? 'Admin access required.'
        : 'Authentication required.',
    },
    { status: adminCheck.user ? 403 : 401 }
  )
}
