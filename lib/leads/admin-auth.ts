import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

async function isAdminUser(user: User) {
  const email = user.email?.toLowerCase()
  if (email && configuredAdminEmails().includes(email)) {
    return true
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  return profile?.role === 'admin'
}

export async function requireLeadAdmin(request?: NextRequest) {
  const admin = createAdminClient()

  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length)
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token)

      if (!error && user) {
        if (await isAdminUser(user)) {
          return { admin, user, response: null as NextResponse | null }
        }

        return {
          admin,
          user,
          response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }),
        }
      }
    }
  }

  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return {
      admin,
      user: adminCheck.user,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: adminCheck.user ? 403 : 401 }
      ),
    }
  }

  return { admin, user: adminCheck.user, response: null as NextResponse | null }
}
