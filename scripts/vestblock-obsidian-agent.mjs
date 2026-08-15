#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const VAULT = 'VestBlock Strategy Vault'
const commandIndex = process.argv[2] === '--' ? 3 : 2
const command = process.argv[commandIndex]
const option = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : null
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function safePath(value, { notesOnly = false } = {}) {
  const path = String(value || '').trim().replaceAll('\\', '/')
  if (!path || path.startsWith('/') || path.includes('../') || path.includes('\0')) fail('A safe vault-relative path is required.')
  if (notesOnly && !path.startsWith('Notes/')) fail('Durable agent notes must stay under Notes/.')
  return path
}

function obsidian(args, { capture = false } = {}) {
  const result = spawnSync('obsidian', [`vault=${VAULT}`, ...args], { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.error) fail(`Obsidian CLI is unavailable: ${result.error.message}`)
  if (result.status !== 0) fail((result.stderr || result.stdout || 'Obsidian command failed.').trim())
  return (result.stdout || '').trim()
}

function ensureHealthy() {
  const total = obsidian(['files', 'total'], { capture: true })
  const errors = obsidian(['dev:errors'], { capture: true })
  if (!/^\d+$/.test(total)) fail('The VestBlock Strategy Vault is not available.')
  return { total: Number(total), errors: errors || 'No errors captured.' }
}

function markdownForLane(lane) {
  const contract = lane.contract_json || {}
  const list = (value) => (Array.isArray(value) ? value.map((item) => `- ${String(item)}`).join('\n') : '- Not recorded')
  const provenance = Array.isArray(lane.source_provenance_json) ? lane.source_provenance_json : []
  return `---
lane: ${lane.lane_key}
version: ${lane.version}
status: ${lane.status}
approved_at: ${lane.approved_at || ''}
projection: true
---

# ${lane.title}

> Read-only projection from Supabase. Review and approve material changes in the VestBlock Command Center.

## Objective

${contract.objective || 'Not recorded'}

## Target participant

${contract.targetCustomer || 'Not recorded'}

## Qualification

${list(contract.qualificationCriteria)}

## Approved sources

${list(contract.approvedDataSources)}

## Customer path

${contract.recommendedCustomerPath || 'Not recorded'}

## Outreach methods

${list(contract.outreachMethods)}

## Consent and lawful basis

${list(contract.consentOrLawfulBasis)}

## Suppressions and exclusions

${list(contract.exclusionsAndSuppressions)}

## Primary conversion

${contract.primaryConversionEvent || 'Not recorded'}

## KPIs

${list(contract.kpis)}

## Failure conditions

${list(contract.failureConditions)}

## Human review

${list(contract.humanReviewRequirements)}

## Experiment

${contract.experimentHypothesis || 'Not recorded'}

Learning window: ${contract.learningWindowDays || '—'} days

## Source provenance

${provenance.length ? provenance.map((item) => `- ${item.source || 'source'} · ${item.kind || 'fact'} · ${item.observedAt || 'timestamp unavailable'}`).join('\n') : '- No provenance recorded'}
`
}

function list(value) {
  if (!Array.isArray(value) || !value.length) return '- Not recorded'
  return value.map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n')
}

function markdownForOperatingStrategy(row) {
  const contract = row.contract_json || {}
  const lifecycle = row.lifecycle_contract_json || {}
  const owner = row.owner_contract_json || {}
  const outcome = row.outcome_contract_json || {}
  const destination = row.destination_mode === 'public_route'
    ? `${row.destination_path} — ${row.cta_label}`
    : row.destination_mode
  return `---
strategy: ${row.strategy_key}
portfolio: ${row.portfolio_key}
version: ${row.operating_strategy_version}
status: ${row.version_status}
execution_mode: ${row.execution_mode}
external_send_cap: ${row.external_send_cap}
contract_fingerprint: ${row.operating_contract_fingerprint}
projection: true
projection_source: Supabase Gate 3C registry
---

# ${row.strategy_title}

> PII-free, read-only projection from the governed Supabase registry. Draft status is not execution authority. Approvals, activation, caps, channels, or contract changes must occur through the VestBlock review gate.

## Identity and destination

- Portfolio: ${row.portfolio_title} (${row.portfolio_key})
- Strategy: ${row.strategy_key}
- Version: ${row.operating_strategy_version}
- Status: ${row.version_status}
- Execution mode: ${row.execution_mode}
- External send cap: ${row.external_send_cap}
- Destination: ${destination}
- Contract fingerprint: ${row.operating_contract_fingerprint}
- CRM owner: ${row.crm_owner_key}
- Automation owner: ${row.automation_owner_key}
- Dispatch authority: ${owner.dispatchAuthority || 'Not recorded'}

## Objective

${contract.objective || 'Not recorded'}

## Participant, problem, and offer

- Target participant: ${contract.targetParticipant || 'Not recorded'}
- Problem: ${contract.problem || 'Not recorded'}
- Value exchange: ${contract.valueExchange || 'Not recorded'}
- Offer: ${contract.offer || 'Not recorded'}

## Eligibility

${list(contract.eligibilityCriteria)}

## Disqualification

${list(contract.disqualificationCriteria)}

## Channels and cadence

Primary channels:

${list(contract.primaryChannels)}

Secondary channels:

${list(contract.secondaryChannels)}

Cadence:

${list(contract.followupCadence)}

## Lifecycle authority

- Record authority: ${lifecycle.recordAuthority || 'Not recorded'}
- Initial state: ${lifecycle.initialState || 'Not recorded'}

Persisted states:

${list(lifecycle.persistedStates)}

Target-only stages:

${list(lifecycle.targetOnlyStages)}

Stop conditions:

${list(lifecycle.stopConditions)}

## Outcome and learning threshold

- Primary conversion: ${outcome.primaryConversionEvent || 'Not recorded'}
- Current outcome observable: ${outcome.targetOutcomeObservable === true ? 'yes' : 'no'}
- Learning window: ${outcome.learningWindowDays ?? '—'} days
- Minimum exposure: ${outcome.minimumExposure ?? '—'} ${outcome.exposureUnit || ''}
- Minimum primary conversions: ${outcome.minimumPrimaryConversions ?? '—'}
- Required complete windows: ${outcome.requiredCompleteWindows ?? '—'}
- Verified outcome rule: ${outcome.verifiedOutcomeRule || 'Not recorded'}

Leading indicators:

${list(outcome.leadingIndicators)}

Safeguards:

${list(outcome.safeguards)}

## Activation blockers

${list(contract.activationReadiness?.blockers)}

## Integration dependencies

${list(contract.integrationDependencies)}

## Source provenance

${list(row.source_provenance_json)}
`
}

function operatingRegistryIndex(rows) {
  const counts = rows.reduce((result, row) => {
    result[row.version_status] = (result[row.version_status] || 0) + 1
    return result
  }, {})
  return `---
projection: true
projection_source: Supabase Gate 3C registry
generated_at: ${new Date().toISOString()}
---

# Operating Strategy Registry

> Read-only registry projection. A strategy must never be treated as executable because it appears in this vault.

## Safety state

- Strategies: ${rows.length}
- Draft: ${counts.draft || 0}
- Active: ${counts.active || 0}
- Retired: ${counts.retired || 0}
- Total external send cap: ${rows.reduce((sum, row) => sum + Number(row.external_send_cap || 0), 0)}

## Strategies

${rows.map((row) => `- [[Strategies/Operating/${row.strategy_key}|${row.strategy_title}]] — ${row.version_status}, v${row.operating_strategy_version}, ${row.destination_mode}, cap ${row.external_send_cap}`).join('\n')}
`
}

async function refresh() {
  ensureHealthy()
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !serviceKey) fail('Supabase configuration is required for a strategy-vault refresh.')
  const response = await fetch(`${baseUrl}/rest/v1/strategy_lane_versions?status=eq.active&select=lane_key,version,title,status,contract_json,source_provenance_json,approved_at&order=lane_key.asc`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  })
  if (!response.ok) fail(`Strategy refresh failed safely with HTTP ${response.status}.`)
  const lanes = await response.json()
  for (const lane of lanes) {
    const path = safePath(`Strategies/${lane.lane_key}.md`)
    obsidian(['create', `path=${path}`, `content=${markdownForLane(lane)}`, 'overwrite'])
  }
  const operatingResponse = await fetch(`${baseUrl}/rest/v1/rpc/list_operating_strategy_registry_projection`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!operatingResponse.ok) fail(`Operating-strategy refresh failed safely with HTTP ${operatingResponse.status}.`)
  const versionRows = await operatingResponse.json()
  const latestByStrategy = new Map()
  for (const row of versionRows) {
    const current = latestByStrategy.get(row.strategy_key)
    if (!current || Number(row.operating_strategy_version) > Number(current.operating_strategy_version)) {
      latestByStrategy.set(row.strategy_key, row)
    }
  }
  const operatingStrategies = [...latestByStrategy.values()].sort((left, right) =>
    String(left.strategy_key).localeCompare(String(right.strategy_key))
  )
  if (operatingStrategies.length !== 17) {
    fail(`Operating-strategy projection expected 17 stable strategies and received ${operatingStrategies.length}.`)
  }
  for (const strategy of operatingStrategies) {
    const path = safePath(`Strategies/Operating/${strategy.strategy_key}.md`)
    obsidian(['create', `path=${path}`, `content=${markdownForOperatingStrategy(strategy)}`, 'overwrite'])
  }
  const indexPath = safePath('Strategies/Operating Strategy Registry.md')
  obsidian(['create', `path=${indexPath}`, `content=${operatingRegistryIndex(operatingStrategies)}`, 'overwrite'])
  const health = ensureHealthy()
  console.log(JSON.stringify({
    portfolioLanesRefreshed: lanes.length,
    operatingStrategiesRefreshed: operatingStrategies.length,
    source: 'Supabase governed strategy registries',
    vault: VAULT,
    health,
  }, null, 2))
}

