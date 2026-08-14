import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = String(process.env.QA_SITE_URL || 'http://127.0.0.1:3417').replace(/\/$/, '')
const qaFailureToken = process.env.PARTICIPANT_PROFILE_QA_ROUTING_FAILURE_TOKEN
assert(supabaseUrl && anonKey && serviceKey && qaFailureToken, 'Supabase and the Gate 4E.2 QA failure token are required')

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = `Gate4E2!${runId}`
const screenshotDir = '/tmp/vestblock-gate4e2-visual'
const userIds = []
const profileIds = []
const checks = []
let browser

function pass(name) {
  checks.push(name)
  console.log(`PASS ${checks.length}. ${name}`)
}

function noCustomerPrivateFields(value) {
  const text = JSON.stringify(value)
  for (const field of [
    'owner_user_id', 'account_profile_id', 'crm_lead_id', 'operator_task_id',
    'assigned_to', 'legacy_entity_id', 'legacy_entity_type', 'legacy_claim_status',
    'idempotency_key', 'operator_verification_note', 'actor_user_id', 'metadata_json',
  ]) assert(!text.includes(`"${field}"`), `Customer response leaked ${field}`)
}

const criteriaByRole = {
  buyer: {
    markets: ['Milwaukee, WI'], geographicRadius: '45 miles', assetTypes: ['Single-family', 'Small multifamily'],
    priceMin: 75000, priceMax: 425000, propertyCondition: ['Light value-add'], occupancyPreferences: ['Vacant'],
    investmentStrategy: ['Long-term rental'], returnThreshold: 'Minimum 9% cash-on-cash after stated assumptions',
    purchaseCapacity: 'Mixed', proofOfFundsStatus: 'Submitted for review', closingTiming: '30 to 45 days after diligence',
    dealSizeCapacity: '$75,000 to $425,000', volumeCapacity: 'Up to two reviewed acquisitions per quarter',
    exclusions: 'No unresolved title defects or environmental hazards.', notes: 'QA-only criteria.',
  },
  investor: {
    markets: ['Chicago, IL'], geographicRadius: '60 miles', assetTypes: ['Multifamily'], priceMax: 1800000,
    investmentStrategy: ['Value-add hold'], purchaseCapacity: 'Financing', proofOfFundsStatus: 'Available on request',
    exclusions: 'No hospitality assets.',
  },
  lender: {
    providerName: 'Gate 4E.2 Capital Test', providerType: 'Direct lender', lendingProducts: ['Bridge', 'DSCR'],
    states: ['Wisconsin', 'Illinois'], propertyTypes: ['Single-family', 'Multifamily'], borrowerTypes: ['Investor'],
    loanAmountMin: 100000, loanAmountMax: 2500000, leverageLimits: 'Up to 75% LTV, provider-supplied and subject to underwriting',
    indicativeRates: 'Provider-supplied range only; subject to underwriting', termsAndFees: 'Case-specific and unverified.',
    minimumCredit: 'Provider-supplied minimum varies by product', experienceRequirements: 'Product-dependent.',
    documentationRequirements: 'Application, entity documents, property information, liquidity evidence, and underwriting file.',
    turnaroundExpectations: 'Indicative review in five business days after a complete file', recourse: 'Product-dependent',
    exclusions: 'No owner-occupied consumer purpose loans.',
  },
  builder: {
    markets: ['Milwaukee, WI'], geographicRadius: '75 miles', constructionTypes: ['Ground-up', 'Renovation'],
    projectTypes: ['Residential'], typicalSize: '1 to 20 units', currentCapacity: 'One additional preconstruction review this quarter.',
    projectStage: ['Estimating'], needs: ['Sites', 'Subcontractors'], licenseDetails: 'Voluntary Wisconsin context; not operator verified.',
    insuranceStatus: 'Self-reported active; evidence not reviewed.',
  },
  developer: {
    markets: ['Milwaukee, WI'], geographicRadius: '50 miles', assetClasses: ['Multifamily', 'Mixed-use'],
    siteCriteria: 'Transit-accessible infill sites with utilities and a plausible entitlement path.', projectStage: 'Site search',
    dealSizeRange: '$2 million to $15 million', capitalNeeds: 'Predevelopment and construction capital context.',
    operatingNeeds: 'Entitlement and construction partners.', partnerPreferences: 'Experienced local builders and capital providers.',
  },
  real_estate_agent: {
    markets: ['Milwaukee County'], geographicRadius: '40 miles', clientFocus: ['Investors', 'Residential'],
    coverage: ['Buyer', 'Seller', 'Listing'], referralPreferences: 'Warm, permissioned introductions after operator review.',
    licenseState: ['Wisconsin'], licenseDetails: 'Voluntary details omitted from QA; not operator verified.',
  },
  wholesaler: {
    acquisitionMarkets: ['Milwaukee, WI'], dispositionMarkets: ['Milwaukee, WI'], propertyTypes: ['Single-family'],
    priceRange: '$50,000 to $275,000', transactionPreferences: ['Assignment', 'Referral'],
    buyerCoverage: 'Private coverage description only; no buyer contacts supplied.', capacity: 'Five responsible reviews monthly',
    exclusions: 'No properties without a documented equitable interest.',
  },
  business_buyer: {
    industries: ['Home services'], geography: ['Midwest'], businessSize: '5 to 40 employees',
    financialRange: '$500,000 to $5 million enterprise value; owner-supplied target.', objective: 'Owner-operator acquisition.',
    preferredStructure: 'Flexible after diligence.', experience: 'Operating and integration experience.', timeline: 'Within 12 months',
    confidentiality: 'Share identity only after approved review.', exclusions: 'No unresolved regulatory actions.',
  },
  business_seller: {
    industries: ['Property services'], geography: ['Wisconsin'], businessSize: '10 employees',
    financialRange: 'Owner-supplied range; unverified.', objective: 'Prepare for a confidential full-sale review.',
    preferredStructure: 'Flexible after advice and diligence.', experience: 'Founder-led operation.', timeline: 'Six to twelve months',
    confidentiality: 'No business identity or financial detail before approved confidential review.', exclusions: 'No broad public marketing.',
  },
  service_provider: {
    serviceCategories: ['Construction estimating'], markets: ['Milwaukee, WI'], geographicRadius: '60 miles',
    capacity: 'Two responsible project reviews per month.', availability: 'Four-week indicative start window.',
    credentials: 'Provider-supplied experience; not operator verified.', insuranceOrLicense: 'Self-reported; evidence not reviewed.',
    pricingContext: 'Voluntary context only, not a quote.', partnerPreferences: 'Clear scopes and permissioned handoffs.',
  },
}

