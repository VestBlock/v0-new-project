#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import {
  createDealMachineV2Client,
  dealMachineApiKey,
  isDealMachineCredentialFormat,
} from '../lib/dealmachine/v2-client.mjs'

const OUT_DIR = path.join(process.cwd(), 'data', 'operating-loops')
const SUMMARY_FILE = path.join(OUT_DIR, 'dealmachine-api-capabilities-summary.json')

function maskToken(value) {
  if (!value) return 'missing'
  return `${value.slice(0, 7)}...${value.slice(-4)}`
}

async function check(label, task) {
  const startedAt = Date.now()
  try {
    const payload = await task()
    return {
      label,
      ok: true,
      latencyMs: Date.now() - startedAt,
      count: Array.isArray(payload) ? payload.length : Array.isArray(payload?.data) ? payload.data.length : null,
      message: 'available',
    }
  } catch (error) {
    return {
      label,
      ok: false,
      latencyMs: Date.now() - startedAt,
      status: error?.status || null,
      code: error?.code || null,
      message: error?.message || String(error),
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const key = dealMachineApiKey()
  if (!isDealMachineCredentialFormat(key)) {
    throw new Error('DEALMACHINE_API_KEY must contain a full official dm_sk_live_* or dm_at_live_* credential.')
  }
  const client = createDealMachineV2Client({ apiKey: key })
  const probes = []
  probes.push(await check('account', () => client.account()))
  probes.push(await check('usage', () => client.usage()))
  probes.push(await check('property_filters', () => client.listFilters('properties')))
  probes.push(await check('people_filters', () => client.listFilters('people')))
  probes.push(await check('property_fields', () => client.listFields('properties')))
  probes.push(await check('people_fields', () => client.listFields('people')))
  probes.push(await check('locations', () => client.resolveCity('Kansas City', 'MO')))
  probes.push(await check('lists', () => client.listLists({ page: 1, per_page: 1 })))
  probes.push(await check('exports', () => client.listExports({ page: 1, per_page: 1 })))

  const summary = {
    generatedAt: new Date().toISOString(),
    apiFamily: 'official-v2',
    keyPresent: true,
    keyFingerprint: maskToken(key),
    legacyPrivateApiDisabled: true,
    capabilities: {
      authenticated: probes.find((probe) => probe.label === 'account')?.ok || false,
      usageVisible: probes.find((probe) => probe.label === 'usage')?.ok || false,
      dynamicFilters: probes.filter((probe) => probe.label.endsWith('_filters')).every((probe) => probe.ok),
      dynamicFields: probes.filter((probe) => probe.label.endsWith('_fields')).every((probe) => probe.ok),
      locationResolution: probes.find((probe) => probe.label === 'locations')?.ok || false,
      savedLists: probes.find((probe) => probe.label === 'lists')?.ok || false,
      exportHistory: probes.find((probe) => probe.label === 'exports')?.ok || false,
      strategyRunnerReady: probes.slice(0, 7).every((probe) => probe.ok),
    },
    rateLimit: client.getRateLimit(),
    probes,
  }
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.capabilities.strategyRunnerReady) process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.message || String(error))
  process.exitCode = 1
})
