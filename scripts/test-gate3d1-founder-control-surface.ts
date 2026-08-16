import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { isCronAuthorized } from '../lib/system/cronAuth'

const root = process.cwd()
const route = readFileSync(
  resolve(root, 'app/api/admin/outreach/gate3d1-graph-reply/route.ts'),
  'utf8'
)
const control = readFileSync(
  resolve(root, 'lib/admin/gate3d1GraphReplyControl.ts'),
  'utf8'
)
const adapter = readFileSync(
  resolve(root, 'lib/email/graphSameThreadReplyCanary.ts'),
  'utf8'
)
const inboundScope = readFileSync(
  resolve(root, 'lib/email/gate3d1InboundMailboxScope.ts'),
  'utf8'
)
const core = readFileSync(
  resolve(root, 'lib/email/graphSameThreadReplyCore.ts'),
  'utf8'
)
const outlookMailbox = readFileSync(
  resolve(root, 'lib/email/outlookMailbox.ts'),
  'utf8'
)
const runtimeGovernance = readFileSync(
  resolve(root, 'lib/strategy/runtime-governance.ts'),
  'utf8'
)
const cronAuth = readFileSync(resolve(root, 'lib/system/cronAuth.ts'), 'utf8')
const bossDailyCron = readFileSync(resolve(root, 'app/api/cron/boss-daily-loop/route.ts'), 'utf8')
const strategyEngineCron = readFileSync(resolve(root, 'app/api/cron/strategy-engine/route.ts'), 'utf8')
const strategySourceCron = readFileSync(resolve(root, 'app/api/cron/strategy-source-orchestrator/route.ts'), 'utf8')
const partnerPipelineCron = readFileSync(resolve(root, 'app/api/cron/partner-network-pipeline/route.ts'), 'utf8')
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
  crons?: Array<{ path?: string }>
}

const getStart = route.indexOf('export async function GET(request: Request)')
const postStart = route.indexOf('export async function POST(request: Request)')
assert.ok(getStart >= 0 && postStart > getStart, 'Founder route must expose separate GET and POST handlers.')
const getHandler = route.slice(getStart, postStart)
assert.doesNotMatch(getHandler, /executeAuthorized|authorizeGate|revokeGate|reconcileGate|saveGate/)
assert.match(getHandler, /getGate3d1FounderControlReadiness/)
assert.match(getHandler, /inspectGate3d1InboundReplyEvidence/)
assert.doesNotMatch(getHandler, /from_email|to_email|internetMessageId/)

