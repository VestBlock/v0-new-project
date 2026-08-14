import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = String(process.env.QA_SITE_URL || 'http://127.0.0.1:3417').replace(/\/$/, '')
assert(supabaseUrl && anonKey && serviceKey, 'Supabase environment is required')

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const runId = `gate4e3-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const password = `Gate4E3!${runId}`
const userIds = []
const profileIds = []
const matchIds = []
const taskIds = []
const orchestrationRunIds = []
const proposalIds = []
let promotedVersion = null
let priorVersion = null
let browser
let killSwitchChanged = false
const checks = []

function pass(message) { checks.push(message); console.log(`PASS ${checks.length}. ${message}`) }

async function createUser(label, role = 'member') {
  const email = `vestblock+${runId}-${label}@example.com`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Gate 4E.3 ${label}` } })
  assert.ifError(created.error); assert(created.data.user?.id)
  userIds.push(created.data.user.id)
  if (role === 'admin') {
    const result = await admin.from('user_profiles').update({ role: 'admin' }).eq('id', created.data.user.id).select('role').single()
    assert.ifError(result.error); assert.equal(result.data.role, 'admin')
  }
  return { id: created.data.user.id, email }
}

async function signedInPage(user, redirect) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${siteUrl}/login?redirect=${encodeURIComponent(redirect)}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Login' }).waitFor()
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(password)
  await page.waitForFunction(() => { const button = document.querySelector('button[type="submit"]'); return button instanceof HTMLButtonElement && !button.disabled }, null, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((url) => url.pathname === redirect, { timeout: 45_000 })
  return { context, page }
}

async function pageApi(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: options.body ? { 'content-type': 'application/json', ...(options.headers || {}) } : options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
    return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json().catch(() => ({})) }
  }, { path, options })
}

