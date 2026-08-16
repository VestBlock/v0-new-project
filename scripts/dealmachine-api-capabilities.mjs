#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import {
  createDealMachineV2Client,
  dealMachineApiKey,
  getDealMachineConnectionHealth,
  isDealMachineDiscoveryEnabled,
} from '../lib/dealmachine/v2-client.mjs'

const OUT_DIR = path.join(process.cwd(), 'data', 'operating-loops')
const SUMMARY_FILE = path.join(OUT_DIR, 'dealmachine-native-api-health.json')

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
      requestId: error?.requestId || null,
      message: 'Probe failed. Use status, code, and requestId for provider support.',
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const discoveryEnabled = isDealMachineDiscoveryEnabled()
  const health = await getDealMachineConnectionHealth({ verify: discoveryEnabled })
  const probes = []

  if (health.state === 'working') {
    const client = createDealMachineV2Client({ apiKey: dealMachineApiKey() })
    probes.push(await check('usage', () => client.usage()))
    probes.push(await check('property_filters', () => client.listFilters('properties')))
    probes.push(await check('property_fields', () => client.listFields('properties')))
    probes.push(await check('locations', () => client.resolveCity('Kansas City', 'MO')))
  }

  const filterProbes = probes.filter((probe) => probe.label.endsWith('_filters'))
  const fieldProbes = probes.filter((probe) => probe.label.endsWith('_fields'))
  const summary = {
    generatedAt: new Date().toISOString(),
    apiFamily: 'official-v2-native',
    exportAutomationRetired: true,
    health,
    capabilities: {
      authenticated: health.state === 'working',
      usageVisible: probes.find((probe) => probe.label === 'usage')?.ok || false,
      dynamicFilters: filterProbes.length === 1 && filterProbes.every((probe) => probe.ok),
      dynamicFields: fieldProbes.length === 1 && fieldProbes.every((probe) => probe.ok),
      locationResolution: probes.find((probe) => probe.label === 'locations')?.ok || false,
      propertyDiscoveryEnabled: discoveryEnabled,
      legacyNativeSyncEnabled: health.enabled,
      peopleOrContactDiscoveryEnabled: false,
    },
    probes,
  }
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (health.configured && health.state !== 'working') process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.message || String(error))
  process.exitCode = 1
})