assert.match(route, /guardPublicMutation\(request/)
assert.match(route, /export const maxDuration = 120/)
assert.match(route, /checkAdminAccess\(\)/)
assert.match(route, /isExactGate3d1FounderIdentity\(access\.user\)/)
assert.match(route, /\.strict\(\)/)
assert.match(route, /BOOTSTRAP_EXACT_VERIFIED_FOUNDER/)
assert.match(route, /STAGE_EXACT_CAP_ONE_REVIEW/)
assert.match(route, /APPROVE_EXACT_CAP_ONE_ACTIVATION_MANIFEST/)
assert.match(route, /ACTIVATE_EXACT_FOUNDER_APPROVED_VERSION/)
assert.doesNotMatch(route, /RELEASE_STRATEGY_THEN_GLOBAL_FOR_ONE_CANARY/)
assert.doesNotMatch(route, /action:\s*z\.literal\('release_controls'\)/)
assert.match(route, /STOP_GLOBAL_THEN_STRATEGY/)
assert.match(route, /SAVE_LOCAL_DRAFT_ONLY/)
assert.match(route, /REFRESH_ONE_EXACT_INBOUND_GRAPH_MESSAGE/)
assert.match(route, /RECORD_EXACT_SCOPED_EXCHANGE_RBAC_PROOF/)
assert.match(route, /REVOKE_EXACT_SCOPED_EXCHANGE_RBAC_PROOF/)
assert.match(route, /AUTHORIZE_EXACT_REVIEWED_POSITIVE_SAME_THREAD_REPLY/)
assert.match(route, /REVOKE_EXACT_CONTINUATION/)
assert.match(route, /EXECUTE_ONE_EXACT_GRAPH_REPLY/)
assert.match(route, /RECONCILE_PROVIDER_STATE_MANUALLY/)
assert.doesNotMatch(route, /actorUserId:\s*parsed\.data/)
assert.match(route, /executeAuthorizedGate3d1Reply\(\{\s*actorUserId:\s*access\.user\.id/)
assert.doesNotMatch(route, /n8n|cron/i)

assert.match(control, /getSupabaseServer\(\)/)
assert.match(control, /bootstrap_gate3d1_founder_reviewer/)
assert.match(control, /assert_gate3d1_founder_actor/)
assert.match(control, /stage_gate3d1_canary_review/)
assert.match(control, /submit_operating_strategy_review_manifest/)
assert.match(control, /record_operating_strategy_review_decision/)
assert.match(control, /activate_operating_strategy_version/)
assert.match(control, /export async function recordGate3d1ActivationApproval/)
assert.match(control, /export async function activateGate3d1Canary/)
assert.match(control, /stopOrder:\s*\['global', 'strategy'\]/)
assert.match(control, /release_gate3d1_canary_for_authorization/)
assert.match(control, /preflightGate3d1GraphReplyExecution\(request\)/)
const executeStart = control.indexOf('export async function executeAuthorizedGate3d1Reply')
const releaseCallIndex = control.indexOf("'release_gate3d1_canary_for_authorization'", executeStart)
const graphPreflightIndex = control.indexOf('preflightGate3d1GraphReplyExecution(request)', executeStart)
assert.ok(
  executeStart >= 0 && graphPreflightIndex > executeStart && graphPreflightIndex < releaseCallIndex,
  'Static activation, token/RBAC, and exact immutable target reads must pass before the release lease.'
)
assert.match(control, /p_ttl_seconds:\s*300/)
assert.match(control, /assert_gate3d1_canary_stops_engaged/)
assert.match(control, /preparedDraftOperatingContractFingerprint/)
assert.match(control, /activeRuntimeFingerprintSource:\s*'database_resolver_after_activation'/)
assert.match(control, /record_exchange_application_rbac_attestation/)
assert.match(control, /export async function recordGate3d1ExchangeRbacAttestation/)
assert.match(control, /export async function revokeGate3d1ExchangeRbacAttestation/)
assert.match(control, /revoke_exchange_application_rbac_attestation/)
assert.match(control, /record_inbound_reply_continuation_authorization/)
assert.match(control, /p_outreach_message_id:\s*outreachMessageId/)
assert.match(control, /revoke_inbound_reply_continuation_authorization/)
assert.match(control, /reconcile_gate3d1_canary_dispatch/)
assert.match(control, /resolveGate3d1GraphReplyExecutionRequest/)
assert.match(control, /resolveGate3d1ExecutionOrStop/)
assert.match(control, /engage_gate3d1_canary_stop/)
assert.match(control, /executeGate3d1GraphSameThreadReplyCanary\(request\)/)
assert.match(control, /standaloneControlReleaseAllowed:\s*false/)
const rbacRunbookIndex = control.indexOf("'record_scoped_rbac_attestation'")
const refreshRunbookIndex = control.indexOf("'refresh_exact_inbound_reader_provenance_while_stopped'")
const draftRunbookIndex = control.indexOf("'save_local_draft_and_founder_review'")
const authorizeRunbookIndex = control.indexOf("'record_exact_positive_reply_continuation_authority'")
assert.ok(
  rbacRunbookIndex >= 0 &&
  rbacRunbookIndex < refreshRunbookIndex &&
  refreshRunbookIndex < draftRunbookIndex &&
  draftRunbookIndex < authorizeRunbookIndex,
  'The founder runbook must establish RBAC, refresh exact provenance, save/review the draft, then authorize.'
)
assert.match(control, /marketingConsentGranted:\s*false/)
assert.match(control, /buildGate3d1CompliantReplyComment/)
assert.match(control, /refreshGate3d1InboundReplyProvenance/)
assert.match(control, /controlsRemainBlocked:\s*true/)
assert.match(control, /Founder continuation authority did not atomically approve/)
assert.match(control, /reviewedPositiveReplySummarySha256/)
assert.match(control, /returnedEmailAddress:\s*false/)
assert.match(control, /\.eq\('generated_with', GATE3D1_GENERATOR\)/)
assert.match(control, /\.eq\('variant_key', messageVersionKey\)/)

for (const name of [
  'GATE3D1_GRAPH_TENANT_ID',
  'GATE3D1_GRAPH_CLIENT_ID',
  'GATE3D1_GRAPH_CLIENT_SECRET',
  'GATE3D1_GRAPH_MAILBOX_OBJECT_ID',
  'GATE3D1_GRAPH_MAILBOX_ADDRESS',
]) {
  assert.match(adapter + control, new RegExp(name))
}
assert.doesNotMatch(adapter + control + core, /OUTREACH_LIVE_SEND_ENABLED/)
assert.doesNotMatch(adapter + control, /MICROSOFT_(TENANT|CLIENT|REFRESH|MAILBOX)/)
assert.match(inboundScope, /MICROSOFT_TENANT_ID/)
assert.match(inboundScope, /GATE3D1_GRAPH_TENANT_ID/)
assert.match(adapter, /Gate 3D\.1 rejects delegated scopes and Entra application roles/)
assert.match(adapter, /GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY/)
assert.match(adapter, /authorization_expires_at/)
assert.match(adapter, /inbound_source_message_id/)
assert.match(adapter, /If you prefer not to receive further messages, reply STOP/)
assert.match(adapter, /OUTREACH_MAILING_ADDRESS/)
assert.match(adapter, /Prefer:\s*'IdType="ImmutableId"'/)
assert.match(adapter, /response\.headers\.get\('preference-applied'\)/)
assert.match(adapter, /assertGate3d1ImmutableIdPreferenceApplied/)
assert.match(adapter, /\/createReply`/)
assert.match(adapter, /\/send`/)
assert.match(core, /inReplyTo === thread\.outboundInternetMessageId/)
assert.doesNotMatch(core, /references.*===.*outboundInternetMessageId/i)
assert.doesNotMatch(outlookMailbox, /observedImmutableMessageId:\s*message\.id/)
assert.match(outlookMailbox, /mailboxObjectId:\s*gate3d1CallbackScope\.observedMailboxObjectId/)
assert.doesNotMatch(outlookMailbox, /mailboxObjectId:\s*gate3d1MailboxObjectId/)
assert.match(control, /hasExactGate3d1ReplyMemoryProvenance/)
assert.match(adapter, /inbound_reader_provenance_conflict/)
assert.match(core, /observedTenantId/)
assert.match(core, /observedMailboxObjectId/)
assert.match(core, /observedImmutableMessageId/)

const dedicatedAuthorizeStart = runtimeGovernance.indexOf(
  'export async function authorizeGate3d1CanaryDispatch'
)
const genericReserveStart = runtimeGovernance.indexOf(
  'export async function reserveOperatingStrategyDispatch'
)
assert.ok(dedicatedAuthorizeStart >= 0 && genericReserveStart > dedicatedAuthorizeStart)
const dedicatedCanaryPath = runtimeGovernance.slice(dedicatedAuthorizeStart, genericReserveStart)
assert.doesNotMatch(dedicatedCanaryPath, /OUTREACH_LIVE_SEND_ENABLED/)
assert.match(dedicatedCanaryPath, /GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE/)
assert.match(dedicatedCanaryPath, /p_fallback_channels:\s*\[\]/)
const genericAuthorizeStart = runtimeGovernance.indexOf(
  'export async function authorizeOperatingStrategyDispatch'
)
assert.match(
  runtimeGovernance.slice(genericAuthorizeStart, dedicatedAuthorizeStart),
  /OUTREACH_LIVE_SEND_ENABLED/
)

const sellerCron = (vercel.crons || []).find((cron) => cron.path?.includes('/api/cron/seller-followup'))
assert.ok(sellerCron, 'Seller follow-up cron must remain visible and explicitly hardened.')
assert.match(sellerCron!.path!, /excludeDealMachine=true/)
assert.match(sellerCron!.path!, /dryRun=true/)

for (const cron of vercel.crons || []) {
  const path = cron.path || ''
  const url = new URL(path, 'https://www.vestblock.io')
  if (url.pathname === '/api/cron/mailbox-sync') {
    assert.equal(url.searchParams.size, 0, 'Inbound mailbox sync is the only scheduled live evidence-capture lane.')
    continue
  }
  if (url.pathname === '/api/cron/strategy-engine') {
    assert.equal(url.searchParams.get('execute'), 'false')
    assert.equal(url.searchParams.get('syncDealMachine'), 'false')
    continue
  }
  assert.equal(
    url.searchParams.get('dryRun'),
    'true',
    `Every non-mailbox scheduled lane must be hard-pinned inert: ${path}`
  )
}
const bossSchedule = (vercel.crons || []).find((cron) => cron.path?.includes('/api/cron/boss-daily-loop'))
assert.ok(bossSchedule)
assert.match(bossSchedule!.path!, /dispatch=false/)
assert.match(bossSchedule!.path!, /send=false/)
assert.match(bossSchedule!.path!, /syncMailbox=false/)
assert.match(bossDailyCron, /paramFlag\(url, 'dryRun'\)/)
assert.match(bossDailyCron, /paramFlag\(url, 'dispatch'\)/)
assert.match(bossDailyCron, /paramFlag\(url, 'send'\)/)
assert.match(bossDailyCron, /paramFlag\(url, 'syncMailbox'\)/)
assert.match(strategyEngineCron, /flag\(url\.searchParams\.get\('execute'\)\)/)
assert.match(strategyEngineCron, /flag\(url\.searchParams\.get\('syncDealMachine'\)\)/)
assert.match(strategySourceCron, /dryRun:\s*flag\(url\.searchParams\.get\('dryRun'\)\)/)
assert.match(partnerPipelineCron, /const dryRunParam = url\.searchParams\.get\('dryRun'\)/)
assert.match(cronAuth, /GATE3D1_CANARY_ISOLATION/)
assert.match(cronAuth, /GATE3D1_CANARY_MAILBOX_SYNC_PATHNAME = '\/api\/cron\/mailbox-sync'/)
assert.match(cronAuth, /isExactGate3d1CanaryCronPath\(request\)/)
assert.match(outlookMailbox, /!envBool\('GATE3D1_CANARY_ISOLATION', false\)/)
assert.match(outlookMailbox, /config\.autoCleanSpam && providerMutationAllowed/)
assert.match(outlookMailbox, /refresh_gate3d1_reply_provenance/)
assert.match(outlookMailbox, /p_expected_stored_message_id:\s*reply\.messageId/)
assert.match(outlookMailbox, /p_expected_sender_hash:/)
assert.match(outlookMailbox, /p_expected_recipient_hash:/)
assert.doesNotMatch(outlookMailbox, /p_expected_source_message_id|p_expected_sender_sha256|p_expected_recipient_sha256/)
assert.match(outlookMailbox, /p_expected_metadata_json:\s*reply\.metadata/)
assert.match(outlookMailbox, /p_observed_immutable_message_id:\s*observedImmutableMessageId/)
assert.match(outlookMailbox, /p_preference_applied:\s*preferenceApplied/)
assert.match(outlookMailbox, /response\.headers\.get\('preference-applied'\)/)
assert.match(outlookMailbox, /provenance_refresh_fingerprint/)
assert.match(outlookMailbox, /readExactGate3d1ImmutableCallback/)
assert.match(outlookMailbox, /providerEventId:\s*callbackMessage!\.id/)
assert.match(core, /IdType=ImmutableId/)
const exactRefreshReadStart = outlookMailbox.indexOf('/messages/${encodeURIComponent(sourceMessageId)}')
const exactRefreshReadEnd = outlookMailbox.indexOf('persistProvenance:', exactRefreshReadStart)
assert.ok(exactRefreshReadStart >= 0 && exactRefreshReadEnd > exactRefreshReadStart)
assert.match(
  outlookMailbox.slice(exactRefreshReadStart, exactRefreshReadEnd),
  /Prefer:\s*'IdType="ImmutableId"'/
)
const broadInboxReadStart = outlookMailbox.indexOf('/mailFolders/inbox/messages?')
const broadInboxReadEnd = outlookMailbox.indexOf('const messages =', broadInboxReadStart)
assert.ok(broadInboxReadStart >= 0 && broadInboxReadEnd > broadInboxReadStart)
assert.doesNotMatch(
  outlookMailbox.slice(broadInboxReadStart, broadInboxReadEnd),
  /IdType="ImmutableId"/,
  'Generic mailbox sync must preserve its historical source-ID mode; only the exact founder refresh may request immutable IDs.'
)
const broadRowStart = outlookMailbox.indexOf('rows.push({')
const broadRowEnd = outlookMailbox.indexOf('    let stored = 0', broadRowStart)
assert.ok(broadRowStart >= 0 && broadRowEnd > broadRowStart)
assert.doesNotMatch(
  outlookMailbox.slice(broadRowStart, broadRowEnd),
  /observedTenantId|observedMailboxObjectId|observedImmutableMessageId/,
  'Generic mailbox sync must never create Gate 3D.1 reader provenance.'
)
assert.match(outlookMailbox, /const rowsToInsert = rows\.filter\(\(row\) => newMessageIds\.has\(row\.message_id\)\)/)
assert.match(outlookMailbox, /ignoreDuplicates:\s*true/)

const previousCronSecret = process.env.CRON_SECRET
const previousIsolation = process.env.GATE3D1_CANARY_ISOLATION
try {
  process.env.CRON_SECRET = 'test-cron-secret'
  process.env.GATE3D1_CANARY_ISOLATION = 'true'
  const authorizedHeaders = { authorization: 'Bearer test-cron-secret' }
  assert.equal(
    isCronAuthorized(new Request('https://www.vestblock.io/api/cron/mailbox-sync', { headers: authorizedHeaders })),
    true
  )
  for (const blockedPath of [
    '/api/cron/boss-daily-loop?dryRun=true',
    '/api/cron/seller-targeted-send?dryRun=true',
    '/api/cron/investors-pipeline?dryRun=true',
  ]) {
    assert.equal(
      isCronAuthorized(new Request(`https://www.vestblock.io${blockedPath}`, { headers: authorizedHeaders })),
      false,
      `Gate 3D.1 isolation must reject every non-mailbox cron even with the correct secret: ${blockedPath}`
    )
  }
  assert.equal(
    isCronAuthorized(new Request('https://www.vestblock.io/api/cron/mailbox-sync')),
    false
  )
  process.env.GATE3D1_CANARY_ISOLATION = 'false'
  assert.equal(
    isCronAuthorized(new Request('https://www.vestblock.io/api/cron/boss-daily-loop', { headers: authorizedHeaders })),
    true
  )
} finally {
  if (previousCronSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = previousCronSecret
  if (previousIsolation === undefined) delete process.env.GATE3D1_CANARY_ISOLATION
  else process.env.GATE3D1_CANARY_ISOLATION = previousIsolation
}

console.log('Gate 3D.1 founder control surface checks passed without provider calls.')
