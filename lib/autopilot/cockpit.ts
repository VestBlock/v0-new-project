import 'server-only'

import autonomyPolicies from '@/config/autonomy-policies.json'
import providerVerification from '@/config/provider-verification.json'
import type { CommandCenterData } from '@/lib/admin/commandCenter'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StrategyUpdateRecord } from '@/lib/improvement/types'
import { getOpenAiAdsOverview, type OpenAiAdsOverview } from './openAiAds'
import { normalizeStoredStrategy, type VestBlockStrategy } from './strategyEngine'

export type AutonomyMode = 'off' | 'suggest' | 'approve' | 'auto'

export type AutopilotCockpitSnapshot = {
  generatedAt: string
  content: {
    total: number
    drafts: number
    ready: number
    published: number
    refreshNeeded: number
    latest: Array<{
      id: string
      title: string
      contentType: string
      status: string
      platform: string | null
      createdAt: string
      scheduledFor: string | null
      scheduleStatus: string
    }>
  }
  strategyMemory: {
    total: number
    awaitingApproval: number
    active: number
    recent: Array<{
      id: string
      title: string
      approvalStatus: string
      riskLevel: string
      createdAt: string
      strategy: VestBlockStrategy | null
      campaignRunId: string | null
    }>
    experiments: Array<{
      id: string
      key: string
      category: string
      winner: boolean
      metrics: Record<string, unknown>
      createdAt: string
    }>
  }
  growth: {
    seo: { published: number; refreshNeeded: number; searchConsole: 'ready' | 'partial' | 'blocked' }
    pr: { targets: number; approvedDrafts: number; repliesOrCoverage: number }
    advertising: {
      configured: boolean
      googleConfigured: boolean
      chatgptAds: OpenAiAdsOverview
      spend: number | null
      leads: number | null
      cpl: number | null
      conversions: number | null
      roas: number | null
    }
  }
  aiWork: {
    improvementRuns7d: number
    strategyRuns7d: number
    activeAgents: number
    failedRuns7d: number
  }
  providers: Array<{
    key: 'openai' | 'buffer' | 'n8n' | 'google_ads' | 'chatgpt_ads' | 'search_console'
    label: string
    status: 'ready' | 'partial' | 'blocked'
    mode: AutonomyMode
    detail: string
  }>
  autonomy: Array<{
    key: string
    label: string
    mode: AutonomyMode
    risk: 'low' | 'medium' | 'high'
    guardrail: string
  }>
}

type AnyRow = Record<string, any>

function boolEnv(name: string) {
  return Boolean(String(process.env[name] || '').trim())
}

function parseStrategy(row: StrategyUpdateRecord): VestBlockStrategy | null {
  return normalizeStoredStrategy(row.proposed_change_json)
}

