import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = String(process.env.QA_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io').replace(/\/$/, '')

assert(url, 'Supabase URL is required')
assert(anonKey, 'Supabase anon key is required')
assert(serviceKey, 'Supabase service-role key is required')

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = `Gate4B3!${runId}`
const updatedPassword = `${password}-updated`
const users = []
const checks = []

function client() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function pass(name) {
  checks.push(name)
  console.log(`PASS ${name}`)
}

async function createConfirmed(label) {
  const email = `vestblock+${label}-${runId}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `VestBlock ${label}`, member_roles: ['real_estate_buyer'] },
  })
  assert.ifError(error)
  assert(data.user?.id)
  users.push(data.user.id)
  return { email, id: data.user.id }
}

try {
  const signupEmail = `vestblock+signup-${runId}@example.com`
  const generatedSignup = await admin.auth.admin.generateLink({
    type: 'signup',
    email: signupEmail,
    password,
    options: {
      data: { full_name: 'VestBlock Signup', member_roles: ['capital_seeker'] },
      redirectTo: `${siteUrl}/auth/callback?next=%2Fdashboard%2Fservices`,
    },
  })
  assert.ifError(generatedSignup.error)
  assert(generatedSignup.data.user?.id)
  assert(generatedSignup.data.properties?.hashed_token)
  users.push(generatedSignup.data.user.id)
  pass('new registration and verification link generation')

  const signupClient = client()
  const signupVerification = await signupClient.auth.verifyOtp({
    type: 'signup',
    token_hash: generatedSignup.data.properties.hashed_token,
  })
  assert.ifError(signupVerification.error)
  assert(signupVerification.data.session)
  pass('email verification completion')

  const primary = await createConfirmed('primary')
  const secondary = await createConfirmed('secondary')

  const signedIn = client()
  const login = await signedIn.auth.signInWithPassword({ email: primary.email, password })
  assert.ifError(login.error)
  assert(login.data.session)
  pass('existing user login')

  const invalid = await client().auth.signInWithPassword({ email: primary.email, password: `${password}-wrong` })
  assert(invalid.error)
  pass('invalid login rejected')

  const refreshed = await signedIn.auth.refreshSession()
  assert.ifError(refreshed.error)
  assert(refreshed.data.session)
  pass('session renewal')

  const roleUpdate = await signedIn
    .from('user_profiles')
    .update({ member_roles: ['real_estate_buyer', 'lender'] })
    .eq('id', primary.id)
    .select('member_roles')
    .single()
  assert.ifError(roleUpdate.error)
  assert.deepEqual(roleUpdate.data.member_roles, ['real_estate_buyer', 'lender'])
  pass('multi-role edit')

  const privilegedUpdate = await signedIn
    .from('user_profiles')
    .update({ role: 'admin' })
    .eq('id', primary.id)
  assert(privilegedUpdate.error)
  pass('privileged role update rejected')

  const crossUserUpdate = await signedIn
    .from('user_profiles')
    .update({ member_roles: ['investor'] })
    .eq('id', secondary.id)
    .select('id')
  assert.ifError(crossUserUpdate.error)
  assert.equal(crossUserUpdate.data.length, 0)
  pass('cross-user profile update blocked by RLS')

  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: primary.email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=%2Freset-password&intent=recovery` },
  })
  assert.ifError(recovery.error)
  assert(recovery.data.properties?.hashed_token)
  pass('recovery link generation')

  const recoveryClient = client()
  const verified = await recoveryClient.auth.verifyOtp({
    type: 'recovery',
    token_hash: recovery.data.properties.hashed_token,
  })
  assert.ifError(verified.error)
  assert(verified.data.session)
  const passwordUpdate = await recoveryClient.auth.updateUser({ password: updatedPassword })
  assert.ifError(passwordUpdate.error)
  const updatedLogin = await client().auth.signInWithPassword({ email: primary.email, password: updatedPassword })
  assert.ifError(updatedLogin.error)
  pass('recovery completion and new password login')

  await signedIn.auth.signOut()
  const afterLogout = await signedIn.auth.getSession()
  assert.equal(afterLogout.data.session, null)
  pass('logout clears session')

  console.log(JSON.stringify({ healthy: true, checks }, null, 2))
} finally {
  for (const userId of users) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.warn(`Cleanup warning for ${userId}: ${error.message}`)
  }
}
