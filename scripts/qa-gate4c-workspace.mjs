import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = String(process.env.QA_SITE_URL || 'http://127.0.0.1:3414').replace(/\/$/, '')

assert(url, 'Supabase URL is required')
assert(serviceKey, 'Supabase service-role key is required')

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `vestblock+gate4c-${runId}@example.com`
const password = `Gate4C!${runId}`
let userId = null
let browser = null

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Gate 4C Member', member_roles: ['business_owner'] },
  })
  assert.ifError(created.error)
  assert(created.data.user?.id)
  userId = created.data.user.id

  browser = await chromium.launch()
  const page = await browser.newPage()
  let workspaceFailure = null
  let workspacePatchCount = 0
  page.on('response', async (response) => {
    if (response.url().includes('/api/workspace') && response.request().method() === 'PATCH') {
      workspacePatchCount += 1
      if (!response.ok()) workspaceFailure = `${response.status()} ${await response.text()}`
    }
  })
  await page.goto(`${siteUrl}/login?redirect=/workspace`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL(/\/workspace$/, { timeout: 20_000 })
  await page.getByRole('button', { name: /Capital/ }).click()
  await page.getByRole('textbox', { name: 'Current objective' }).fill('Prepare a business acquisition capital plan')
  await page.getByRole('textbox', { name: 'Target market or coverage' }).fill('Milwaukee, Wisconsin')
  await page.getByText('Provide financing', { exact: true }).click()
  await page.getByLabel('Allow eligible partner review').click()
  assert.equal(await page.getByRole('button', { name: 'Save workspace' }).isEnabled(), true)
  await page.getByRole('button', { name: 'Save workspace' }).click({ force: true })
  await page.waitForTimeout(4_000)
  assert(workspacePatchCount > 0, 'Save action did not issue a workspace request')
  assert.equal(workspaceFailure, null, workspaceFailure || 'Workspace save failed')
  await page.reload({ waitUntil: 'domcontentloaded' })

  await page.getByRole('textbox', { name: 'Current objective' }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Current objective' }).inputValue(), 'Prepare a business acquisition capital plan')
  assert.equal(await page.getByRole('textbox', { name: 'Target market or coverage' }).inputValue(), 'Milwaukee, Wisconsin')
  assert.equal(await page.getByLabel('Provide financing').isChecked(), true)
  assert.equal(await page.getByLabel('Allow eligible partner review').getAttribute('data-state'), 'checked')

  const saved = await admin.from('customer_workspaces').select('active_lane,criteria_json,profile_visibility').eq('user_id', userId).single()
  assert.ifError(saved.error)
  assert.equal(saved.data.active_lane, 'capital')
  assert.equal(saved.data.criteria_json.objective, 'Prepare a business acquisition capital plan')
  assert.equal(saved.data.profile_visibility, 'eligible-partners')

  const profile = await admin.from('user_profiles').select('member_roles').eq('id', userId).single()
  assert.ifError(profile.error)
  assert(profile.data.member_roles.includes('lender'))

  console.log(JSON.stringify({ healthy: true, checks: [
    'confirmed user login',
    'authenticated workspace save',
    'workspace reload persistence',
    'criteria and consent persistence',
    'multi-role persistence',
  ] }, null, 2))
} finally {
  if (browser) await browser.close()
  if (userId) {
    const cleanup = await admin.auth.admin.deleteUser(userId)
    if (cleanup.error) console.warn(`Cleanup warning: ${cleanup.error.message}`)
  }
}