async function safeRows(query: PromiseLike<{ data: AnyRow[] | null; error: { message?: string } | null }>) {
  try {
    const { data, error } = await query
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export async function getAutopilotCockpitSnapshot(
  commandCenter: CommandCenterData
): Promise<AutopilotCockpitSnapshot> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [contentRows, strategyRows, experimentRows, improvementRows, strategyRunRows, prTargets, prDrafts, prOutreach, openAiAds] =
    await Promise.all([
      safeRows(
        admin
          .from('content_assets')
          .select('id,title,content_type,status,platform,created_at,published_at,indexed_status,metadata_json')
          .order('created_at', { ascending: false })
          .limit(1000)
      ),
      safeRows(
        admin
          .from('strategy_updates')
          .select('*')
          .eq('target_type', 'vestblock_strategy')
          .order('created_at', { ascending: false })
          .limit(60)
      ),
      safeRows(
        admin
          .from('experiment_results')
          .select('id,experiment_key,category,winner,metrics_json,created_at')
          .order('created_at', { ascending: false })
          .limit(60)
      ),
      safeRows(admin.from('improvement_runs').select('id,status,created_at').gte('created_at', since).limit(500)),
      safeRows(admin.from('command_center_strategy_runs').select('id,status,created_at').gte('created_at', since).limit(500)),
      safeRows(admin.from('pr_targets').select('id,status').limit(2000)),
      safeRows(admin.from('pr_pitch_drafts').select('id,status').limit(2000)),
      safeRows(admin.from('pr_outreach_log').select('id,status,activity_type').limit(2000)),
      getOpenAiAdsOverview(),
    ])

  const content = {
    total: contentRows.length,
    drafts: contentRows.filter((row) => row.status === 'draft').length,
    ready: contentRows.filter((row) => row.status === 'ready').length,
    published: contentRows.filter((row) => row.status === 'published').length,
    refreshNeeded: contentRows.filter((row) => row.indexed_status === 'refresh_needed').length,
    latest: contentRows.slice(0, 8).map((row) => ({
      id: String(row.id),
      title: String(row.title || 'Untitled content'),
      contentType: String(row.content_type || 'content'),
      status: String(row.status || 'draft'),
      platform: row.platform ? String(row.platform) : null,
      createdAt: String(row.created_at),
      scheduledFor: row.metadata_json?.scheduledFor ? String(row.metadata_json.scheduledFor) : null,
      scheduleStatus: String(row.metadata_json?.scheduleStatus || 'unscheduled'),
    })),
  }

  const strategies = strategyRows as StrategyUpdateRecord[]
  const searchConsoleConfigured = boolEnv('GOOGLE_SEARCH_CONSOLE_SITE_URL')
  const searchConsoleCredentialed = boolEnv('GOOGLE_SERVICE_ACCOUNT_JSON') || boolEnv('GOOGLE_APPLICATION_CREDENTIALS')
  const adsConfigured = boolEnv('GOOGLE_ADS_CUSTOMER_ID') && boolEnv('GOOGLE_ADS_DEVELOPER_TOKEN')
  const verification = providerVerification.providers
  const openAiBlocked = verification.openai.status === 'blocked'

  return {
    generatedAt: new Date().toISOString(),
    content,
    strategyMemory: {
      total: strategies.length,
      awaitingApproval: strategies.filter((row) => row.approval_status === 'queued').length,
      active: strategies.filter((row) => ['approved', 'auto_applied'].includes(row.approval_status)).length,
      recent: strategies.slice(0, 12).map((row) => ({
        id: row.id,
        title: row.title,
        approvalStatus: row.approval_status,
        riskLevel: row.risk_level,
        createdAt: row.created_at,
        strategy: parseStrategy(row),
        campaignRunId:
          typeof row.applied_change_json?.campaignRunId === 'string'
            ? row.applied_change_json.campaignRunId
            : null,
      })),
      experiments: experimentRows.slice(0, 12).map((row) => ({
        id: String(row.id),
        key: String(row.experiment_key || ''),
        category: String(row.category || ''),
        winner: Boolean(row.winner),
        metrics: (row.metrics_json || {}) as Record<string, unknown>,
        createdAt: String(row.created_at),
      })),
    },
    growth: {
      seo: {
        published: content.published,
        refreshNeeded: content.refreshNeeded,
        searchConsole: searchConsoleCredentialed ? 'ready' : searchConsoleConfigured ? 'partial' : 'blocked',
      },
      pr: {
        targets: prTargets.length,
        approvedDrafts: prDrafts.filter((row) => row.status === 'approved').length,
        repliesOrCoverage: prOutreach.filter((row) => ['won'].includes(row.status) || ['reply', 'feature'].includes(row.activity_type)).length,
      },
      advertising: {
        configured: adsConfigured || openAiAds.configured,
        googleConfigured: adsConfigured,
        chatgptAds: openAiAds,
        spend: openAiAds.spend,
        leads: null,
        cpl: null,
        conversions: null,
        roas: null,
      },
    },
    aiWork: {
      improvementRuns7d: improvementRows.length,
      strategyRuns7d: strategyRunRows.length,
      activeAgents: commandCenter.agents.filter((agent) => agent.status === 'active').length,
      failedRuns7d:
        improvementRows.filter((row) => row.status === 'failed').length +
        strategyRunRows.filter((row) => row.status === 'failed').length,
    },
    providers: [
      {
        key: 'openai',
        label: 'OpenAI content and graphics',
        status: !boolEnv('OPENAI_API_KEY') || openAiBlocked ? 'blocked' : 'ready',
        mode: 'auto',
        detail: !boolEnv('OPENAI_API_KEY') ? 'OPENAI_API_KEY is missing.' : openAiBlocked ? verification.openai.detail : 'Draft generation is configured; publishing remains separately controlled.',
      },
      {
        key: 'buffer',
        label: 'Buffer social distribution',
        status: boolEnv('BUFFER_API_KEY') && boolEnv('BUFFER_FACEBOOK_CHANNEL_ID') ? 'ready' : 'blocked',
        mode: 'approve',
        detail: boolEnv('BUFFER_API_KEY') && boolEnv('BUFFER_FACEBOOK_CHANNEL_ID') ? 'Connected for approval-gated scheduling.' : 'An existing Buffer account is available, but its API key and channel ID are not stored in VestBlock yet.',
      },
      {
        key: 'n8n',
        label: 'n8n automation bridge',
        status: boolEnv('N8N_WEBHOOK_URL') && boolEnv('N8N_WEBHOOK_SECRET')
          ? verification.n8n.status === 'verified' ? 'ready' : 'partial'
          : 'blocked',
        mode: 'approve',
        detail: boolEnv('N8N_WEBHOOK_URL') && boolEnv('N8N_WEBHOOK_SECRET')
          ? verification.n8n.status === 'verified'
            ? 'Connected as a credential-protected HMAC execution bridge; VestBlock remains the source of truth.'
            : verification.n8n.detail
          : 'No approved signed n8n endpoint is configured.',
      },
      {
        key: 'google_ads',
        label: 'Google Ads reporting and scripts',
        status: adsConfigured ? 'ready' : 'blocked',
        mode: 'approve',
        detail: adsConfigured ? 'Account reporting can be connected; spend changes remain human-approved.' : 'Google Ads account and developer credentials are not configured.',
      },
      {
        key: 'chatgpt_ads',
        label: 'ChatGPT Ads',
        status: !openAiAds.configured
          ? 'blocked'
          : openAiAds.reportingError || openAiAds.reviewStatus !== 'approved'
            ? 'partial'
            : 'ready',
        mode: 'approve',
        detail: !openAiAds.configured
          ? 'Create the advertiser account and store an account-scoped OPENAI_ADS_API_KEY.'
          : openAiAds.reportingError
            ? openAiAds.reportingError
            : `Account ${openAiAds.accountStatus || 'status unknown'}; review ${openAiAds.reviewStatus || 'pending'}. Campaign creation and spend remain founder-approved.`,
      },
      {
        key: 'search_console',
        label: 'Google Search Console',
        status: searchConsoleCredentialed ? 'ready' : searchConsoleConfigured ? 'partial' : 'blocked',
        mode: 'suggest',
        detail: searchConsoleCredentialed ? 'Site and credential are configured.' : searchConsoleConfigured ? 'The site is identified, but a service credential is not configured.' : 'Search Console is not configured.',
      },
    ],
    autonomy: autonomyPolicies as AutopilotCockpitSnapshot['autonomy'],
  }
}
