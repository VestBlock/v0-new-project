import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = String(process.env.QA_SITE_URL || 'http://127.0.0.1:3415').replace(/\/$/, '')

assert(supabaseUrl, 'Supabase URL is required')
assert(anonKey, 'Supabase anon key is required')
assert(serviceKey, 'Supabase service-role key is required')

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = `Gate4D!${runId}`
const userIds = []
const caseIds = []
const leadIds = []
const lenderIds = []
const checks = []
let browser

const businessDocs = [
  'Government-issued identification',
  'Entity formation record and EIN confirmation',
  'Recent business bank statements',
  'Current profit-and-loss statement',
  'Business tax returns when applicable',
  'Debt schedule and use-of-funds detail',
]
const realEstateDocs = [
  'Purchase contract or deal summary when available',
  'Property photos or scope',
  'Current rent roll or lease information when applicable',
  'Rehab or construction budget',
  'Proof of liquidity or reserves',
  'Entity and borrower experience summary',
]
const providerDocs = [
  'Current program or lending matrix',
  'Responsible contact and review process',
  'Coverage and licensing disclosures as applicable',
  'Required borrower/deal document list',
  'Indicative terms with verification date',
  'Referral or broker requirements when applicable',
]

function pass(name) {
  checks.push(name)
  console.log(`PASS ${name}`)
}

function assertNoInternalFields(value) {
  const text = JSON.stringify(value)
  for (const field of ['public_token_hash', 'dedupe_key', 'idempotency_key', 'user_id', 'lead_id', 'lender_id', 'assigned_to', 'operator_task_id', 'actor_user_id', 'metadata_json']) {
    assert(!text.includes(`\"${field}\"`), `Customer response leaked ${field}`)
  }
}

async function createUser(label, role = 'member') {
  const email = `vestblock+gate4d-${label}-${runId}@example.com`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Gate 4D ${label}`, member_roles: ['business_owner'] },
  })
  assert.ifError(created.error)
  assert(created.data.user?.id)
  userIds.push(created.data.user.id)
  if (role === 'admin') {
    const profile = await admin.from('user_profiles').update({ role: 'admin' }).eq('id', created.data.user.id).select('id,role').single()
    assert.ifError(profile.error)
    assert.equal(profile.data.role, 'admin')
  }
  return { id: created.data.user.id, email }
}

async function signedInPage(user) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${siteUrl}/login?redirect=/capital`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Login' }).waitFor()
  await page.waitForTimeout(750)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(password)
  await page.waitForFunction(() => {
    const submit = document.querySelector('button[type="submit"]')
    return submit instanceof HTMLButtonElement && !submit.disabled
  }, null, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((current) => current.pathname === '/capital', { timeout: 45_000 })
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('heading', { name: 'Choose the objective. Build one accountable file.' }).waitFor({ timeout: 45_000 })
  return { context, page }
}

async function pageApi(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }, { path, options })
}

async function adminApi(page, method, body, query = '') {
  return pageApi(page, `/api/admin/capital/cases${query}`, { method, body })
}

function base(caseType, email, overrides = {}) {
  return {
    caseType,
    action: 'submit',
    idempotencyKey: `${runId}-${caseType}-${Math.random().toString(36).slice(2)}`,
    fullName: `Gate 4D ${caseType.replaceAll('_', ' ')}`,
    email,
    phone: '414-555-0198',
    organizationName: `Gate 4D ${caseType} LLC`,
    amountRequested: 250000,
    purpose: 'Build a documented, responsible capital plan for this QA scenario.',
    timing: 'Within 90 days',
    geography: 'Wisconsin',
    communicationPreference: 'email',
    analysisConsent: true,
    providerSharingConsent: true,
    marketingConsent: false,
    intakeData: {},
    availableDocuments: [],
    ...overrides,
  }
}

