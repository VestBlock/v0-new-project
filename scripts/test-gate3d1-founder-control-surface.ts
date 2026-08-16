import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
const bossDailyCron = readFileSync(resolve(root, 'app/api/cron/boss-daily-loop/route.ts'), 'utf8')
const strategyEngineCron = readFileSync(resolve(root, 'app/api/cron/strategy-engine/route.ts'), 'utf8')
const strategySourceCron = readFileSync(resolve(root, 'app/api/cron/strategy-source-orchestrator/route.ts'), 'utf8')
const partnerPipelineCron = readFileSync(resolve(root, 'app/api/cron/partner-network-pipeline/route.ts'), 'utf8')
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
  crons?: Array<{ path?: string }>
}

const getStart = route.indexOf('export async function GET()')
const postStart = route.indexOf('export async function POST(request: Request)')
assert.ok(getStart >= 0 && postStart > getStart, 'Founder route must expose separate GET and POST handlers.')
const getHandler = route.slice(getStart, postStart)
assert.doesNotMatch(getHandler, /executeAuthorized|authorizeGate|revokeGate|reconcileGate|saveGate/)
assert.match(getHandler, /getGate3d1FounderControlReadiness/)

assert.match(route, /guardPublicMutation\(request/)
assert.match(route, /checkAdminAccess\(\)/)
assert.match(route, /isExactGate3d1FounderIdentity\(access\.user\)/)
assert.match(route, /\.strict\(\)/)
assert.match(route, /BOOTSTRAP_EXACT_VERIFIED_FOUNDER/)
assert.match(route, /STAGE_EXACT_CAP_ONE_REVIEW/)
assert.match(route, /APPROVE_EXACT_CAP_ONE_ACTIVATION_MANIFEST/)
assert.match(route, /ACTIVATE_EXACT_FOUNDER_APPROVED_VERSION/)
assert.match(route, /RELEASE_STRATEGY_THEN_GLOBAL_FOR_ONE_CANARY/)
assert.match(route, /STOP_GLOBAL_THEN_STRATEGY/)
assert.match(route, /SAVE_LOCAL_DRAFT_ONLY/)
assert.match(route, /RECORD_EXACT_SCOPED_EXCHANGE_RBAC_PROOF/)
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
assert.match(control, /releaseOrder:\s*\['strategy', 'global'\]/)
assert.match(control, /stopOrder:\s*\['global', 'strategy'\]/)
assert.match(control, /preparedDraftOperatingContractFingerprint/)
assert.match(control, /activeRuntimeFingerprintSource:\s*'database_resolver_after_activation'/)
assert.match(control, /record_exchange_application_rbac_attestation/)
assert.match(control, /export async function recordGate3d1ExchangeRbacAttestation/)
assert.match(control, /record_inbound_reply_continuation_authorization/)
assert.match(control, /p_outreach_message_id:\s*outreachMessageId/)
assert.match(control, /revoke_inbound_reply_continuation_authorization/)
assert.match(control, /reconcile_gate3d1_canary_dispatch/)
assert.match(control, /resolveGate3d1GraphReplyExecutionRequest/)
assert.match(control, /resolveGate3d1ExecutionOrStop/)
assert.match(control, /engage_gate3d1_canary_stop/)
assert.match(control, /executeGate3d1GraphSameThreadReplyCanary\(request\)/)
assert.match(control, /marketingConsentGranted:\s*false/)
assert.match(control, /buildGate3d1CompliantReplyComment/)
assert.match(control, /Founder continuation authority did not atomically approve/)
assert.match(control, /reviewedPositiveReplySummarySha256/)
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
assert.match(adapter, /If you prefer not to receive further messages, reply STOP/)
assert.match(adapter, /OUTREACH_MAILING_ADDRESS/)
assert.match(adapter, /Prefer:\s*'IdType="ImmutableId"'/)
assert.match(adapter, /\/createReply`/)
assert.match(adapter, /\/send`/)
assert.match(core, /inReplyTo === thread\.outboundInternetMessageId/)
assert.doesNotMatch(core, /references.*===.*outboundInternetMessageId/i)
assert.match(outlookMailbox, /observedTenantId:\s*graphSession\.tokenTenantId/)
assert.match(outlookMailbox, /observedMailboxObjectId:\s*config\.mailboxObjectId \|\| null/)
assert.match(outlookMailbox, /mailboxObjectId:\s*gate3d1CallbackScope\.observedMailboxObjectId/)
assert.doesNotMatch(outlookMailbox, /mailboxObjectId:\s*gate3d1MailboxObjectId/)
assert.match(control, /hasExactGate3d1ReplyMemoryProvenance/)
assert.match(adapter, /inbound_reader_provenance_conflict/)
assert.match(core, /observedTenantId/)
assert.match(core, /observedMailboxObjectId/)

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
assert.match(bossDailyCron, /paramFlag\(url, 'dryRun'\)/)
assert.match(bossDailyCron, /paramFlag\(url, 'dispatch'\)/)
assert.match(bossDailyCron, /paramFlag\(url, 'send'\)/)
assert.match(strategyEngineCron, /flag\(url\.searchParams\.get\('execute'\)\)/)
assert.match(strategyEngineCron, /flag\(url\.searchParams\.get\('syncDealMachine'\)\)/)
assert.match(strategySourceCron, /dryRun:\s*flag\(url\.searchParams\.get\('dryRun'\)\)/)
assert.match(partnerPipelineCron, /const dryRunParam = url\.searchParams\.get\('dryRun'\)/)

console.log('Gate 3D.1 founder control surface checks passed without provider calls.')
