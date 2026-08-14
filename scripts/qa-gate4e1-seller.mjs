import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = String(process.env.QA_SITE_URL || 'http://127.0.0.1:3416').replace(/\/$/, '')
const qaFailureToken = process.env.SELLER_QA_ROUTING_FAILURE_TOKEN
assert(supabaseUrl && anonKey && serviceKey && qaFailureToken, 'Supabase and QA failure-injection environment are required')

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = `Gate4E1!${runId}`
const userIds = []
const caseIds = []
const leadIds = []
const checks = []
let browser

function pass(name) { checks.push(name); console.log(`PASS ${checks.length}. ${name}`) }
function noPrivateFields(value) {
  const text = JSON.stringify(value)
  for (const field of ['public_token_hash','dedupe_key','idempotency_key','user_id','lead_id','operator_task_id','assigned_to','actor_user_id','metadata_json']) assert(!text.includes(`"${field}"`), `Public response leaked ${field}`)
}
function payload(email, address, overrides = {}) {
  return {
    action: 'submit', idempotencyKey: `${runId}-${Math.random().toString(36).slice(2)}`, sellerName: 'Gate 4E.1 Seller', email,
    phone: '414-555-0149', propertyAddress: address, city: 'Milwaukee', state: 'Wisconsin', postalCode: '53202', propertyType: 'Single-family',
    bedrooms: 3, bathrooms: 2, propertyCondition: 'Minor updates needed', occupancyStatus: 'Owner occupied', timelineToSell: 'Within 60 days',
    reasonForSelling: 'Compare responsible sale paths before a relocation decision.', preferredSalePath: 'not_sure', estimatedValue: 310000,
    askingPrice: null, mortgageBalance: 152000, liensOrTaxes: '', bestTimeToContact: 'Afternoon', communicationPreference: 'email',
    analysisConsent: true, contactConsent: true, marketingConsent: false, sellerNotes: 'QA-only disposable seller case.', sourcePath: '/sell',
    attribution: { utm_source: 'gate4e1-qa' }, ...overrides,
  }
}
async function createUser(label, role = 'member') {
  const email = `vestblock+gate4e1-${label}-${runId}@example.com`
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Gate 4E.1 ${label}`, member_roles: ['property_seller'] } })
  assert.ifError(result.error); assert(result.data.user?.id); userIds.push(result.data.user.id)
  if (role === 'admin') {
    const profile = await admin.from('user_profiles').update({ role: 'admin' }).eq('id', result.data.user.id).select('role').single()
    assert.ifError(profile.error); assert.equal(profile.data.role, 'admin')
  }
  return { id: result.data.user.id, email }
}
async function signedInPage(user, redirect = '/sell') {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${siteUrl}/login?redirect=${encodeURIComponent(redirect)}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Login' }).waitFor()
  await page.waitForTimeout(500)
  await page.getByLabel('Email').fill(user.email); await page.getByLabel('Password').fill(password)
  await page.waitForFunction(() => { const button = document.querySelector('button[type="submit"]'); return button instanceof HTMLButtonElement && !button.disabled }, null, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((url) => url.pathname === redirect, { timeout: 45_000 })
  await page.waitForLoadState('domcontentloaded')
  return { context, page }
}
async function pageApi(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => { const response = await fetch(path, { method: options.method || 'GET', headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers, body: options.body ? JSON.stringify(options.body) : undefined, cache: 'no-store' }); return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json().catch(() => ({})) } }, { path, options })
}
async function adminApi(page, method, body, query = '') { return pageApi(page, `/api/admin/seller/cases${query}`, { method, body }) }

try {
  const primary = await createUser('primary')
  const secondary = await createUser('secondary')
  const operator = await createUser('operator', 'admin')
  browser = await chromium.launch()
  const primarySession = await signedInPage(primary)
  const secondarySession = await signedInPage(secondary)
  const operatorSession = await signedInPage(operator)
  await mkdir('/tmp/vestblock-gate4e1-visual', { recursive: true })

  const hub = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await hub.goto(`${siteUrl}/real-estate`, { waitUntil: 'networkidle' })
  const audiences = ['Buyers','Sellers','Investors','Agents','Wholesalers','Lenders','Builders','Developers']
  for (const audience of audiences) await hub.getByRole('heading', { name: audience, exact: true }).waitFor()
  const routes = await hub.locator('.vb-hub__route').evaluateAll((items) => items.map((item) => ({ title: item.querySelector('h3')?.textContent, href: item.getAttribute('href') })))
  assert.equal(routes.length, 8); assert.equal(new Set(routes.map((item) => item.href)).size, 8); assert.equal(routes.filter((item) => item.href?.startsWith('/sell')).length, 1)
  await hub.screenshot({ path: '/tmp/vestblock-gate4e1-visual/real-estate-hub-wide.png', fullPage: true })
  pass('all eight Real Estate audiences can identify and reach a role-appropriate entry path')
  pass('the hub exposes eight distinct destinations and does not send every visitor to /sell')

  const guestEmail = `vestblock+gate4e1-guest-${runId}@example.com`
  const guestDraftPayload = payload(guestEmail, '401 Guest QA Avenue', { action: 'save_draft', analysisConsent: false, contactConsent: false })
  const guestResponse = await fetch(`${siteUrl}/api/seller/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: siteUrl }, body: JSON.stringify(guestDraftPayload) })
  const guest = { status: guestResponse.status, body: await guestResponse.json() }
  assert.equal(guest.status, 200, JSON.stringify(guest.body)); assert(guest.body.accessToken); caseIds.push(guest.body.case.id); noPrivateFields(guest.body)
  const wrongToken = await fetch(`${siteUrl}/api/seller/cases?id=${guest.body.case.id}&token=${'x'.repeat(48)}`); assert.equal(wrongToken.status, 404)
  const resumed = await fetch(`${siteUrl}/api/seller/cases?id=${guest.body.case.id}&token=${encodeURIComponent(guest.body.accessToken)}`); assert.equal(resumed.status, 200); assert.match(resumed.headers.get('cache-control') || '', /no-store/); noPrivateFields(await resumed.json())
  const guestContext = await browser.newContext(); const guestPage = await guestContext.newPage()
  await guestPage.goto(`${siteUrl}/sell?case=${guest.body.case.id}&token=${encodeURIComponent(guest.body.accessToken)}`, { waitUntil: 'domcontentloaded' })
  await guestPage.waitForFunction(() => !new URL(location.href).searchParams.has('token'), null, { timeout: 45_000 })
  const guestStored = await guestPage.evaluate(() => JSON.parse(localStorage.getItem('vestblock-seller-case'))); assert.equal(guestStored.id, guest.body.case.id)
  pass('guest seller saves and securely resumes with a private URL token removed after recovery')

  const authDraftPayload = payload(primary.email, '402 Account QA Avenue', { action: 'save_draft', analysisConsent: false, contactConsent: false })
  const authDraft = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: authDraftPayload }); assert.equal(authDraft.status, 200, JSON.stringify(authDraft.body)); caseIds.push(authDraft.body.case.id)
  const authEdit = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: { ...authDraftPayload, id: authDraft.body.case.id, action: 'submit', analysisConsent: true, contactConsent: true, sellerNotes: 'Edited and submitted.', idempotencyKey: `${authDraftPayload.idempotencyKey}-submit` } })
  assert.equal(authEdit.status, 200, JSON.stringify(authEdit.body)); assert.equal(authEdit.body.case.status, 'submitted')
  const authResume = await pageApi(primarySession.page, `/api/seller/cases?id=${authDraft.body.case.id}`); assert.equal(authResume.status, 200); assert.equal(authResume.body.case.seller_notes, 'Edited and submitted.')
  pass('authenticated seller saves, edits, submits, and resumes an owned case')

  const claimed = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: { ...guestDraftPayload, id: guest.body.case.id, accessToken: guest.body.accessToken, sellerName: 'Claimed Seller', idempotencyKey: `${guestDraftPayload.idempotencyKey}-claim` } })
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body)); assert.equal(claimed.body.accessToken, null)
  const claimedOwner = await admin.from('seller_cases').select('user_id').eq('id', guest.body.case.id).single(); assert.ifError(claimedOwner.error); assert.equal(claimedOwner.data.user_id, primary.id)
  pass('signed-in owner claims a guest case for account continuity')

  const crossAccount = await pageApi(secondarySession.page, `/api/seller/cases?id=${authDraft.body.case.id}`); assert.equal(crossAccount.status, 404)
  pass('cross-account seller case access is rejected')

  const duplicate = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: { ...authDraftPayload, action: 'submit', analysisConsent: true, contactConsent: true, idempotencyKey: authDraftPayload.idempotencyKey } })
  assert.equal(duplicate.status, 200); assert.equal(duplicate.body.case.id, authDraft.body.case.id); assert.equal(duplicate.body.duplicate, true)
  const propertyCount = await admin.from('seller_cases').select('id', { count: 'exact' }).eq('user_id', primary.id).eq('property_address', '402 Account QA Avenue'); assert.equal(propertyCount.count, 1)
  pass('duplicate owner/property submissions merge into the original case')

  const beforeIncomplete = await admin.from('seller_cases').select('id', { count: 'exact' }).eq('email', primary.email)
  const incomplete = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: payload(primary.email, '403 Incomplete QA Avenue', { sellerName: '', phone: '', propertyType: '', analysisConsent: false, contactConsent: false }) })
  assert.equal(incomplete.status, 422); assert(incomplete.body.completeness.gaps.includes('seller name'))
  const afterIncomplete = await admin.from('seller_cases').select('id', { count: 'exact' }).eq('email', primary.email); assert.equal(afterIncomplete.count, beforeIncomplete.count)
  pass('incomplete submission returns actionable gaps without creating a corrupt record')

  const persisted = await admin.from('seller_cases').select('lead_id,operator_task_id,source_path,analysis_consent,contact_consent,marketing_consent,communication_preference').eq('id', authDraft.body.case.id).single()
  assert.ifError(persisted.error); assert(persisted.data.lead_id); assert(persisted.data.operator_task_id); leadIds.push(persisted.data.lead_id)
  const crm = await admin.from('leads').select('source,source_url,external_id,outreach_status,metadata_json').eq('id', persisted.data.lead_id).single(); assert.ifError(crm.error); assert.equal(crm.data.source, 'seller_case'); assert.equal(crm.data.source_url, '/sell'); assert.equal(crm.data.outreach_status, 'needs_review'); assert.equal(crm.data.metadata_json.automatedMatchingAuthorized, false)
  pass('valid seller submission updates the existing leads CRM with source and no auto-match/outreach authority')

  const task = await admin.from('admin_tasks').select('id,task_type,entity_type,entity_id').eq('id', persisted.data.operator_task_id).single(); assert.ifError(task.error); assert.equal(task.data.task_type, 'seller_case_review'); assert.equal(task.data.entity_type, 'seller_case')
  pass('valid seller submission creates the durable operator-review task')

  const queue = await adminApi(operatorSession.page, 'GET', null); assert.equal(queue.status, 200); assert(queue.body.cases.some((item) => item.id === authDraft.body.case.id)); assert(queue.body.operators.some((item) => item.id === operator.id)); assert.equal(queue.body.currentOperatorId, operator.id); assert(!JSON.stringify(queue.body).includes('public_token_hash')); assert(!JSON.stringify(queue.body).includes('dedupe_key')); assert(!JSON.stringify(queue.body).includes('idempotency_key'))
  const assigned = await adminApi(operatorSession.page, 'PATCH', { id: authDraft.body.case.id, status: 'under_review', assignedTo: operator.id, note: 'Verified intake and started review.' }); assert.equal(assigned.status, 200, JSON.stringify(assigned.body))
  const options = await adminApi(operatorSession.page, 'PATCH', { id: authDraft.body.case.id, status: 'options_review', note: 'Case facts are organized for a sale-path discussion.' }); assert.equal(options.status, 200)
  const closed = await adminApi(operatorSession.page, 'PATCH', { id: authDraft.body.case.id, status: 'closed', note: 'Review complete; no outcome represented.' }); assert.equal(closed.status, 200)

  const declinePayload = payload(secondary.email, '404 Decline QA Avenue'); const declineCase = await pageApi(secondarySession.page, '/api/seller/cases', { method: 'POST', body: declinePayload }); assert.equal(declineCase.status, 200); caseIds.push(declineCase.body.case.id)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: declineCase.body.case.id, status: 'under_review', note: 'Review opened.' })).status, 200)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: declineCase.body.case.id, status: 'declined', note: '' })).status, 422)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: declineCase.body.case.id, status: 'declined', note: 'Property information is outside the current review scope.' })).status, 200)

  const infoPayload = payload(secondary.email, '405 Information QA Avenue'); const infoCase = await pageApi(secondarySession.page, '/api/seller/cases', { method: 'POST', body: infoPayload }); assert.equal(infoCase.status, 200); caseIds.push(infoCase.body.case.id)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: infoCase.body.case.id, status: 'needs_information', note: '' })).status, 422)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: infoCase.body.case.id, status: 'needs_information', note: 'Confirm occupancy and known title questions.' })).status, 200)
  const resubmitted = await pageApi(secondarySession.page, '/api/seller/cases', { method: 'POST', body: { ...infoPayload, id: infoCase.body.case.id, idempotencyKey: `${infoPayload.idempotencyKey}-resubmit`, sellerNotes: 'Occupancy and title questions confirmed.' } }); assert.equal(resubmitted.status, 200); assert.equal(resubmitted.body.case.status, 'submitted')

  const withdrawPayload = payload(secondary.email, '406 Withdrawal QA Avenue'); const withdrawal = await pageApi(secondarySession.page, '/api/seller/cases', { method: 'POST', body: withdrawPayload }); assert.equal(withdrawal.status, 200); caseIds.push(withdrawal.body.case.id)
  const withdrawn = await pageApi(secondarySession.page, '/api/seller/cases', { method: 'POST', body: { ...withdrawPayload, id: withdrawal.body.case.id, action: 'withdraw', idempotencyKey: `${withdrawPayload.idempotencyKey}-withdraw` } }); assert.equal(withdrawn.status, 200); assert.equal(withdrawn.body.case.status, 'withdrawn')
  pass('operator lifecycle supports view, assignment, update, information request, reasoned decline, withdrawal, and close')

  const history = await pageApi(primarySession.page, `/api/seller/cases?id=${authDraft.body.case.id}`); assert.equal(history.status, 200); assert(history.body.events.some((event) => event.to_status === 'under_review')); assert(history.body.events.some((event) => event.to_status === 'closed')); noPrivateFields(history.body)
  pass('customer-visible case status history persists without operator metadata')

  assert.equal(persisted.data.analysis_consent, true); assert.equal(persisted.data.contact_consent, true); assert.equal(persisted.data.marketing_consent, false); assert.equal(persisted.data.communication_preference, 'email')
  pass('required analysis/contact consent, optional marketing consent, and communication preference persist separately')

  const crossSite = await fetch(`${siteUrl}/api/seller/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://malicious.example' }, body: JSON.stringify(guestDraftPayload) }); assert.equal(crossSite.status, 403)
  pass('cross-site seller mutation is rejected')

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }); assert((await anon.from('seller_cases').select('id').limit(1)).error)
  const authenticated = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }); assert.ifError((await authenticated.auth.signInWithPassword({ email: primary.email, password })).error); assert((await authenticated.from('seller_cases').select('id').limit(1)).error)
  noPrivateFields(authResume.body)
  pass('RLS, restrictive grants, and response filtering prevent direct or public internal-field access')

  const failurePayload = payload(primary.email, '407 Routing Failure QA Avenue')
  const failedRoute = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: failurePayload, headers: { 'x-vestblock-qa-routing-failure': qaFailureToken } }); assert.equal(failedRoute.status, 202, JSON.stringify(failedRoute.body)); assert(failedRoute.body.routingPending); caseIds.push(failedRoute.body.case.id)
  const safePending = await admin.from('seller_cases').select('status,lead_id,operator_task_id').eq('id', failedRoute.body.case.id).single(); assert.equal(safePending.data.status, 'submitted'); assert.equal(safePending.data.lead_id, null); assert.equal(safePending.data.operator_task_id, null)
  const repaired = await pageApi(primarySession.page, '/api/seller/cases', { method: 'POST', body: { ...failurePayload, id: failedRoute.body.case.id, idempotencyKey: `${failurePayload.idempotencyKey}-retry` } }); assert.equal(repaired.status, 200, JSON.stringify(repaired.body)); assert(repaired.body.case.lead_id === undefined)
  const repairedRouting = await admin.from('seller_cases').select('lead_id,operator_task_id').eq('id', failedRoute.body.case.id).single(); assert(repairedRouting.data.lead_id); assert(repairedRouting.data.operator_task_id)
  pass('routing failure returns a safe 202 pending state and retry repairs CRM/task routing')

  await primarySession.page.goto(`${siteUrl}/sell`, { waitUntil: 'networkidle' })
  for (const width of [1440, 1024, 390]) {
    await primarySession.page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const size = await primarySession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth })); assert.equal(size.scrollWidth, size.innerWidth, `seller overflow at ${width}`)
    await primarySession.page.screenshot({ path: `/tmp/vestblock-gate4e1-visual/seller-${width}.png`, fullPage: true })
  }
  await operatorSession.page.setViewportSize({ width: 390, height: 844 }); await operatorSession.page.goto(`${siteUrl}/admin/sellers`, { waitUntil: 'networkidle' }); await operatorSession.page.getByRole('heading', { name: 'Seller case review' }).waitFor(); let adminSize = await operatorSession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth })); assert.equal(adminSize.scrollWidth, adminSize.innerWidth); await operatorSession.page.screenshot({ path: '/tmp/vestblock-gate4e1-visual/seller-admin-mobile-queue.png', fullPage: true }); await operatorSession.page.locator('[data-seller-case-id]').first().click(); await operatorSession.page.getByRole('button', { name: 'Back to seller cases' }).waitFor(); const assigneeSelect = operatorSession.page.getByLabel('Assigned operator'); await assigneeSelect.waitFor(); assert.equal(await assigneeSelect.locator('option', { hasText: 'Assign to me' }).count(), 1); assert.equal(await operatorSession.page.getByText(/Optional UUID|Operator user ID/).count(), 0); adminSize = await operatorSession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth })); assert.equal(adminSize.scrollWidth, adminSize.innerWidth); await operatorSession.page.screenshot({ path: '/tmp/vestblock-gate4e1-visual/seller-admin-mobile.png', fullPage: true })
  pass('seller and operator views have zero horizontal overflow at desktop, tablet, and mobile sizes')

  await primarySession.page.goto(`${siteUrl}/sell`, { waitUntil: 'networkidle' })
  const unlabeled = await primarySession.page.locator('#seller-intake input, #seller-intake textarea, #seller-intake select').evaluateAll((elements) => elements.filter((element) => !('labels' in element) || !element.labels?.length).length); assert.equal(unlabeled, 0)
  pass('every seller input has a programmatic label and incomplete submissions return useful errors')
  const firstTab = primarySession.page.getByRole('tab', { name: /Property/ }); await firstTab.focus(); await firstTab.press('ArrowRight'); const prioritiesTab = primarySession.page.getByRole('tab', { name: /Priorities/ }); assert.equal(await prioritiesTab.getAttribute('aria-selected'), 'true'); assert(await prioritiesTab.evaluate((element) => element === document.activeElement)); assert(await prioritiesTab.evaluate((element) => getComputedStyle(element, ':focus-visible').outlineStyle !== 'none'))
  pass('keyboard step navigation works and the active control retains a visible focus style')

  await hub.goto(siteUrl, { waitUntil: 'networkidle' }); await hub.getByRole('heading', { name: 'Find your next move.' }).waitFor(); const heroText = await hub.locator('body').innerText(); assert.match(heroText, /decision room/i); assert.match(heroText, /Capital/i); assert.match(heroText, /Real Estate/i)
  pass('approved homepage Decision Room hero and platform narrative have no regression')

  assert.equal(checks.length, 20)
  console.log(JSON.stringify({ healthy: true, runId, checks, screenshots: '/tmp/vestblock-gate4e1-visual' }, null, 2))
} finally {
  if (browser) await browser.close()
  const cleanupIssues = []
  const cleanupStep = async (label, operation) => {
    const result = await operation
    if (result.error) cleanupIssues.push(`${label}: ${result.error.message}`)
    return result
  }
  const uniqueCases = [...new Set(caseIds)]
  if (uniqueCases.length) {
    const links = await cleanupStep('read seller-case CRM links', admin.from('seller_cases').select('lead_id').in('id', uniqueCases))
    for (const item of links.data || []) if (item.lead_id) leadIds.push(item.lead_id)
    await cleanupStep('delete seller-case tasks', admin.from('admin_tasks').delete().eq('entity_type', 'seller_case').in('entity_id', uniqueCases))
    await cleanupStep('delete seller-case activity', admin.from('admin_activity').delete().eq('entity_type', 'seller_case').in('entity_id', uniqueCases))
    await cleanupStep('delete seller-case history', admin.from('seller_case_events').delete().in('seller_case_id', uniqueCases))
    await cleanupStep('delete seller cases', admin.from('seller_cases').delete().in('id', uniqueCases))
  }
  const uniqueLeads = [...new Set(leadIds.filter(Boolean))]
  if (uniqueLeads.length) {
    await cleanupStep('delete seller lead tasks', admin.from('admin_tasks').delete().eq('entity_type', 'lead').in('entity_id', uniqueLeads))
    await cleanupStep('delete seller lead activity', admin.from('admin_activity').delete().eq('entity_type', 'lead').in('entity_id', uniqueLeads))
    await cleanupStep('delete seller leads', admin.from('leads').delete().in('id', uniqueLeads))
  }
  for (const userId of userIds) {
    const result = await admin.auth.admin.deleteUser(userId)
    if (result.error) cleanupIssues.push(`delete QA auth user ${userId}: ${result.error.message}`)
  }
  if (uniqueCases.length) {
    const leftovers = await cleanupStep('verify seller-case cleanup', admin.from('seller_cases').select('id').in('id', uniqueCases))
    if (leftovers.data?.length) cleanupIssues.push(`${leftovers.data.length} seller cases remain for ${runId}`)
    const historyLeftovers = await cleanupStep('verify seller history cleanup', admin.from('seller_case_events').select('id').in('seller_case_id', uniqueCases))
    if (historyLeftovers.data?.length) cleanupIssues.push(`${historyLeftovers.data.length} seller events remain for ${runId}`)
    const taskLeftovers = await cleanupStep('verify seller task cleanup', admin.from('admin_tasks').select('id').eq('entity_type', 'seller_case').in('entity_id', uniqueCases))
    if (taskLeftovers.data?.length) cleanupIssues.push(`${taskLeftovers.data.length} seller tasks remain for ${runId}`)
  }
  if (uniqueLeads.length) {
    const leadLeftovers = await cleanupStep('verify CRM cleanup', admin.from('leads').select('id').in('id', uniqueLeads))
    if (leadLeftovers.data?.length) cleanupIssues.push(`${leadLeftovers.data.length} seller CRM leads remain for ${runId}`)
  }
  if (cleanupIssues.length) {
    console.error(`QA cleanup failed:\n- ${cleanupIssues.join('\n- ')}`)
    process.exitCode = 1
  } else if (uniqueCases.length || userIds.length) {
    console.log(`PASS cleanup. Removed disposable seller cases, CRM records, tasks, history, and ${userIds.length} QA users for ${runId}.`)
  }
}