try {
  const primary = await createUser('primary')
  const secondary = await createUser('secondary')
  const operator = await createUser('operator', 'admin')
  browser = await chromium.launch()
  const primarySession = await signedInPage(primary)
  const secondarySession = await signedInPage(secondary)
  const operatorSession = await signedInPage(operator)

  await mkdir('/tmp/vestblock-gate4d-visual', { recursive: true })
  await primarySession.page.setViewportSize({ width: 1440, height: 1000 })
  await primarySession.page.screenshot({ path: '/tmp/vestblock-gate4d-visual/capital-wide.png', fullPage: true })
  const customerWide = await primarySession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  assert.equal(customerWide.scrollWidth, customerWide.innerWidth)
  const businessTab = primarySession.page.getByRole('tab', { name: /Fund a business/ })
  await businessTab.focus()
  await businessTab.press('ArrowRight')
  const realEstateTab = primarySession.page.getByRole('tab', { name: /Finance a property/ })
  await realEstateTab.waitFor()
  await primarySession.page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes('Finance a property'))
  assert.equal(await realEstateTab.getAttribute('aria-selected'), 'true')
  assert(await realEstateTab.evaluate((element) => element === document.activeElement))
  const unlabeledControls = await primarySession.page.locator('#capital-intake input, #capital-intake textarea, #capital-intake select').evaluateAll((elements) => elements.filter((element) => !(element instanceof HTMLElement) || !('labels' in element) || !element.labels?.length).length)
  assert.equal(unlabeledControls, 0)
  await primarySession.page.setViewportSize({ width: 390, height: 844 })
  await primarySession.page.screenshot({ path: '/tmp/vestblock-gate4d-visual/capital-mobile.png', fullPage: true })
  const customerMobile = await primarySession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  assert.equal(customerMobile.scrollWidth, customerMobile.innerWidth)
  await primarySession.page.setViewportSize({ width: 1440, height: 1000 })
  pass('customer Capital workbench passes desktop/mobile overflow, labels, and keyboard tab navigation')

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const anonRead = await anon.from('capital_cases').select('id').limit(1)
  assert(anonRead.error, 'Anonymous direct table read unexpectedly succeeded')
  const authDirect = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  assert.ifError((await authDirect.auth.signInWithPassword({ email: primary.email, password })).error)
  const authRead = await authDirect.from('capital_cases').select('id').limit(1)
  assert(authRead.error, 'Authenticated direct table read unexpectedly succeeded')
  pass('RLS and grants deny direct anon/authenticated table access')

  const businessPayload = base('business_funding', primary.email, {
    intakeData: { businessStage: 'established', timeInBusinessMonths: 36, annualRevenue: 780000, creditRange: '670_739', entityStatus: 'complete', businessBanking: 'active' },
    availableDocuments: businessDocs,
  })
  const business = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: businessPayload })
  assert.equal(business.status, 200, JSON.stringify(business.body))
  assert.equal(business.body.case.status, 'submitted')
  assert.equal(business.body.case.case_type, 'business_funding')
  assertNoInternalFields(business.body)
  caseIds.push(business.body.case.id)
  pass('seeded business-funding submission with readiness result')

  const duplicate = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: { ...businessPayload, idempotencyKey: businessPayload.idempotencyKey } })
  assert.equal(duplicate.status, 200, JSON.stringify(duplicate.body))
  assert.equal(duplicate.body.case.id, business.body.case.id)
  assert.equal(duplicate.body.duplicate, true)
  pass('authenticated dedupe returns the original business case')

  const realEstatePayload = base('real_estate_funding', primary.email, {
    amountRequested: 310000,
    purpose: 'Acquire and stabilize a small rental property.',
    intakeData: { propertyAddress: '123 QA Street, Milwaukee, WI', transactionType: 'dscr', purchasePrice: 390000, estimatedValue: 420000, availableLiquidity: 115000, experienceDeals: 4, exitStrategy: 'Stabilize rents and refinance after seasoning.' },
    availableDocuments: realEstateDocs,
  })
  const realEstate = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: realEstatePayload })
  assert.equal(realEstate.status, 200, JSON.stringify(realEstate.body))
  assert.equal(realEstate.body.case.status, 'submitted')
  caseIds.push(realEstate.body.case.id)
  pass('seeded real-estate-funding submission')

  const providerPayload = base('capital_provider', primary.email, {
    amountRequested: 5000000,
    purpose: 'Publish a private, criteria-based lending profile for operator review.',
    geography: 'WI, IL, MI',
    intakeData: { providerType: 'private_lender', statesServed: 'WI, IL, MI', minimumAmount: 100000, maximumAmount: 5000000, preferredProfiles: 'Experienced rental and value-add operators with documented liquidity.', noGoItems: 'Owner-occupied consumer-purpose transactions.', requiredDocs: 'Borrower profile, property summary, sources and uses, liquidity evidence.', turnaround: 'Two business days', relationshipModel: 'direct', criteriaVerifiedAt: '2026-08-13' },
    availableDocuments: providerDocs,
  })
  const provider = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: providerPayload })
  assert.equal(provider.status, 200, JSON.stringify(provider.body))
  assert.equal(provider.body.case.status, 'submitted')
  caseIds.push(provider.body.case.id)
  const providerLink = await admin.from('capital_cases').select('lender_id').eq('id', provider.body.case.id).single()
  assert.ifError(providerLink.error)
  assert(providerLink.data.lender_id)
  lenderIds.push(providerLink.data.lender_id)
  pass('seeded lender/provider profile and private lender-network record')

  const incomplete = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: base('business_credit', primary.email, { fullName: '', organizationName: '', amountRequested: null, purpose: '', timing: '', geography: '', analysisConsent: false }) })
  assert.equal(incomplete.status, 422, JSON.stringify(incomplete.body))
  assert(incomplete.body.readiness.gaps.length > 0)
  pass('incomplete submission returns actionable readiness gaps without creating a case')

  const secondaryRead = await pageApi(secondarySession.page, `/api/capital/cases?id=${business.body.case.id}`)
  assert.equal(secondaryRead.status, 404)
  pass('cross-account case access is blocked')

  const guestEmail = `vestblock+gate4d-guest-${runId}@example.com`
  const guestPayload = base('business_acquisition', guestEmail, {
    action: 'save_draft',
    intakeData: { targetBusiness: 'Regional services company', purchasePrice: 800000, buyerContribution: 150000, targetCashFlow: 240000, sellerFinancing: 'possible', operatingExperience: 'Eight years of operating and team leadership experience.' },
    availableDocuments: [],
  })
  const guestResponse = await fetch(`${siteUrl}/api/capital/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: siteUrl }, body: JSON.stringify(guestPayload) })
  const guest = { status: guestResponse.status, body: await guestResponse.json() }
  assert.equal(guest.status, 200, JSON.stringify(guest.body))
  assert(guest.body.accessToken)
  assertNoInternalFields(guest.body)
  caseIds.push(guest.body.case.id)
  const wrongToken = await fetch(`${siteUrl}/api/capital/cases?id=${guest.body.case.id}&token=${'x'.repeat(48)}`)
  assert.equal(wrongToken.status, 404)
  const resumedGuest = await fetch(`${siteUrl}/api/capital/cases?id=${guest.body.case.id}&token=${encodeURIComponent(guest.body.accessToken)}`)
  assert.equal(resumedGuest.status, 200)
  assert.match(resumedGuest.headers.get('cache-control') || '', /no-store/)
  const resumedGuestBody = await resumedGuest.json()
  assert.equal(resumedGuestBody.case.id, guest.body.case.id)
  assertNoInternalFields(resumedGuestBody)
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(`${siteUrl}/capital?path=business-acquisition&case=${guest.body.case.id}&token=${encodeURIComponent(guest.body.accessToken)}#capital-intake`, { waitUntil: 'domcontentloaded' })
  await guestPage.waitForFunction(() => !new URL(window.location.href).searchParams.has('token'), null, { timeout: 45_000 })
  assert.equal(new URL(guestPage.url()).searchParams.has('case'), false)
  const storedResume = await guestPage.evaluate(() => window.localStorage.getItem('vestblock-capital-case:business_acquisition'))
  assert.equal(JSON.parse(storedResume).id, guest.body.case.id)
  await guestContext.close()
  const guestDuplicate = await fetch(`${siteUrl}/api/capital/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: siteUrl }, body: JSON.stringify({ ...guestPayload, idempotencyKey: `${guestPayload.idempotencyKey}-other` }) })
  assert.equal(guestDuplicate.status, 409)
  pass('guest private-token resume works and email-only duplicate takeover is blocked')

  const claimed = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: { ...guestPayload, id: guest.body.case.id, accessToken: guest.body.accessToken, purpose: 'Updated after account sign-in.', idempotencyKey: `${guestPayload.idempotencyKey}-claim` } })
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body))
  assert.equal(claimed.body.accessToken, null)
  const claimedOwner = await admin.from('capital_cases').select('user_id').eq('id', guest.body.case.id).single()
  assert.ifError(claimedOwner.error)
  assert.equal(claimedOwner.data.user_id, primary.id)
  pass('signed-in save claims a guest case for account-based resume')

  const acquisition = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: { ...guestPayload, id: guest.body.case.id, action: 'submit', accessToken: undefined, purpose: 'Updated after account sign-in.', analysisConsent: true, idempotencyKey: `${guestPayload.idempotencyKey}-submit` } })
  assert.equal(acquisition.status, 200, JSON.stringify(acquisition.body))
  assert.equal(acquisition.body.case.status, 'submitted')

  const businessCredit = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: base('business_credit', primary.email, {
    purpose: 'Strengthen business credit readiness before seeking capital.',
    intakeData: { entityStatus: 'complete', businessBanking: 'active', timeInBusinessMonths: 30, annualRevenue: 280000, creditRange: '670_739', utilization: 24 },
  }) })
  assert.equal(businessCredit.status, 200, JSON.stringify(businessCredit.body))
  caseIds.push(businessCredit.body.case.id)

  const grants = await pageApi(primarySession.page, '/api/capital/cases', { method: 'POST', body: base('grants_programs', primary.email, {
    amountRequested: 75000,
    purpose: 'Research verified programs for a workforce training project.',
    intakeData: { businessStatus: 'operating', state: 'Wisconsin', industry: 'Professional services', annualRevenue: 280000, projectBudget: 100000, programGoal: 'Train and retain ten local employees with measurable certifications.' },
  }) })
  assert.equal(grants.status, 200, JSON.stringify(grants.body))
  caseIds.push(grants.body.case.id)
  pass('all six Capital paths save and submit through the shared case lifecycle')

  const primaryList = await pageApi(primarySession.page, '/api/capital/cases')
  assert.equal(primaryList.status, 200)
  assert(primaryList.body.cases.some((item) => item.id === guest.body.case.id))
  assertNoInternalFields(primaryList.body)
  pass('authenticated case history and resume list persist across paths')

  const queue = await adminApi(operatorSession.page, 'GET', null, '')
  assert.equal(queue.status, 200, JSON.stringify(queue.body))
  assert.equal(caseIds.filter((id) => queue.body.cases.some((item) => item.id === id)).length, 6)
  assert(!JSON.stringify(queue.body).includes('public_token_hash'))
  assert(!JSON.stringify(queue.body).includes('dedupe_key'))
  assert(!JSON.stringify(queue.body).includes('idempotency_key'))
  const detail = await adminApi(operatorSession.page, 'GET', null, `?id=${business.body.case.id}`)
  assert.equal(detail.status, 200, JSON.stringify(detail.body))
  assert(detail.body.tasks.some((task) => task.task_type === 'capital_case_review'))
  assert(detail.body.events.some((event) => event.event_type === 'case_submitted'))
  pass('operator queue exposes intake, readiness, tasks, and audit history')

  await operatorSession.page.setViewportSize({ width: 1440, height: 1000 })
  await operatorSession.page.goto(`${siteUrl}/admin/funding`, { waitUntil: 'networkidle' })
  await operatorSession.page.getByRole('heading', { name: 'Capital case review' }).waitFor()
  await operatorSession.page.screenshot({ path: '/tmp/vestblock-gate4d-visual/capital-operator-wide.png', fullPage: true })
  const operatorWide = await operatorSession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  assert.equal(operatorWide.scrollWidth, operatorWide.innerWidth)
  await operatorSession.page.setViewportSize({ width: 390, height: 844 })
  await operatorSession.page.screenshot({ path: '/tmp/vestblock-gate4d-visual/capital-operator-mobile.png', fullPage: true })
  const operatorMobile = await operatorSession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  assert.equal(operatorMobile.scrollWidth, operatorMobile.innerWidth)
  pass('operator Capital queue renders without desktop or mobile overflow')

  const businessReview = await adminApi(operatorSession.page, 'PATCH', { id: business.body.case.id, status: 'under_review', assignedTo: operator.id, note: 'Operator verified intake and began review.' })
  assert.equal(businessReview.status, 200, JSON.stringify(businessReview.body))
  const customerUpdated = await pageApi(primarySession.page, `/api/capital/cases?id=${business.body.case.id}`)
  assert.equal(customerUpdated.status, 200)
  assert.equal(customerUpdated.body.case.status, 'under_review')
  assert(customerUpdated.body.events.some((event) => event.to_status === 'under_review'))
  pass('operator assignment and valid status transition persist to customer history')

  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: realEstate.body.case.id, status: 'approved', note: 'Invalid jump.' })).status, 409)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: realEstate.body.case.id, status: 'under_review', note: 'Underwriting pre-review.' })).status, 200)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: realEstate.body.case.id, status: 'declined', note: '' })).status, 422)
  const declined = await adminApi(operatorSession.page, 'PATCH', { id: realEstate.body.case.id, status: 'declined', note: 'Scenario is outside current provider leverage criteria; return to readiness planning.' })
  assert.equal(declined.status, 200, JSON.stringify(declined.body))
  assert.equal(declined.body.case.status, 'declined')
  pass('invalid jumps are rejected and a reasoned decline is recorded')

  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: provider.body.case.id, status: 'under_review', note: 'Provider profile verification started.' })).status, 200)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: provider.body.case.id, status: 'ready_for_provider_review', note: 'Criteria and coverage confirmed.' })).status, 200)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: provider.body.case.id, status: 'provider_review', note: 'Provider decision review opened.' })).status, 200)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: provider.body.case.id, status: 'approved', note: '' })).status, 422)
  assert.equal((await adminApi(operatorSession.page, 'PATCH', { id: provider.body.case.id, status: 'approved', note: 'Verified program matrix dated 2026-08-13 approved for controlled matching.' })).status, 200)
  pass('provider-review approval requires and preserves decision evidence')

  const databaseCases = await admin.from('capital_cases').select('id,case_type,status,lead_id,lender_id,operator_task_id,user_id').in('id', caseIds)
  assert.ifError(databaseCases.error)
  assert.equal(databaseCases.data.length, caseIds.length)
  for (const item of databaseCases.data) {
    if (item.lead_id) leadIds.push(item.lead_id)
    if (item.lender_id && !lenderIds.includes(item.lender_id)) lenderIds.push(item.lender_id)
  }
  assert(databaseCases.data.find((item) => item.id === business.body.case.id)?.lead_id)
  assert(databaseCases.data.find((item) => item.id === realEstate.body.case.id)?.lead_id)
  assert(databaseCases.data.find((item) => item.id === provider.body.case.id)?.lender_id)
  const caseTasks = await admin.from('admin_tasks').select('id,entity_id,status').eq('entity_type', 'capital_case').in('entity_id', caseIds)
  assert.ifError(caseTasks.error)
  assert(caseTasks.data.length >= 6)
  pass('CRM links, provider record, operator tasks, and persisted lifecycle state verified in Supabase')

  const crossSite = await fetch(`${siteUrl}/api/capital/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://malicious.example' }, body: JSON.stringify(guestPayload) })
  assert.equal(crossSite.status, 403)
  pass('cross-site mutation guard rejects forged browser submissions')

  console.log(JSON.stringify({ healthy: true, runId, checks }, null, 2))
} finally {
  if (browser) await browser.close()
  const uniqueCases = [...new Set(caseIds)]
  const uniqueLeads = [...new Set(leadIds)]
  const uniqueLenders = [...new Set(lenderIds)]
  if (uniqueCases.length) {
    await admin.from('admin_tasks').delete().eq('entity_type', 'capital_case').in('entity_id', uniqueCases)
    await admin.from('admin_activity').delete().eq('entity_type', 'capital_case').in('entity_id', uniqueCases)
    await admin.from('capital_case_events').delete().in('capital_case_id', uniqueCases)
    await admin.from('capital_cases').delete().in('id', uniqueCases)
  }
  if (uniqueLeads.length) {
    await admin.from('admin_tasks').delete().eq('entity_type', 'lead').in('entity_id', uniqueLeads)
    await admin.from('admin_activity').delete().eq('entity_type', 'lead').in('entity_id', uniqueLeads)
    await admin.from('leads').delete().in('id', uniqueLeads)
  }
  if (uniqueLenders.length) {
    await admin.from('lender_relationship_events').delete().in('lender_id', uniqueLenders)
    await admin.from('lenders').delete().in('id', uniqueLenders)
  }
  for (const userId of userIds) {
    const cleanup = await admin.auth.admin.deleteUser(userId)
    if (cleanup.error) console.warn(`Cleanup warning for ${userId}: ${cleanup.error.message}`)
  }
}
