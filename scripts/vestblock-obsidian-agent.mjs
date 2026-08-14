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
  console.log(JSON.stringify({ refreshed: lanes.length, source: 'Supabase strategy_lane_versions', vault: VAULT }, null, 2))
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