if (!command || command === 'help') {
  console.log('Commands: status, refresh, read --path, search --query, open --path, append-founder --text, create-decision --title --content')
} else if (command === 'status') {
  console.log(JSON.stringify({ vault: VAULT, ...ensureHealthy() }, null, 2))
} else if (command === 'refresh') {
  await refresh()
} else if (command === 'read') {
  ensureHealthy()
  obsidian(['read', `path=${safePath(option('path'))}`])
} else if (command === 'search') {
  ensureHealthy()
  const query = String(option('query') || '').trim()
  if (!query || query.length > 200) fail('A search query between 1 and 200 characters is required.')
  obsidian(['search', `query=${query}`, 'format=json'])
} else if (command === 'open') {
  ensureHealthy()
  obsidian(['open', `path=${safePath(option('path'))}`])
} else if (command === 'append-founder') {
  ensureHealthy()
  const text = String(option('text') || '').trim()
  if (!text || text.length > 4000) fail('Founder note text between 1 and 4000 characters is required.')
  const path = safePath('Notes/Founder Decisions.md', { notesOnly: true })
  obsidian(['append', `path=${path}`, `content=\n- ${new Date().toISOString()} — ${text}`])
  obsidian(['read', `path=${path}`])
} else if (command === 'create-decision') {
  ensureHealthy()
  const title = String(option('title') || '').trim()
  const content = String(option('content') || '').trim()
  if (!title || !content || title.length > 120 || content.length > 8000) fail('A concise title and decision content are required.')
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
  const path = safePath(`Notes/${new Date().toISOString().slice(0, 10)}-${slug}.md`, { notesOnly: true })
  obsidian(['create', `path=${path}`, `content=# ${title}\n\n${content}`])
  obsidian(['read', `path=${path}`])
} else {
  fail(`Unknown guarded Obsidian command: ${command}`)
}