try {
  const member = await createUser('member')
  const secondary = await createUser('secondary')
  const operator = await createUser('operator', 'admin')
  const now = new Date().toISOString()
  const activeProfile = await admin.from('participant_profiles').insert({
    owner_user_id: member.id, role: 'buyer', origin: 'customer', status: 'active', identity_type: 'organization',
    display_name: 'Gate 4E.3 Buyer', organization_name: 'Gate 4E.3 Buyer LLC', contact_email: member.email,
    summary: 'Disposable permissioned criteria profile for release QA.',
    criteria_json: { markets: ['Milwaukee, WI'], assetTypes: ['Small multifamily'], priceMax: 500000, investmentStrategy: ['Hold'], exclusions: 'No occupied properties without a documented customer-led process.' },
    matching_consent: true, matching_consent_at: now, outreach_consent: false, last_verified_at: now, operator_verified_at: now, activated_at: now,
  }).select('*').single()
  assert.ifError(activeProfile.error); profileIds.push(activeProfile.data.id)
  const pausedProfile = await admin.from('participant_profiles').insert({
    owner_user_id: secondary.id, role: 'investor', origin: 'customer', status: 'paused', display_name: 'Paused QA Investor', contact_email: secondary.email,
    summary: 'Paused profile used to prove matching exclusion.', criteria_json: { markets: ['Milwaukee, WI'], assetTypes: ['Land'], priceMax: 200000, investmentStrategy: ['Development'], exclusions: 'None' },
    matching_consent: true, matching_consent_at: now, outreach_consent: true, outreach_consent_at: now, last_verified_at: now, paused_at: now,
  }).select('*').single()
  assert.ifError(pausedProfile.error); profileIds.push(pausedProfile.data.id)

  browser = await chromium.launch()
  const memberSession = await signedInPage(member, '/workspace/profiles')
  const secondarySession = await signedInPage(secondary, '/workspace/profiles')
  const operatorSession = await signedInPage(operator, '/admin/command-center')

  const governance = await pageApi(operatorSession.page, '/api/admin/strategy-governance')
  assert.equal(governance.status, 200, JSON.stringify(governance.body)); assert.equal(governance.body.lanes.length, 10)
  const required = ['objective','targetCustomer','qualificationCriteria','approvedDataSources','recommendedCustomerPath','outreachMethods','consentOrLawfulBasis','exclusionsAndSuppressions','primaryConversionEvent','kpis','costAndCapacityLimits','failureConditions','humanReviewRequirements','experimentHypothesis','learningWindowDays','versionDecisionRule']
  for (const lane of governance.body.lanes) for (const key of required) assert.notEqual(lane.contract_json[key], undefined, `${lane.lane_key} missing ${key}`)
  pass('all ten operating lanes expose complete, active, versioned strategy contracts')

  priorVersion = governance.body.lanes.find((lane) => lane.lane_key === 'content_visibility')
  const proposal = await pageApi(operatorSession.page, '/api/admin/strategy-governance', { method: 'POST', body: {
    laneKey: 'content_visibility', title: `QA strategy promotion ${runId}`,
    rationale: 'Prove that sourced observations require human approval and create a preserved next version.',
    contractPatch: { experimentHypothesis: `QA-only version promotion proof ${runId}` },
    sourcedFacts: [{ claim: 'This is a controlled internal release test.', source: 'Gate 4E.3 release QA', observedAt: now }],
    aiInferences: [{ inference: 'Version promotion should preserve the active predecessor.', confidence: 0.99 }], riskLevel: 'medium',
  } })
  assert.equal(proposal.status, 201, JSON.stringify(proposal.body)); proposalIds.push(proposal.body.proposal.id)
  const approve = await pageApi(operatorSession.page, `/api/admin/strategy-governance/${proposal.body.proposal.id}`, { method: 'PATCH', body: { action: 'approve' } })
  assert.equal(approve.status, 200, JSON.stringify(approve.body))
  const apply = await pageApi(operatorSession.page, `/api/admin/strategy-governance/${proposal.body.proposal.id}`, { method: 'PATCH', body: { action: 'apply' } })
  assert.equal(apply.status, 200, JSON.stringify(apply.body)); promotedVersion = apply.body.version
  assert.equal(promotedVersion.version, priorVersion.version + 1)
  const prior = await admin.from('strategy_lane_versions').select('status').eq('id', priorVersion.id).single(); assert.equal(prior.data.status, 'retired')
  pass('material strategy changes require approve then apply and create a preserved next version')

  const baseMatch = {
    strategyVersionId: promotedVersion.id, targetEntityType: 'roadmap_action', targetEntityId: `qa:${runId}`,
    score: 84, scoreExplanation: { fit: ['Market overlaps', 'Asset type overlaps'], limits: ['Customer must verify availability'] }, exclusions: [],
    sourceProvenance: [{ source: 'Gate 4E.3 controlled fixture', observedAt: now }], sourceObservedAt: now, uncertainty: 'medium',
    customerSafeSummary: 'A potential roadmap-aligned opportunity matched the approved profile criteria. Availability and fit still require operator and customer review.',
  }
  const createdMatch = await pageApi(operatorSession.page, '/api/admin/opportunity-matches', { method: 'POST', body: { ...baseMatch, participantProfileId: activeProfile.data.id } })
  assert.equal(createdMatch.status, 201, JSON.stringify(createdMatch.body)); assert.equal(createdMatch.body.created, true)
  matchIds.push(createdMatch.body.match.id); taskIds.push(createdMatch.body.match.admin_task_id); assert.equal(createdMatch.body.match.outreach_eligible, false)
  const replayedMatch = await pageApi(operatorSession.page, '/api/admin/opportunity-matches', { method: 'POST', body: { ...baseMatch, participantProfileId: activeProfile.data.id } })
  assert.equal(replayedMatch.status, 201); assert.equal(replayedMatch.body.created, false); assert.equal(replayedMatch.body.match.id, createdMatch.body.match.id)
  pass('matching persists a stable, explainable record and retry does not duplicate it')

  const pausedAttempt = await pageApi(operatorSession.page, '/api/admin/opportunity-matches', { method: 'POST', body: { ...baseMatch, participantProfileId: pausedProfile.data.id, targetEntityId: `qa-paused:${runId}` } })
  assert.equal(pausedAttempt.status, 422); assert.match(pausedAttempt.body.error, /not eligible/i)
  pass('paused profiles are excluded even when matching and outreach consent were previously recorded')

  const reviewed = await pageApi(operatorSession.page, `/api/admin/opportunity-matches/${createdMatch.body.match.id}`, { method: 'PATCH', body: { status: 'approved', note: 'QA approval proves review behavior; it does not authorize outreach.' } })
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body)); assert.equal(reviewed.body.match.outreach_eligible, false)
  const ownMatches = await pageApi(memberSession.page, '/api/opportunity-matches')
  assert.equal(ownMatches.status, 200); assert.equal(ownMatches.body.matches.length, 1)
  const safeText = JSON.stringify(ownMatches.body)
  for (const field of ['stable_key','target_entity_id','score_explanation_json','source_provenance_json','operator_owner_user_id','crm_lead_id','admin_task_id','outreach_eligible']) assert(!safeText.includes(field), `Customer response leaked ${field}`)
  const otherMatches = await pageApi(secondarySession.page, '/api/opportunity-matches'); assert.equal(otherMatches.status, 200); assert.equal(otherMatches.body.matches.length, 0)
  await memberSession.page.goto(`${siteUrl}/workspace`, { waitUntil: 'networkidle' })
  await memberSession.page.getByText(baseMatch.customerSafeSummary).waitFor()
  await memberSession.page.getByText(/Potential fit only—not an offer/).waitFor()
  const emptyInfoRequest = await pageApi(operatorSession.page, `/api/admin/opportunity-matches/${createdMatch.body.match.id}`, { method: 'PATCH', body: { status: 'needs_information' } })
  assert.equal(emptyInfoRequest.status, 400)
  const customerQuestion = 'Please confirm whether the Milwaukee market and $500,000 maximum remain current.'
  const requestedInfo = await pageApi(operatorSession.page, `/api/admin/opportunity-matches/${createdMatch.body.match.id}`, { method: 'PATCH', body: { status: 'needs_information', note: customerQuestion } })
  assert.equal(requestedInfo.status, 200, JSON.stringify(requestedInfo.body))
  await memberSession.page.reload({ waitUntil: 'networkidle' })
  await memberSession.page.getByText(customerQuestion).waitFor()
  await memberSession.page.getByRole('link', { name: 'Update profile' }).waitFor()
  const reapproved = await pageApi(operatorSession.page, `/api/admin/opportunity-matches/${createdMatch.body.match.id}`, { method: 'PATCH', body: { status: 'approved', note: 'Customer-facing information request path verified; restore approved state for final review.' } })
  assert.equal(reapproved.status, 200, JSON.stringify(reapproved.body))
  pass('operator approval keeps outreach separate and customer-safe results remain account-owned')

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  for (const table of ['strategy_lane_versions', 'participant_opportunity_matches', 'orchestration_runs']) assert((await anon.from(table).select('id').limit(1)).error, `${table} allowed anonymous access`)
  const authenticated = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  assert.ifError((await authenticated.auth.signInWithPassword({ email: member.email, password })).error)
  for (const table of ['strategy_lane_versions', 'participant_opportunity_matches', 'orchestration_runs']) assert((await authenticated.from(table).select('id').limit(1)).error, `${table} allowed direct authenticated access`)
  pass('RLS and grants deny direct anonymous and authenticated access to governance, matching, and orchestration tables')

  const idempotencyKey = `${runId}:n8n-contract`
  const n8n = await pageApi(operatorSession.page, '/api/admin/orchestration/n8n', { method: 'POST', body: { eventType: 'workflow_contract_test', idempotencyKey, mode: 'no_send', channel: 'no_outreach' } })
  assert.equal(n8n.status, 200, JSON.stringify(n8n.body)); orchestrationRunIds.push(n8n.body.run.id); taskIds.push(n8n.body.run.operator_task_id)
  assert.equal(n8n.body.run.mode, 'no_send'); assert.notEqual(n8n.body.run.status, 'failed')
  const n8nReplay = await pageApi(operatorSession.page, '/api/admin/orchestration/n8n', { method: 'POST', body: { eventType: 'workflow_contract_test', idempotencyKey, mode: 'no_send', channel: 'no_outreach' } })
  assert.equal(n8nReplay.status, 200); assert.equal(n8nReplay.body.replayed, true); assert.equal(n8nReplay.body.run.id, n8n.body.run.id)
  pass('signed n8n no-send execution is recorded and an idempotent retry reuses the original run')

  const liveBlocked = await pageApi(operatorSession.page, '/api/admin/orchestration/n8n', { method: 'POST', body: { eventType: 'approved_outreach_requested', idempotencyKey: `${runId}:live-blocked`, mode: 'approved_live', channel: 'resend_email' } })
  assert.equal(liveBlocked.status, 422); assert.match(liveBlocked.body.error, /disabled/i)
  const engage = await admin.from('orchestration_controls').update({ kill_switch: true, updated_at: new Date().toISOString() }).eq('integration_key', 'n8n'); assert.ifError(engage.error); killSwitchChanged = true
  const killed = await pageApi(operatorSession.page, '/api/admin/orchestration/n8n', { method: 'POST', body: { eventType: 'workflow_contract_test', idempotencyKey: `${runId}:killed`, mode: 'no_send', channel: 'no_outreach' } })
  assert.equal(killed.status, 422); assert.match(killed.body.error, /kill switch/i)
  const release = await admin.from('orchestration_controls').update({ kill_switch: false, updated_at: new Date().toISOString() }).eq('integration_key', 'n8n'); assert.ifError(release.error); killSwitchChanged = false
  pass('live sends stay disabled and the production n8n kill switch blocks even no-send dispatch')

  const invalidWebhook = await fetch(`${siteUrl}/api/webhooks/n8n`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vestblock-timestamp': now, 'x-vestblock-signature': 'sha256=invalid' }, body: JSON.stringify({ idempotencyKey, eventType: 'workflow_acknowledged' }) })
  assert.equal(invalidWebhook.status, 401)
  const crossSite = await fetch(`${siteUrl}/api/admin/orchestration/n8n`, { method: 'POST', headers: { 'content-type': 'application/json', Origin: 'https://malicious.example' }, body: JSON.stringify({ eventType: 'workflow_contract_test', idempotencyKey: `${runId}:cross-site`, mode: 'no_send', channel: 'no_outreach' }) })
  assert.equal(crossSite.status, 403)
  pass('invalid n8n signatures and cross-site mutation attempts are rejected')

  await mkdir('/tmp/vestblock-gate4e3-visual', { recursive: true })
  await operatorSession.page.goto(`${siteUrl}/admin/opportunity-matches`, { waitUntil: 'networkidle' })
  await operatorSession.page.getByRole('heading', { name: 'Opportunity match review' }).waitFor()
  for (const width of [1440, 1024, 768, 390]) {
    await operatorSession.page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const viewport = await operatorSession.page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    assert.equal(viewport.scrollWidth, viewport.width, `match review overflow at ${width}`)
    await operatorSession.page.screenshot({ path: `/tmp/vestblock-gate4e3-visual/matches-${width}.png`, fullPage: true })
  }
  pass('operator match review renders without horizontal overflow at 1440, 1024, 768, and 390 pixels')

  assert.equal(checks.length, 10)
  console.log(JSON.stringify({ healthy: true, runId, checks, screenshots: '/tmp/vestblock-gate4e3-visual' }, null, 2))
} finally {
  const cleanupIssues = []
  const clean = async (label, operation) => {
    const result = await operation
    if (result.error) cleanupIssues.push(`${label}: ${result.error.message}`)
    return result
  }
  if (killSwitchChanged) await clean('restore n8n kill switch', admin.from('orchestration_controls').update({ kill_switch: false }).eq('integration_key', 'n8n'))
  if (orchestrationRunIds.length) {
    await clean('delete n8n receipts', admin.from('orchestration_webhook_receipts').delete().in('run_id', orchestrationRunIds))
    await clean('delete n8n runs', admin.from('orchestration_runs').delete().in('id', orchestrationRunIds))
  }
  if (matchIds.length) {
    await clean('delete match events', admin.from('participant_opportunity_match_events').delete().in('match_id', matchIds))
    await clean('delete matches', admin.from('participant_opportunity_matches').delete().in('id', matchIds))
  }
  if (taskIds.filter(Boolean).length) await clean('delete QA tasks', admin.from('admin_tasks').delete().in('id', taskIds.filter(Boolean)))
  if (promotedVersion?.id && priorVersion?.id) {
    await clean('retire QA strategy version', admin.from('strategy_lane_versions').update({ status: 'retired' }).eq('id', promotedVersion.id))
    await clean('restore prior strategy version', admin.from('strategy_lane_versions').update({ status: 'active' }).eq('id', priorVersion.id))
    await clean('delete QA strategy version', admin.from('strategy_lane_versions').delete().eq('id', promotedVersion.id))
  }
  if (proposalIds.length) await clean('delete strategy proposals', admin.from('strategy_updates').delete().in('id', proposalIds))
  if (profileIds.length) await clean('delete participant profiles', admin.from('participant_profiles').delete().in('id', profileIds))
  for (const id of userIds) {
    const result = await admin.auth.admin.deleteUser(id)
    if (result.error) cleanupIssues.push(`delete QA user: ${result.error.message}`)
  }
  if (profileIds.length) {
    const leftovers = await clean('verify profile cleanup', admin.from('participant_profiles').select('id').in('id', profileIds))
    if (leftovers.data?.length) cleanupIssues.push(`${leftovers.data.length} QA profiles remain`)
  }
  if (matchIds.length) {
    const leftovers = await clean('verify match cleanup', admin.from('participant_opportunity_matches').select('id').in('id', matchIds))
    if (leftovers.data?.length) cleanupIssues.push(`${leftovers.data.length} QA matches remain`)
  }
  if (orchestrationRunIds.length) {
    const leftovers = await clean('verify orchestration cleanup', admin.from('orchestration_runs').select('id').in('id', orchestrationRunIds))
    if (leftovers.data?.length) cleanupIssues.push(`${leftovers.data.length} QA orchestration runs remain`)
  }
  if (browser) await browser.close()
  if (cleanupIssues.length) {
    console.error(`QA cleanup failed:\n- ${cleanupIssues.join('\n- ')}`)
    process.exitCode = 1
  } else if (userIds.length) {
    console.log(`PASS cleanup. Removed disposable strategy, match, orchestration, task, profile, and ${userIds.length} user records for ${runId}.`)
  }
}
