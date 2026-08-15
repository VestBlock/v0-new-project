import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const scheduledPaths = new Set((vercelConfig.crons || []).map((cron) => String(cron.path).split('?')[0]))
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

function hasAny(...names) {
  return names.some((name) => Boolean(String(process.env[name] || '').trim()))
}

function hasAll(...names) {
  return names.every((name) => Boolean(String(process.env[name] || '').trim()))
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function ageHours(timestamp) {
  if (!timestamp) return null
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? Math.round(((Date.now() - value) / 3600000) * 10) / 10 : null
}

async function evidence({ table, timestampColumn, filters = [] }) {
  if (!supabase) return { count: null, lastRunAt: null, error: 'Supabase is not configured.' }
  let countQuery = supabase.from(table).select('id', { count: 'exact', head: true })
  let latestQuery = supabase.from(table).select(timestampColumn).order(timestampColumn, { ascending: false }).limit(1)
  for (const [column, value] of filters) {
    countQuery = countQuery.eq(column, value)
    latestQuery = latestQuery.eq(column, value)
  }
  const [countResult, latestResult] = await Promise.all([countQuery, latestQuery.maybeSingle()])
  const error = countResult.error?.message || latestResult.error?.message || null
  return {
    count: countResult.count ?? null,
    lastRunAt: latestResult.data?.[timestampColumn] || null,
    error,
  }
}

async function strategyOperationalEvidence() {
  if (!supabase) return { count: null, lastRunAt: null, error: 'Supabase is not configured.', operationalStatus: 'failed' }
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString()
  const [reportResult, sourceResult, sendResult] = await Promise.all([
    supabase
      .from('strategy_daily_reports')
      .select('report_date,status,report_json')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('strategy_source_events')
      .select('provider,rows_received,rows_ingested,created_at')
      .eq('status', 'completed')
      .gt('rows_received', 0)
      .gte('created_at', cutoff),
    supabase
      .from('strategy_lead_memberships')
      .select('id,status,updated_at')
      .in('status', ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
      .gte('updated_at', cutoff),
  ])
  const error = reportResult.error?.message || sourceResult.error?.message || sendResult.error?.message || null
  const report = reportResult.data?.report_json?.report || reportResult.data?.report_json || {}
  const sourceRows = (sourceResult.data || []).reduce((sum, row) => sum + Number(row.rows_received || 0), 0)
  const ingestedRows = (sourceResult.data || []).reduce((sum, row) => sum + Number(row.rows_ingested || 0), 0)
  const sourceRowsByProvider = (sourceResult.data || []).reduce((totals, row) => {
    const provider = String(row.provider || 'unknown')
    totals[provider] = (totals[provider] || 0) + Number(row.rows_received || 0)
    return totals
  }, {})
  const verifiedFallbackSourceRows = Object.entries(sourceRowsByProvider)
    .filter(([provider]) => provider !== 'dealmachine')
    .reduce((sum, [, count]) => sum + Number(count || 0), 0)
  const providerAccepted = sendResult.data?.length || 0
  const reportStatus = String(reportResult.data?.status || '')
  const operationalStatus = error
    ? 'failed'
    : sourceRows === 0
      ? 'unproven'
      : reportStatus === 'blocked'
        ? 'blocked'
        : providerAccepted > 0
          ? 'healthy'
          : 'partial'
  return {
    count: Number(report?.draftsCreated || 0),
    lastRunAt: reportResult.data?.report_date || null,
    error,
    operationalStatus,
    sourceRows,
    ingestedRows,
    sourceRowsByProvider,
    verifiedFallbackSourceRows,
    providerAccepted,
    reportStatus,
  }
}

async function dealMachineNativeApiEvidence() {
  if (!supabase) return { count: null, lastRunAt: null, error: 'Supabase is not configured.', operationalStatus: 'failed' }
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString()
  const { data, error } = await supabase
    .from('strategy_source_events')
    .select('event_type,status,rows_received,rows_ingested,created_at')
    .eq('provider', 'dealmachine')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) return { count: null, lastRunAt: null, error: error.message, operationalStatus: 'failed' }
  const rows = data || []
  const propertyRowsSynced = rows
    .filter((row) => row.status === 'completed' && row.event_type === 'scheduled_lead_sync')
    .reduce((sum, row) => sum + Number(row.rows_ingested || 0), 0)
  const contactRowsIngested = rows
    .filter((row) => row.event_type === 'scheduled_lead_sync' && row.status === 'completed')
    .reduce((sum, row) => sum + Number(row.rows_ingested || 0), 0)
  const nativeRows = rows.filter((row) => row.event_type === 'scheduled_lead_sync')
  const lastRunAt = nativeRows[0]?.created_at || null
  const operationalStatus = contactRowsIngested > 0
      ? 'healthy'
      : 'unproven'

  return {
    count: contactRowsIngested,
    lastRunAt,
    error: null,
    operationalStatus,
    propertyRowsSynced,
    contactExportsPending: 0,
    contactRowsIngested,
  }
}

function capability(input) {
  const freshness = input.evidence ? ageHours(input.evidence.lastRunAt) : null
  const evidenceFresh = input.maxAgeHours == null || (freshness != null && freshness <= input.maxAgeHours)
  let status = 'healthy'
  if (input.evidence?.operationalStatus) status = input.evidence.operationalStatus
  if (input.mode === 'manual_queue_only') status = input.configured && input.scheduled ? 'manual_queue_only' : 'blocked'
  else if (!input.configured || (input.requiresSchedule !== false && !input.scheduled)) status = 'blocked'
  else if (input.evidence?.error) status = 'failed'
  else if (input.evidence && !input.evidence.lastRunAt) status = 'unproven'
  else if (!evidenceFresh) status = 'stale'
  return {
    key: input.key,
    label: input.label,
    status,
    configured: input.configured,
    scheduled: input.scheduled,
    routeOrSource: input.routeOrSource,
    lastEvidenceAt: input.evidence?.lastRunAt || null,
    evidenceAgeHours: freshness,
    evidenceCount: input.evidence?.count ?? null,
    evidenceError: input.evidence?.error || null,
    operationalEvidence: input.evidence ? {
      sourceRows: input.evidence.sourceRows ?? null,
      ingestedRows: input.evidence.ingestedRows ?? null,
      providerAccepted: input.evidence.providerAccepted ?? null,
      reportStatus: input.evidence.reportStatus ?? null,
      sourceRowsByProvider: input.evidence.sourceRowsByProvider ?? null,
      verifiedFallbackSourceRows: input.evidence.verifiedFallbackSourceRows ?? null,
      propertyRowsSynced: input.evidence.propertyRowsSynced ?? null,
      contactExportsPending: input.evidence.contactExportsPending ?? null,
      contactRowsIngested: input.evidence.contactRowsIngested ?? null,
    } : null,
    deliveryMode: input.mode || 'automated',
    note: input.note || null,
  }
}

async function main() {
  const [
    databaseEvidence,
    attomEvidence,
    mailboxEvidence,
    strategyEvidence,
    dealMachineEvidence,
    dailyReportEvidence,
    aeoEvidence,
    entitySeoEvidence,
    contentEvidence,
    improvementEvidence,
    indexingEvidence,
    linkedinEvidence,
  ] = await Promise.all([
    evidence({ table: 'user_profiles', timestampColumn: 'updated_at' }),
    evidence({ table: 'property_intelligence_records', timestampColumn: 'updated_at' }),
    evidence({ table: 'command_center_reply_memory', timestampColumn: 'updated_at' }),
    strategyOperationalEvidence(),
    dealMachineNativeApiEvidence(),
    evidence({ table: 'daily_operator_reports', timestampColumn: 'report_date' }),
    evidence({ table: 'aeo_audit_reports', timestampColumn: 'run_at' }),
    evidence({ table: 'entity_seo_runs', timestampColumn: 'created_at' }),
    evidence({ table: 'content_assets', timestampColumn: 'published_at', filters: [['status', 'published']] }),
    evidence({ table: 'improvement_runs', timestampColumn: 'created_at' }),
    evidence({ table: 'admin_activity', timestampColumn: 'created_at', filters: [['entity_type', 'visibility_indexing_push']] }),
    evidence({ table: 'admin_activity', timestampColumn: 'created_at', filters: [['entity_type', 'linkedin_task_batch']] }),
  ])

  const graphConfigured =
    (hasAll('MICROSOFT_GRAPH_CLIENT_ID', 'MICROSOFT_GRAPH_REFRESH_TOKEN') ||
      hasAll('MICROSOFT_GRAPH_CLIENT_ID', 'MICROSOFT_GRAPH_CLIENT_SECRET', 'MICROSOFT_TENANT_ID') ||
      hasAll('MICROSOFT_CLIENT_ID', 'MICROSOFT_REFRESH_TOKEN'))
  const mailboxRuntimeEvidenceFresh =
    Number(mailboxEvidence.count || 0) > 0 &&
    ageHours(mailboxEvidence.lastRunAt) != null &&
    ageHours(mailboxEvidence.lastRunAt) <= 48
  const indexingConfigured =
    hasAny('INDEXNOW_KEY', 'BING_INDEXNOW_KEY', 'INDEXNOW_API_KEY') ||
    (hasAny('GOOGLE_SEARCH_CONSOLE_CLIENT_ID', 'GOOGLE_CLIENT_ID') &&
      hasAny('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET') &&
      hasAny('GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN'))

  const capabilities = [
    capability({
      key: 'supabase', label: 'Production database', configured: Boolean(supabase), scheduled: true,
      requiresSchedule: false, routeOrSource: 'Supabase production project', evidence: databaseEvidence,
      note: 'Schema/security integrity is covered separately by audit:supabase.',
    }),
    capability({
      key: 'attom', label: 'ATTOM property enrichment',
      configured: hasAny('ATTOM_API_KEY') && /^(1|true|yes|on)$/i.test(String(process.env.ATTOM_ENRICHMENT_ENABLED || '')),
      scheduled: scheduledPaths.has('/api/cron/attom-enrichment'), routeOrSource: '/api/cron/attom-enrichment',
      evidence: attomEvidence, maxAgeHours: 72,
    }),
    capability({
      key: 'mailbox', label: 'Outlook acquisitions mailbox', configured: graphConfigured || mailboxRuntimeEvidenceFresh,
      scheduled: scheduledPaths.has('/api/cron/mailbox-sync'), routeOrSource: '/api/cron/mailbox-sync',
      evidence: mailboxEvidence, maxAgeHours: 48,
      note: graphConfigured
        ? 'Credentials are present in the current environment.'
        : 'Recent Microsoft Graph mailbox evidence exists in production; credentials are not copied into this local shell.',
    }),
    capability({
      key: 'strategy_engine', label: 'Seller strategy expansion',
      configured: fileExists('lib/admin/strategyExecutionEngine.ts') && fileExists('lib/admin/strategySourceOrchestrator.ts'),
      scheduled: scheduledPaths.has('/api/cron/strategy-engine') && scheduledPaths.has('/api/cron/strategy-source-orchestrator'),
      routeOrSource: '/api/cron/strategy-source-orchestrator -> /api/cron/strategy-engine',
      evidence: strategyEvidence, maxAgeHours: 48,
      note: `Completed source rows by provider: ${JSON.stringify(strategyEvidence.sourceRowsByProvider || {})}; verified non-DealMachine fallback rows: ${strategyEvidence.verifiedFallbackSourceRows || 0}; provider-accepted email events in 48h: ${strategyEvidence.providerAccepted || 0}.`,
    }),
    capability({
      key: 'dealmachine_contacts', label: 'DealMachine native API',
      configured:
        fileExists('lib/dealmachine/api.ts') &&
        fileExists('lib/dealmachine/v2-client.mjs') &&
        /^dm_(?:sk|at)_live_\S+$/.test(String(process.env.DEALMACHINE_API_KEY || '')) &&
        /^(1|true|yes|on)$/i.test(String(process.env.DEALMACHINE_SOURCE_ENABLED || '')),
      scheduled: false,
      requiresSchedule: false,
      routeOrSource: 'Admin-gated native API adapter; no export watcher or export-ingest route',
      evidence: dealMachineEvidence,
      maxAgeHours: 48,
      note: `Native API rows synced: ${dealMachineEvidence.propertyRowsSynced || 0}. The adapter remains inactive until a verified key is installed; public-record and HomeHarvest loops remain the active fallback. Automated DealMachine exports are retired.`,
    }),
    capability({
      key: 'daily_reporting', label: 'Daily operator report', configured: fileExists('lib/improvement/continuous-improvement.ts'),
      scheduled: scheduledPaths.has('/api/cron/daily-ops-report'), routeOrSource: '/api/cron/daily-ops-report',
      evidence: dailyReportEvidence, maxAgeHours: 48,
    }),
    capability({
      key: 'aeo_audit', label: 'Live SEO/AEO audit', configured: fileExists('app/api/cron/aeo-site-audit/route.ts'),
      scheduled: scheduledPaths.has('/api/cron/aeo-site-audit'), routeOrSource: '/api/cron/aeo-site-audit',
      evidence: aeoEvidence, maxAgeHours: 48,
    }),
    capability({
      key: 'entity_seo', label: 'Entity and city SEO expansion', configured: fileExists('lib/content/entitySeoExpansion.ts'),
      scheduled: scheduledPaths.has('/api/cron/entity-seo-expansion'), routeOrSource: '/api/cron/entity-seo-expansion',
      evidence: entitySeoEvidence, maxAgeHours: 48,
    }),
    capability({
      key: 'content_publisher', label: 'Seller-focused content publisher', configured: fileExists('lib/content/dailyPublisher.ts'),
      scheduled: scheduledPaths.has('/api/cron/visibility-aeo-publisher'), routeOrSource: '/api/cron/visibility-aeo-publisher',
      evidence: contentEvidence, maxAgeHours: 48,
    }),
    capability({
      key: 'indexing_push', label: 'Search indexing push', configured: indexingConfigured,
      scheduled: scheduledPaths.has('/api/cron/visibility-indexing-push'), routeOrSource: '/api/cron/visibility-indexing-push',
      evidence: indexingEvidence, maxAgeHours: 48,
    }),
    capability({
      key: 'improvement_review', label: 'Continuous improvement review', configured: fileExists('lib/improvement/continuous-improvement.ts'),
      scheduled: scheduledPaths.has('/api/cron/improvement-review'), routeOrSource: '/api/cron/improvement-review',
      evidence: improvementEvidence, maxAgeHours: 48,
    }),
    capability({
      key: 'linkedin', label: 'LinkedIn partner outreach', configured: fileExists('lib/partners/linkedinTaskQueue.ts'),
      scheduled: scheduledPaths.has('/api/cron/linkedin-task-queue'), routeOrSource: '/api/cron/linkedin-task-queue',
      evidence: linkedinEvidence, maxAgeHours: 48, mode: 'manual_queue_only',
      note: 'No automatic LinkedIn sender is claimed. Verified profiles create send tasks; missing profiles create enrichment tasks.',
    }),
  ]

  const failures = capabilities.filter((item) => ['blocked', 'failed', 'stale', 'unproven', 'partial'].includes(item.status))
  const payload = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    truthStandard: 'A capability is complete only when it is configured, scheduled, and supported by recent production evidence.',
    summary: {
      healthy: capabilities.filter((item) => item.status === 'healthy').length,
      partial: capabilities.filter((item) => item.status === 'partial').length,
      manualQueueOnly: capabilities.filter((item) => item.status === 'manual_queue_only').length,
      blocked: capabilities.filter((item) => item.status === 'blocked').length,
      failed: capabilities.filter((item) => item.status === 'failed').length,
      stale: capabilities.filter((item) => item.status === 'stale').length,
      unproven: capabilities.filter((item) => item.status === 'unproven').length,
    },
    failures: failures.map((item) => item.key),
    capabilities,
  }

  const outputDir = path.join(root, 'reports')
  fs.mkdirSync(outputDir, { recursive: true })
  const jsonPath = path.join(outputDir, 'platform-capability-audit-latest.json')
  const markdownPath = path.join(outputDir, 'platform-capability-audit-latest.md')
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`)
  const rows = capabilities.map((item) =>
    `| ${item.label} | ${item.status} | ${item.scheduled ? 'yes' : 'no'} | ${item.lastEvidenceAt || 'none'} | ${item.note || ''} |`
  )
  fs.writeFileSync(markdownPath, [
    '# VestBlock Capability Audit',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    payload.truthStandard,
    '',
    '| Capability | Status | Scheduled | Last evidence | Note |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ ...payload, jsonPath, markdownPath }, null, 2))
  if (!payload.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
