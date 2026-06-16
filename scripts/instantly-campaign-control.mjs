#!/usr/bin/env node

/**
 * Inspect or configure an Instantly campaign without exposing API keys.
 *
 * Examples:
 *   node --env-file=.env.local scripts/instantly-campaign-control.mjs --campaign-id=...
 *   node --env-file=.env.local scripts/instantly-campaign-control.mjs --campaign-id=... --sender=acquisitions@vestblock.io --daily-limit=10 --apply
 *   node --env-file=.env.local scripts/instantly-campaign-control.mjs --campaign-id=... --activate
 *   node --env-file=.env.local scripts/instantly-campaign-control.mjs --campaign-id=... --pause
 */

import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const API_BASE_URL = String(process.env.INSTANTLY_API_BASE_URL || 'https://api.instantly.ai').replace(/\/+$/, '')
const KEYCHAIN_SERVICE = 'VestBlock Instantly API'
const KEYCHAIN_ACCOUNT = 'acquisitions@vestblock.io'

function hasFlag(name) {
  return args.includes(name)
}

function getArg(name, fallback = '') {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return fallback
}

function intArg(name, fallback) {
  const parsed = Number.parseInt(getArg(name, ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getApiKey() {
  const envKey = String(process.env.INSTANTLY_API_KEY || '').trim()
  if (envKey) return envKey
  if (process.platform !== 'darwin') return ''
  try {
    return execFileSync('/usr/bin/security', [
      'find-generic-password',
      '-a',
      KEYCHAIN_ACCOUNT,
      '-s',
      KEYCHAIN_SERVICE,
      '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

async function instantlyRequest(apiKey, endpoint, init = {}) {
  const headers = {
    authorization: `Bearer ${apiKey}`,
    ...(init.body ? { 'content-type': 'application/json' } : {}),
    ...(init.headers || {}),
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    headers,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = data?.message || data?.error || text || `Instantly request failed with ${response.status}`
    throw new Error(`${response.status} ${message}`)
  }
  return data
}

function summarizeCampaign(campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    daily_limit: campaign.daily_limit,
    email_gap: campaign.email_gap,
    stop_on_reply: campaign.stop_on_reply,
    stop_on_auto_reply: campaign.stop_on_auto_reply,
    open_tracking: campaign.open_tracking,
    link_tracking: campaign.link_tracking,
    email_list: campaign.email_list || [],
    schedule: campaign.campaign_schedule,
    sequence_steps: Array.isArray(campaign.sequences)
      ? campaign.sequences.reduce((sum, sequence) => sum + (sequence.steps?.length || 0), 0)
      : 0,
  }
}

async function main() {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(`Missing INSTANTLY_API_KEY. Add it to .env.local or macOS Keychain service "${KEYCHAIN_SERVICE}" account "${KEYCHAIN_ACCOUNT}".`)
  }

  const campaignId = getArg('--campaign-id')
  if (!campaignId) throw new Error('Missing --campaign-id=...')

  const current = await instantlyRequest(apiKey, `/api/v2/campaigns/${campaignId}`)
  const sender = getArg('--sender')
  const dailyLimit = intArg('--daily-limit', current.daily_limit || 10)
  const apply = hasFlag('--apply')
  const activate = hasFlag('--activate')
  const pause = hasFlag('--pause')

  if (activate && pause) throw new Error('Use only one of --activate or --pause.')

  const patch = {
    daily_limit: dailyLimit,
    stop_on_reply: true,
    stop_on_auto_reply: true,
    open_tracking: false,
  }
  if (sender) patch.email_list = [sender]

  let updated = apply
    ? await instantlyRequest(apiKey, `/api/v2/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    : current

  if (activate || pause) {
    updated = await instantlyRequest(apiKey, `/api/v2/campaigns/${campaignId}/${activate ? 'activate' : 'pause'}`, {
      method: 'POST',
    })
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: !apply && !activate && !pause,
    campaign: summarizeCampaign(updated),
    plannedPatch: apply ? undefined : patch,
    notes: activate
      ? 'Campaign was activated.'
      : pause
        ? 'Campaign was paused.'
        : apply
      ? 'Campaign was configured. Activation is still intentionally manual/explicit.'
      : 'Dry run only. Re-run with --apply to configure the sender and safety settings.',
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
