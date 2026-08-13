import { NextRequest, NextResponse } from 'next/server'

import { ensureSignupGrowthSystem } from '@/lib/auth/signup-growth-system'
import { getSafeAuthReturnPath, normalizeMemberRoles } from '@/lib/auth/intent'
import { sendUserSignupGrowthSystemReadyEmail } from '@/lib/email/sendEmail'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function privateRedirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = getSafeAuthReturnPath(
    request.nextUrl.searchParams.get('next'),
    '/dashboard/services'
  )
  const isRecovery = request.nextUrl.searchParams.get('intent') === 'recovery'

  if (!code) {
    return privateRedirect(request, `/login?auth_error=invalid_link&next=${encodeURIComponent(next)}`)
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.warn('[auth-callback] Code exchange failed:', error.message)
    return privateRedirect(request, `/login?auth_error=expired_link&next=${encodeURIComponent(next)}`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (user && !isRecovery) {
    const memberRoles = normalizeMemberRoles(user.user_metadata?.member_roles)
    if (memberRoles.length > 0) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ member_roles: memberRoles })
        .eq('id', user.id)
      if (profileError) console.warn('[auth-callback] Member role setup skipped:', profileError.message)
    }

    const provisioned = await ensureSignupGrowthSystem({
      email: user.email || '',
      fullName: String(user.user_metadata?.full_name || '').trim() || null,
      userId: user.id,
    })

    if (provisioned.ok && provisioned.created && user.email) {
      const emailResult = await sendUserSignupGrowthSystemReadyEmail({
        userEmail: user.email,
        userId: user.id,
        fullName: String(user.user_metadata?.full_name || '').trim() || null,
      })
      if (!emailResult.ok) console.warn('[auth-callback] Welcome email was not sent.')
    }
  }

  return privateRedirect(request, next)
}