function profilePayload(role, email, overrides = {}) {
  return {
    role,
    identityType: role === 'buyer' ? 'individual' : 'organization',
    displayName: `Gate 4E.2 ${role.replaceAll('_', ' ')}`,
    organizationName: role === 'buyer' ? '' : `Gate 4E.2 ${role.replaceAll('_', ' ')} LLC`,
    contactEmail: email,
    contactPhone: '414-555-0142',
    summary: 'Disposable Gate 4E.2 profile used to verify owned, permission-controlled participant operations.',
    criteria: criteriaByRole[role],
    communicationPreferences: { email: true, phone: false },
    marketingConsent: false,
    matchingConsent: role === 'buyer',
    outreachConsent: false,
    publicVisibilityConsent: role === 'buyer' || role === 'builder' || role === 'business_buyer',
    publicFieldKeys: role === 'buyer'
      ? ['markets', 'assetTypes']
      : role === 'builder'
        ? ['markets', 'constructionTypes']
        : role === 'business_buyer'
          ? ['industries']
          : [],
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  }
}

async function createUser(label, role = 'member') {
  const email = `vestblock+gate4e2-${label}-${runId}@example.com`
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Gate 4E.2 ${label}`, member_roles: ['participant'] },
  })
  assert.ifError(result.error)
  assert(result.data.user?.id)
  userIds.push(result.data.user.id)
  if (role === 'admin') {
    const profile = await admin.from('user_profiles').update({ role: 'admin' }).eq('id', result.data.user.id).select('role').single()
    assert.ifError(profile.error)
    assert.equal(profile.data.role, 'admin')
  }
  return { id: result.data.user.id, email }
}

async function signedInPage(user, redirect = '/workspace/profiles') {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${siteUrl}/login?redirect=${encodeURIComponent(redirect)}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Login' }).waitFor()
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(password)
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]')
    return button instanceof HTMLButtonElement && !button.disabled
  }, null, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((url) => url.pathname === redirect, { timeout: 45_000 })
  await page.waitForLoadState('domcontentloaded')
  return { context, page }
}

async function pageApi(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const headers = options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.json().catch(() => ({})),
    }
  }, { path, options })
}

async function createProfile(page, payload) {
  const response = await pageApi(page, '/api/participant-profiles', { method: 'POST', body: payload })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  noCustomerPrivateFields(response.body)
  profileIds.push(response.body.profile.id)
  return response.body.profile
}

async function databaseProfile(id) {
  const result = await admin.from('participant_profiles').select('*').eq('id', id).single()
  assert.ifError(result.error)
  return result.data
}

async function lifecycle(page, profile, action, headers) {
  const current = await databaseProfile(profile.id)
  const response = await pageApi(page, `/api/participant-profiles/${profile.id}/lifecycle`, {
    method: 'POST', body: { action, expectedVersion: current.profile_version }, headers,
  })
  return response
}

async function adminAction(page, profileId, action, reason = '', extra = {}) {
  const current = await databaseProfile(profileId)
  return pageApi(page, `/api/admin/participant-profiles/${profileId}`, {
    method: 'POST', body: { action, reason, expectedVersion: current.profile_version, ...extra },
  })
}

async function publicProfile(slug) {
  const response = await fetch(`${siteUrl}/api/public/participant-profiles/${slug}`, { cache: 'no-store' })
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) }
}

try {
  const primary = await createUser('primary')
  const secondary = await createUser('secondary')
  const operator = await createUser('operator', 'admin')
  browser = await chromium.launch()
  const primarySession = await signedInPage(primary)
  const secondarySession = await signedInPage(secondary)
  const operatorSession = await signedInPage(operator, '/admin/participant-profiles')
  await mkdir(screenshotDir, { recursive: true })

  const buyer = await createProfile(primarySession.page, profilePayload('buyer', primary.email))
  const investor = await createProfile(primarySession.page, profilePayload('investor', primary.email))
  let ownedList = await pageApi(primarySession.page, '/api/participant-profiles')
  assert.equal(ownedList.status, 200)
  assert(ownedList.body.profiles.some((item) => item.id === buyer.id))
  assert(ownedList.body.profiles.some((item) => item.id === investor.id))
  assert.equal(new Set(ownedList.body.profiles.map((item) => item.role)).size, ownedList.body.profiles.length)
  pass('a user can hold multiple participant roles without duplicate accounts')

  let buyerEdit = await pageApi(primarySession.page, `/api/participant-profiles/${buyer.id}`, {
    method: 'PATCH', body: { summary: 'Edited buyer criteria summary for the owned QA profile.', expectedVersion: buyer.profile_version },
  })
  assert.equal(buyerEdit.status, 200, JSON.stringify(buyerEdit.body))
  let buyerSubmit = await lifecycle(primarySession.page, buyer, 'submit')
  assert.equal(buyerSubmit.status, 200, JSON.stringify(buyerSubmit.body))
  assert.equal(buyerSubmit.body.profile.status, 'pending_review')
  const buyerTask = await admin.from('admin_tasks').select('id,entity_type,entity_id').eq('entity_type', 'participant_profile').eq('entity_id', buyer.id).single()
  assert.ifError(buyerTask.error)

  const adminQueue = await pageApi(operatorSession.page, `/api/admin/participant-profiles?search=${encodeURIComponent(primary.email)}&role=buyer&status=pending_review&origin=customer`)
  assert.equal(adminQueue.status, 200, JSON.stringify(adminQueue.body))
  assert(adminQueue.body.profiles.some((item) => item.id === buyer.id))
  assert(adminQueue.body.operators.some((item) => item.email === operator.email && item.name.includes('Gate 4E.2 operator')))
  let adminResult = await adminAction(operatorSession.page, buyer.id, 'assign', '', { assignedOperatorEmail: operator.email })
  assert.equal(adminResult.status, 200, JSON.stringify(adminResult.body))
  adminResult = await adminAction(operatorSession.page, buyer.id, 'request_information', 'Clarify the no-go criteria before activation.')
  assert.equal(adminResult.status, 200)
  buyerEdit = await pageApi(primarySession.page, `/api/participant-profiles/${buyer.id}`, {
    method: 'PATCH', body: { summary: 'Edited after the operator information request.', expectedVersion: (await databaseProfile(buyer.id)).profile_version },
  })
  assert.equal(buyerEdit.status, 200)
  buyerSubmit = await lifecycle(primarySession.page, buyer, 'submit')
  assert.equal(buyerSubmit.status, 200)
  adminResult = await adminAction(operatorSession.page, buyer.id, 'approve', 'Criteria reviewed for profile activation; credentials and funds were not verified.')
  assert.equal(adminResult.status, 200, JSON.stringify(adminResult.body))
  assert.equal(adminResult.body.profile.status, 'active')

  const buyerPublicSlug = adminResult.body.profile.public_slug
  assert(buyerPublicSlug)
  let publicBuyer = await publicProfile(buyerPublicSlug)
  assert.equal(publicBuyer.status, 200, JSON.stringify(publicBuyer.body))
  assert.match(publicBuyer.headers.get('cache-control') || '', /no-store/)
  const publicKeys = Object.keys(publicBuyer.body.profile).sort()
  assert.deepEqual(publicKeys, ['criteria', 'displayName', 'lastVerifiedAt', 'organizationName', 'providerSuppliedBoundary', 'role', 'roleLabel', 'slug', 'summary', 'updatedAt'].sort())
  assert.deepEqual(Object.keys(publicBuyer.body.profile.criteria).sort(), ['assetTypes', 'markets'])
  assert(!JSON.stringify(publicBuyer.body).includes(primary.email))
  const visiblePublicBuyer = structuredClone(publicBuyer.body)
  const publicPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await publicPage.goto(`${siteUrl}/profiles/public/${buyerPublicSlug}`, { waitUntil: 'domcontentloaded' })
  await publicPage.getByRole('heading', { name: /Gate 4E.2 buyer/i }).waitFor()
  await publicPage.screenshot({ path: `${screenshotDir}/public-buyer-1440.png`, fullPage: true })

  let revoke = await pageApi(primarySession.page, `/api/participant-profiles/${buyer.id}`, {
    method: 'PATCH', body: { publicVisibilityConsent: false, expectedVersion: (await databaseProfile(buyer.id)).profile_version },
  })
  assert.equal(revoke.status, 200)
  publicBuyer = await publicProfile(buyerPublicSlug)
  assert.equal(publicBuyer.status, 404)
  pass('buyer profile creation, draft, save, submit, edit, pause, reactivate, and withdrawal work')

  revoke = await pageApi(primarySession.page, `/api/participant-profiles/${buyer.id}`, {
    method: 'PATCH', body: { publicVisibilityConsent: true, expectedVersion: (await databaseProfile(buyer.id)).profile_version },
  })
  assert.equal(revoke.status, 200)
  const reenabledBuyerSlug = revoke.body.profile.public_slug
  let paused = await lifecycle(primarySession.page, buyer, 'pause')
  assert.equal(paused.status, 200)
  assert.equal((await publicProfile(reenabledBuyerSlug)).status, 404)
  let reactivated = await lifecycle(primarySession.page, buyer, 'reactivate')
  assert.equal(reactivated.status, 200)
  assert.equal(reactivated.body.profile.status, 'active')

  const lender = await createProfile(primarySession.page, profilePayload('lender', primary.email))
  const lenderEdit = await pageApi(primarySession.page, `/api/participant-profiles/${lender.id}`, {
    method: 'PATCH', body: { summary: 'Edited provider-supplied lender context before review.', expectedVersion: lender.profile_version },
  })
  assert.equal(lenderEdit.status, 200)
  const lenderSubmit = await lifecycle(primarySession.page, lender, 'submit')
  assert.equal(lenderSubmit.status, 200)
  adminResult = await adminAction(operatorSession.page, lender.id, 'approve', 'Provider-supplied criteria reviewed; no approval, pricing, availability, or commitment is implied.')
  assert.equal(adminResult.status, 200)
  paused = await lifecycle(primarySession.page, lender, 'pause')
  assert.equal(paused.status, 200)
  reactivated = await lifecycle(primarySession.page, lender, 'reactivate')
  assert.equal(reactivated.status, 200)
  let withdrawn = await lifecycle(primarySession.page, lender, 'withdraw')
  assert.equal(withdrawn.status, 200)
  assert.equal(withdrawn.body.profile.status, 'withdrawn')
  pass('lender profile creation, draft, save, submit, edit, pause, reactivate, and withdrawal work')

  const schemaRoles = ['builder', 'developer', 'real_estate_agent', 'wholesaler', 'business_buyer', 'business_seller', 'service_provider']
  const roleProfiles = {}
  for (const role of schemaRoles) {
    roleProfiles[role] = await createProfile(primarySession.page, profilePayload(role, primary.email))
    const persisted = await databaseProfile(roleProfiles[role].id)
    assert.deepEqual(persisted.criteria_json, criteriaByRole[role])
  }
  pass('builder, developer, agent, wholesaler, business buyer, business seller, and service-provider schemas persist relevant fields')

  const resume = await pageApi(primarySession.page, `/api/participant-profiles/${investor.id}`)
  assert.equal(resume.status, 200)
  assert.equal(resume.body.profile.id, investor.id)
  noCustomerPrivateFields(resume.body)
  pass('authenticated users can resume only their own profiles')

  const crossAccount = await pageApi(secondarySession.page, `/api/participant-profiles/${buyer.id}`)
  assert.equal(crossAccount.status, 404)
  const crossEdit = await pageApi(secondarySession.page, `/api/participant-profiles/${buyer.id}`, {
    method: 'PATCH', body: { summary: 'Unauthorized edit.', expectedVersion: (await databaseProfile(buyer.id)).profile_version },
  })
  assert.equal(crossEdit.status, 404)
  pass('cross-account profile access and mutation fail')

  const importedSlug = `imported-gate4e2-${runId}`.replaceAll(/[^a-z0-9-]/g, '-').slice(0, 80)
  const imported = await admin.from('participant_profiles').insert({
    owner_user_id: operator.id,
    role: 'service_provider',
    origin: 'discovered',
    status: 'active',
    identity_type: 'organization',
    display_name: 'Discovered Gate 4E.2 prospect',
    organization_name: 'Discovered QA record',
    contact_email: primary.email,
    summary: 'Disposable discovered-origin ownership boundary fixture.',
    criteria_json: criteriaByRole.service_provider,
    communication_preferences_json: { email: false, phone: false },
    public_visibility_consent: true,
    public_visibility_consented_at: new Date().toISOString(),
    public_visibility_consent_version: 'gate-4e2-v1',
    public_slug: importedSlug,
    public_field_keys: ['serviceCategories', 'markets'],
    idempotency_key: crypto.randomUUID(),
  }).select('*').single()
  assert.ifError(imported.error)
  profileIds.push(imported.data.id)
  ownedList = await pageApi(primarySession.page, '/api/participant-profiles')
  assert(!ownedList.body.profiles.some((item) => item.id === imported.data.id))
  assert.equal((await publicProfile(importedSlug)).status, 404)
  const claimAttempt = await pageApi(primarySession.page, '/api/participant-profiles', {
    method: 'POST', body: { ...profilePayload('buyer', primary.email), legacyEntityId: imported.data.id },
  })
  assert.equal(claimAttempt.status, 400)
  pass('imported or discovered prospects cannot be claimed through email matching')

  const duplicatePayload = profilePayload('buyer', primary.email)
  const duplicate = await pageApi(primarySession.page, '/api/participant-profiles', { method: 'POST', body: duplicatePayload })
  assert.equal(duplicate.status, 409)
  const buyerCount = await admin.from('participant_profiles').select('id', { count: 'exact' }).eq('owner_user_id', primary.id).eq('role', 'buyer')
  assert.equal(buyerCount.count, 1)
  pass('duplicate role profiles fail safely under the documented owner-and-role uniqueness rule')

  const incomplete = await createProfile(secondarySession.page, profilePayload('business_buyer', secondary.email, { criteria: {} }))
  const incompleteSubmit = await lifecycle(secondarySession.page, incomplete, 'submit')
  assert.equal(incompleteSubmit.status, 422)
  assert(incompleteSubmit.body.missing.includes('industries'))
  assert.equal((await databaseProfile(incomplete.id)).status, 'draft')
  pass('incomplete submissions return specific errors without corrupting the saved draft')

  const service = roleProfiles.service_provider
  const criteriaBeforeAi = (await databaseProfile(service.id)).criteria_json
  const normalize = await pageApi(primarySession.page, `/api/participant-profiles/${service.id}/normalizations`, {
    method: 'POST',
    body: { originalText: 'I provide construction estimating in Milwaukee and can responsibly review two projects per month. I do not want automatic outreach or referrals.' },
  })
  assert.equal(normalize.status, 200, `AI normalization failed: ${JSON.stringify(normalize.body)}`)
  assert.equal(normalize.body.requiresApproval, true)
  assert.deepEqual((await databaseProfile(service.id)).criteria_json, criteriaBeforeAi)
  const normalization = normalize.body.normalization
  assert.equal(normalization.status, 'proposed')
  assert.match(normalization.provider_model, /^openai\//)
  const aiDecision = await pageApi(primarySession.page, `/api/participant-profiles/${service.id}/normalizations/${normalization.id}`, {
    method: 'POST', body: { action: 'approve', corrections: {}, expectedVersion: (await databaseProfile(service.id)).profile_version },
  })
  assert.equal(aiDecision.status, 200, JSON.stringify(aiDecision.body))
  assert.equal(aiDecision.body.approved, true)
  const approvedNormalization = await admin.from('participant_profile_normalizations').select('*').eq('id', normalization.id).single()
  assert.ifError(approvedNormalization.error)
  assert(approvedNormalization.data.original_text)
  assert(approvedNormalization.data.proposed_json)
  assert(approvedNormalization.data.approved_json)
  assert(approvedNormalization.data.approved_at)
  const expectedApprovedCriteria = { ...criteriaBeforeAi, ...(normalization.proposed_json?.criteria || {}) }
  assert.deepEqual(approvedNormalization.data.approved_json, expectedApprovedCriteria)
  assert.deepEqual(aiDecision.body.profile.criteria_json, expectedApprovedCriteria)
  pass('AI normalization remains a persisted proposal until explicit user approval')

  const manual = await createProfile(secondarySession.page, profilePayload('service_provider', secondary.email))
  assert.equal((await databaseProfile(manual.id)).status, 'draft')
  pass('manual structured profile completion works independently of AI availability')

  const permissions = await databaseProfile(buyer.id)
  assert.deepEqual(permissions.communication_preferences_json, { email: true, phone: false })
  assert.equal(permissions.marketing_consent, false)
  assert.equal(permissions.matching_consent, true)
  assert.equal(permissions.outreach_consent, false)
  assert.equal(permissions.public_visibility_consent, true)
  assert(permissions.matching_consent_at)
  assert.equal(permissions.marketing_consent_at, null)
  assert.equal(permissions.outreach_consent_at, null)
  pass('communication, marketing, visibility, matching, and outreach permissions persist separately')

  assert.equal((await databaseProfile(investor.id)).public_visibility_consent, false)
  assert.equal((await databaseProfile(investor.id)).public_slug, null)
  pass('profiles are private by default')

  assert.equal((await publicProfile(buyerPublicSlug)).status, 404)
  pass('visibility revocation removes public access immediately with no-store delivery')

  assert.deepEqual(Object.keys(visiblePublicBuyer.profile.criteria).sort(), ['assetTypes', 'markets'])
  assert(!JSON.stringify(visiblePublicBuyer).includes('contact_email'))
  pass('public responses expose only the selected strict allowlist')

  const builderSubmit = await lifecycle(primarySession.page, roleProfiles.builder, 'submit')
  assert.equal(builderSubmit.status, 200)
  adminResult = await adminAction(operatorSession.page, roleProfiles.builder.id, 'decline', 'Current criteria need material clarification before approval.')
  assert.equal(adminResult.status, 200)
  assert.equal((await publicProfile((await databaseProfile(roleProfiles.builder.id)).public_slug)).status, 404)
  const declinedEdit = await pageApi(primarySession.page, `/api/participant-profiles/${roleProfiles.builder.id}`, {
    method: 'PATCH', body: { summary: 'Revised after the reasoned decline.', expectedVersion: (await databaseProfile(roleProfiles.builder.id)).profile_version },
  })
  assert.equal(declinedEdit.status, 200)
  const declinedResubmit = await lifecycle(primarySession.page, roleProfiles.builder, 'submit')
  assert.equal(declinedResubmit.status, 200)
  assert.equal(declinedResubmit.body.profile.status, 'pending_review')
  adminResult = await adminAction(operatorSession.page, roleProfiles.builder.id, 'decline', 'The revised QA profile remains declined for public-visibility proof.')
  assert.equal(adminResult.status, 200)
  withdrawn = await lifecycle(primarySession.page, buyer, 'withdraw')
  assert.equal(withdrawn.status, 200)
  assert.equal((await publicProfile(reenabledBuyerSlug)).status, 404)
  assert.equal((await publicProfile(importedSlug)).status, 404)
  pass('paused, private, declined, withdrawn, and imported profiles are never public')

  const accountLink = await databaseProfile(investor.id)
  assert(accountLink.account_profile_id)
  const account = await admin.from('user_profiles').select('id,user_id').eq('id', accountLink.account_profile_id).maybeSingle()
  assert.ifError(account.error)
  assert(account.data)
  assert.equal(accountLink.crm_lead_id, null)
  pass('profiles connect to the existing account and optional CRM linkage instead of a duplicate CRM')

  assert(buyerTask.data.id)
  pass('operator review tasks are created durably')

  const developerSubmit = await lifecycle(primarySession.page, roleProfiles.developer, 'submit')
  assert.equal(developerSubmit.status, 200)
  adminResult = await adminAction(operatorSession.page, roleProfiles.developer.id, 'pause', 'Pause while the operator confirms site-criteria context.')
  assert.equal(adminResult.status, 200)
  adminResult = await adminAction(operatorSession.page, roleProfiles.developer.id, 'archive', 'Disposable QA profile completed its lifecycle proof.')
  assert.equal(adminResult.status, 200)
  const businessBuyerSubmit = await lifecycle(primarySession.page, roleProfiles.business_buyer, 'submit')
  assert.equal(businessBuyerSubmit.status, 200)
  adminResult = await adminAction(operatorSession.page, roleProfiles.business_buyer.id, 'approve', 'Criteria reviewed for profile activation only.')
  assert.equal(adminResult.status, 200)
  const businessBuyerSlug = adminResult.body.profile.public_slug
  assert.equal((await publicProfile(businessBuyerSlug)).status, 200)
  paused = await lifecycle(primarySession.page, roleProfiles.business_buyer, 'pause')
  assert.equal(paused.status, 200)
  const pausedBusinessBuyer = await databaseProfile(roleProfiles.business_buyer.id)
  const pausedMaterialEdit = await pageApi(primarySession.page, `/api/participant-profiles/${roleProfiles.business_buyer.id}`, {
    method: 'PATCH',
    body: {
      criteria: { ...pausedBusinessBuyer.criteria_json, objective: 'Revised owner-operator acquisition criteria that require a new review.' },
      expectedVersion: pausedBusinessBuyer.profile_version,
    },
  })
  assert.equal(pausedMaterialEdit.status, 200)
  reactivated = await lifecycle(primarySession.page, roleProfiles.business_buyer, 'reactivate')
  assert.equal(reactivated.status, 200)
  assert.equal(reactivated.body.profile.status, 'pending_review')
  assert.equal((await publicProfile(businessBuyerSlug)).status, 404)
  adminResult = await adminAction(operatorSession.page, roleProfiles.business_buyer.id, 'approve', 'Revised criteria received a new operator review.')
  assert.equal(adminResult.status, 200)
  pass('operators can search, assign, request information, approve, decline with a reason, pause, and archive')

  const badAssignment = await adminAction(operatorSession.page, roleProfiles.business_buyer.id, 'assign', '', { assignedOperatorEmail: 'unknown-operator@example.com' })
  assert.equal(badAssignment.status, 422)
  assert(adminQueue.body.operators.some((item) => item.name && item.email))
  pass('human-readable operator assignment works by authorized name and email without raw UUID input')

  const customerHistory = await pageApi(primarySession.page, `/api/participant-profiles/${roleProfiles.builder.id}`)
  assert.equal(customerHistory.status, 200)
  assert(customerHistory.body.events.some((event) => event.event_type === 'operator_decline'))
  noCustomerPrivateFields(customerHistory.body)
  pass('customer-safe status history persists without operator identifiers or metadata')

  const operatorHistory = await pageApi(operatorSession.page, `/api/admin/participant-profiles/${roleProfiles.builder.id}`)
  assert.equal(operatorHistory.status, 200)
  assert(operatorHistory.body.events.some((event) => event.actor_kind === 'operator'))
  assert(operatorHistory.body.events.every((event) => Object.hasOwn(event, 'metadata_json')))
  pass('complete internal history remains available to authorized operators')

  await secondarySession.page.goto(`${siteUrl}/workspace/profiles`, { waitUntil: 'domcontentloaded' })
  await secondarySession.page.getByRole('heading', { name: 'One account. Every role you bring to the table.' }).waitFor()
  await secondarySession.page.getByText('Loading profile status…').waitFor({ state: 'hidden', timeout: 30_000 })
  await secondarySession.page.screenshot({ path: `${screenshotDir}/participant-role-selection-1440.png`, fullPage: true })
  const agentCard = secondarySession.page.locator('article').filter({ has: secondarySession.page.getByRole('heading', { name: 'Real estate agent' }) })
  await agentCard.getByRole('link', { name: 'Create profile' }).click()
  await secondarySession.page.getByRole('heading', { name: 'Real estate agent' }).waitFor()
  await secondarySession.page.getByLabel('Profile represents').selectOption('organization')
  await secondarySession.page.getByLabel('Organization name').fill('Gate 4E.2 real estate agent LLC')
  await secondarySession.page.getByRole('button', { name: /2 Criteria/ }).click()
  await secondarySession.page.getByLabel(/Markets/).fill('Milwaukee County, Wisconsin')
  await secondarySession.page.getByLabel(/Client focus/).fill('Residential investors, first-time buyers')
  await secondarySession.page.getByLabel(/Transaction coverage/).fill('Buyer, seller, listing')
  await secondarySession.page.getByRole('button', { name: /3 Permissions/ }).click()
  await secondarySession.page.getByRole('switch', { name: 'Record future matching permission' }).click()
  await secondarySession.page.getByRole('button', { name: /4 Review/ }).click()
  await secondarySession.page.getByRole('button', { name: 'Save draft' }).last().click()
  await secondarySession.page.waitForURL((url) => /^\/workspace\/profiles\/[0-9a-f-]+$/.test(url.pathname), { timeout: 30_000 })
  const uiProfileId = secondarySession.page.url().split('/').pop()
  assert(uiProfileId)
  profileIds.push(uiProfileId)
  await secondarySession.page.getByRole('button', { name: /4 Review/ }).click()
  const uiLifecycleResponsePromise = secondarySession.page
    .waitForResponse((response) => response.url().endsWith(`/api/participant-profiles/${uiProfileId}/lifecycle`) && response.request().method() === 'POST')
    .then((response) => ({ response, error: null }))
    .catch((error) => ({ response: null, error }))
  const [uiSaveBeforeSubmitResponse] = await Promise.all([
    secondarySession.page.waitForResponse((response) => response.url().endsWith(`/api/participant-profiles/${uiProfileId}`) && response.request().method() === 'PATCH'),
    secondarySession.page.getByRole('button', { name: 'Submit for review' }).click(),
  ])
  const uiSaveBeforeSubmitPayload = await uiSaveBeforeSubmitResponse.json()
  assert.equal(uiSaveBeforeSubmitResponse.status(), 200, `browser-driven save before submit failed (${uiSaveBeforeSubmitResponse.status()}): ${JSON.stringify(uiSaveBeforeSubmitPayload)}`)
  const uiLifecycleResult = await uiLifecycleResponsePromise
  assert(uiLifecycleResult.response, `browser-driven submit did not reach the lifecycle route: ${uiLifecycleResult.error?.message || 'unknown error'}`)
  const uiSubmitResponse = uiLifecycleResult.response
  const uiSubmitPayload = await uiSubmitResponse.json()
  assert([200, 202].includes(uiSubmitResponse.status()), `browser-driven submit failed (${uiSubmitResponse.status()}): ${JSON.stringify(uiSubmitPayload)}`)
  assert.equal(uiSubmitPayload.profile?.status, 'pending_review')
  await secondarySession.page.getByText('Pending review', { exact: true }).first().waitFor({ timeout: 30_000 })
  await operatorSession.page.goto(`${siteUrl}/admin/participant-profiles`, { waitUntil: 'domcontentloaded' })
  await operatorSession.page.getByText('Loading queue…').waitFor({ state: 'hidden', timeout: 30_000 })
  await operatorSession.page.getByLabel('Search').fill(secondary.email)
  await Promise.all([
    operatorSession.page.waitForResponse((response) => response.url().includes('/api/admin/participant-profiles?') && response.request().method() === 'GET'),
    operatorSession.page.getByRole('button', { name: 'Apply filters' }).click(),
  ])
  const uiAgentQueueItem = operatorSession.page.getByRole('button').filter({ hasText: 'Gate 4E.2 real estate agent LLC' }).first()
  await uiAgentQueueItem.waitFor()
  await uiAgentQueueItem.click()
  await operatorSession.page.getByRole('heading', { name: 'Gate 4E.2 real estate agent LLC' }).waitFor()
  await Promise.all([
    operatorSession.page.waitForResponse((response) => response.url().endsWith(`/api/admin/participant-profiles/${uiProfileId}`) && response.request().method() === 'POST'),
    operatorSession.page.getByRole('button', { name: 'Approve' }).click(),
  ])
  await secondarySession.page.reload({ waitUntil: 'domcontentloaded' })
  await secondarySession.page.getByText('Active', { exact: true }).first().waitFor({ timeout: 30_000 })

  const crossSite = await fetch(`${siteUrl}/api/participant-profiles`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://malicious.example' },
    body: JSON.stringify(profilePayload('buyer', primary.email)),
  })
  assert.equal(crossSite.status, 403)
  let rateLimited = false
  for (let index = 0; index < 24; index += 1) {
    const response = await pageApi(primarySession.page, '/api/participant-profiles', { method: 'POST', body: { invalid: index } })
    if (response.status === 429) { rateLimited = true; break }
  }
  assert(rateLimited)
  pass('same-origin mutation and rate-limit protections reject abusive requests')

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  assert((await anon.from('participant_profiles').select('id').limit(1)).error)
  const authenticated = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  assert.ifError((await authenticated.auth.signInWithPassword({ email: primary.email, password })).error)
  assert((await authenticated.from('participant_profiles').select('id').limit(1)).error)
  assert((await authenticated.rpc('approve_participant_normalization', {
    p_normalization_id: crypto.randomUUID(), p_profile_id: crypto.randomUUID(), p_owner_user_id: primary.id,
    p_expected_version: 1, p_approved_json: {}, p_corrections_json: {},
  })).error)
  pass('RLS, restrictive grants, and service-only approval RPC block unauthorized direct access')

  const wholesalerFailure = await lifecycle(primarySession.page, roleProfiles.wholesaler, 'submit', {
    'x-vestblock-qa-routing-failure': qaFailureToken,
  })
  assert.equal(wholesalerFailure.status, 202, JSON.stringify(wholesalerFailure.body))
  assert.equal(wholesalerFailure.body.profile.safe_failure_state, 'operator_routing_pending')
  const failurePersisted = await databaseProfile(roleProfiles.wholesaler.id)
  assert.equal(failurePersisted.status, 'pending_review')
  assert.equal(failurePersisted.operator_task_id, null)
  const retry = await lifecycle(primarySession.page, roleProfiles.wholesaler, 'submit')
  assert.equal(retry.status, 200, JSON.stringify(retry.body))
  assert((await databaseProfile(roleProfiles.wholesaler.id)).operator_task_id)
  pass('operator-task routing failure leaves a saved recoverable state and idempotent retry repairs it')

  const outreachTables = ['outreach_messages', 'outreach_queue']
  const outreachSnapshots = []
  for (const table of outreachTables) {
    const result = await admin.from(table).select('id', { count: 'exact', head: true })
    if (!result.error) outreachSnapshots.push([table, result.count])
  }
  assert.equal((await admin.from('participant_profile_events').select('id', { count: 'exact' }).in('participant_profile_id', profileIds).like('event_type', '%outreach%')).count || 0, 0)
  assert.equal((await admin.from('participant_profile_events').select('id', { count: 'exact' }).in('participant_profile_id', profileIds).like('event_type', '%match%')).count || 0, 0)
  for (const [table, count] of outreachSnapshots) {
    const after = await admin.from(table).select('id', { count: 'exact', head: true })
    assert.equal(after.count, count)
  }
  pass('no matching, outreach, advertising, n8n, or live provider action occurs')

  await primarySession.page.goto(`${siteUrl}/workspace`, { waitUntil: 'domcontentloaded' })
  await primarySession.page.getByRole('link', { name: /Manage participant profiles/i }).waitFor()
  await primarySession.page.getByRole('link', { name: /Manage participant profiles/i }).click()
  await primarySession.page.waitForURL((url) => url.pathname === '/workspace/profiles')
  await primarySession.page.getByRole('heading', { name: 'One account. Every role you bring to the table.' }).waitFor()
  assert(await primarySession.page.getByText(/profiles remain separate; your account stays unified/i).isVisible())
  pass('browser-driven role selection, form, permissions, save, submit, operator approval, status, and workspace navigation work under one account')

  const hub = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await hub.goto(`${siteUrl}/real-estate`, { waitUntil: 'domcontentloaded' })
  for (const role of ['buyer', 'investor', 'lender', 'builder', 'developer', 'real_estate_agent', 'wholesaler']) {
    assert.equal(await hub.locator(`a[href="/workspace/profiles/new?role=${role}"]`).count(), 1)
  }
  assert.match(await hub.locator('body').innerText(), /Account profile · operational now/i)
  assert.equal(await hub.locator('a[href^="/sell"]').count(), 1)
  await hub.screenshot({ path: `${screenshotDir}/real-estate-hub-1440.png`, fullPage: true })
  pass('Real Estate hub availability labels and role entry links remain honest and distinct')

  await primarySession.page.goto(`${siteUrl}/workspace/profiles/${investor.id}`, { waitUntil: 'domcontentloaded' })
  await primarySession.page.getByRole('heading', { name: 'Real estate investor' }).waitFor()
  for (const width of [1440, 1024, 768, 390]) {
    await primarySession.page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const dimensions = await primarySession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    assert.equal(dimensions.scrollWidth, dimensions.innerWidth, `customer profile overflow at ${width}`)
    await primarySession.page.screenshot({ path: `${screenshotDir}/participant-workbench-${width}.png`, fullPage: true })
  }
  await operatorSession.page.setViewportSize({ width: 1440, height: 1000 })
  await operatorSession.page.goto(`${siteUrl}/admin/participant-profiles`, { waitUntil: 'domcontentloaded' })
  await operatorSession.page.getByRole('heading', { name: 'Profile review desk' }).waitFor()
  await operatorSession.page.getByText('Loading queue…').waitFor({ state: 'hidden', timeout: 30_000 })
  const investorQueueItem = operatorSession.page.getByRole('button').filter({ hasText: 'Gate 4E.2 investor LLC' }).first()
  await investorQueueItem.click()
  await operatorSession.page.getByRole('heading', { name: 'Gate 4E.2 investor LLC' }).waitFor()
  await operatorSession.page.screenshot({ path: `${screenshotDir}/participant-admin-1440.png`, fullPage: true })
  await operatorSession.page.setViewportSize({ width: 390, height: 844 })
  const operatorDimensions = await operatorSession.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  assert.equal(operatorDimensions.scrollWidth, operatorDimensions.innerWidth)
  await operatorSession.page.screenshot({ path: `${screenshotDir}/participant-admin-390.png`, fullPage: true })
  const adminMenuTrigger = operatorSession.page.getByRole('button', { name: 'Open navigation' })
  await adminMenuTrigger.click()
  await operatorSession.page.getByRole('dialog', { name: 'Admin navigation' }).waitFor()
  assert.equal(await operatorSession.page.evaluate(() => document.body.style.overflow), 'hidden')
  assert(await operatorSession.page.getByRole('button', { name: 'Close navigation' }).last().evaluate((element) => element === document.activeElement))
  const undersizedAdminDrawerTargets = await operatorSession.page.locator('#admin-mobile-navigation a:visible, #admin-mobile-navigation button:visible').evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width < 44 || rect.height < 44
  }).map((element) => ({ text: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
  assert.deepEqual(undersizedAdminDrawerTargets, [])
  await operatorSession.page.keyboard.press('Escape')
  await operatorSession.page.getByRole('dialog', { name: 'Admin navigation' }).waitFor({ state: 'hidden' })
  assert(await adminMenuTrigger.evaluate((element) => element === document.activeElement))
  pass('desktop, tablet, and mobile participant layouts have zero horizontal overflow at 1440, 1024, 768, and 390 pixels')

  await primarySession.page.setViewportSize({ width: 390, height: 844 })
  const unlabeled = await primarySession.page.locator('main input, main textarea, main select').evaluateAll((elements) => elements.filter((element) => !element.labels?.length && !element.getAttribute('aria-label')).length)
  assert.equal(unlabeled, 0)
  const stepButton = primarySession.page.getByRole('button', { name: /2 Criteria/ })
  await stepButton.focus()
  await stepButton.press('Enter')
  assert(await primarySession.page.getByRole('heading', { name: /Make the profile useful/i }).isVisible())
  assert(await stepButton.evaluate((element) => getComputedStyle(element, ':focus-visible').outlineStyle !== 'none'))
  await primarySession.page.getByRole('button', { name: /3 Permissions/ }).click()
  await primarySession.page.getByRole('heading', { name: /You control each use separately/i }).waitFor()
  const undersized = await primarySession.page.locator('main button:visible, main input:not([type="checkbox"]):visible, main textarea:visible, main select:visible').evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height < 44
  }).map((element) => ({ tag: element.tagName, text: element.textContent, height: element.getBoundingClientRect().height })))
  assert.deepEqual(undersized, [])
  const undersizedShellControls = await primarySession.page.locator('header button:visible').evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width < 44 || rect.height < 44
  }).map((element) => ({ text: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
  assert.deepEqual(undersizedShellControls, [])
  const customerMenuTrigger = primarySession.page.getByRole('button', { name: 'Toggle Menu' })
  await customerMenuTrigger.click()
  await primarySession.page.getByRole('dialog', { name: 'Site navigation' }).waitFor()
  assert.equal(await primarySession.page.evaluate(() => document.body.style.overflow), 'hidden')
  assert(await primarySession.page.getByRole('button', { name: 'Close navigation' }).last().evaluate((element) => element === document.activeElement))
  const undersizedCustomerDrawerTargets = await primarySession.page.locator('#mobile-site-navigation a:visible, #mobile-site-navigation button:visible').evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width < 44 || rect.height < 44
  }).map((element) => ({ text: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
  assert.deepEqual(undersizedCustomerDrawerTargets, [])
  await primarySession.page.keyboard.press('Escape')
  await primarySession.page.getByRole('dialog', { name: 'Site navigation' }).waitFor({ state: 'hidden' })
  assert(await customerMenuTrigger.evaluate((element) => element === document.activeElement))
  await primarySession.page.emulateMedia({ reducedMotion: 'reduce' })
  assert(await primarySession.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
  assert(await primarySession.page.evaluate(() => Array.from(document.styleSheets).some((sheet) => {
    try { return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes('prefers-reduced-motion')) } catch { return false }
  })))
  pass('keyboard, focus, labels, error messaging, 44px touch targets, and reduced-motion behavior pass')

  const regressionRoutes = ['/', '/capital', '/sell', '/workspace', '/api/seller/cases']
  for (const route of regressionRoutes) {
    const response = await primarySession.page.request.get(`${siteUrl}${route}`, { maxRedirects: 0 })
    assert(response.status() < 500, `${route} returned ${response.status()}`)
  }
  await hub.goto(siteUrl, { waitUntil: 'domcontentloaded' })
  assert.match(await hub.locator('body').innerText(), /Find your next move\./i)
  pass('homepage, Capital, seller journey, workspace, and Gate 4E.1 routes have no regressions')

  assert.equal(checks.length, 31)
  console.log(JSON.stringify({ healthy: true, runId, checks, screenshots: screenshotDir }, null, 2))
} finally {
  if (browser) await browser.close()
  const cleanupIssues = []
  const cleanup = async (label, operation) => {
    const result = await operation
    if (result.error) cleanupIssues.push(`${label}: ${result.error.message}`)
    return result
  }
  const uniqueProfiles = [...new Set(profileIds.filter(Boolean))]
  if (uniqueProfiles.length) {
    await cleanup('delete participant tasks', admin.from('admin_tasks').delete().eq('entity_type', 'participant_profile').in('entity_id', uniqueProfiles))
    await cleanup('delete participant normalizations', admin.from('participant_profile_normalizations').delete().in('participant_profile_id', uniqueProfiles))
    await cleanup('delete participant history', admin.from('participant_profile_events').delete().in('participant_profile_id', uniqueProfiles))
    await cleanup('delete participant profiles', admin.from('participant_profiles').delete().in('id', uniqueProfiles))
  }
  for (const userId of userIds) {
    const result = await admin.auth.admin.deleteUser(userId)
    if (result.error) cleanupIssues.push(`delete QA auth user ${userId}: ${result.error.message}`)
  }
  if (uniqueProfiles.length) {
    const profilesLeft = await cleanup('verify profile cleanup', admin.from('participant_profiles').select('id').in('id', uniqueProfiles))
    const eventsLeft = await cleanup('verify event cleanup', admin.from('participant_profile_events').select('id').in('participant_profile_id', uniqueProfiles))
    const normalizationsLeft = await cleanup('verify normalization cleanup', admin.from('participant_profile_normalizations').select('id').in('participant_profile_id', uniqueProfiles))
    const tasksLeft = await cleanup('verify task cleanup', admin.from('admin_tasks').select('id').eq('entity_type', 'participant_profile').in('entity_id', uniqueProfiles))
    if (profilesLeft.data?.length) cleanupIssues.push(`${profilesLeft.data.length} participant profiles remain`)
    if (eventsLeft.data?.length) cleanupIssues.push(`${eventsLeft.data.length} participant events remain`)
    if (normalizationsLeft.data?.length) cleanupIssues.push(`${normalizationsLeft.data.length} participant normalizations remain`)
    if (tasksLeft.data?.length) cleanupIssues.push(`${tasksLeft.data.length} participant tasks remain`)
  }
  if (cleanupIssues.length) {
    console.error(`QA cleanup failed:\n- ${cleanupIssues.join('\n- ')}`)
    process.exitCode = 1
  } else if (uniqueProfiles.length || userIds.length) {
    pass('every disposable user, profile, task, CRM/account fixture, event, normalization, and public-profile artifact is removed')
    console.log(`PASS cleanup. Removed ${uniqueProfiles.length} profiles and ${userIds.length} users for ${runId}.`)
  }
}
