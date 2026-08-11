import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vestblock-obsidian-test-'))
const vaultPath = path.join(testRoot, 'vault')

function exportFixture() {
  const result = spawnSync(
    process.execPath,
    ['scripts/export-obsidian-strategy-vault.mjs', '--fixture', '--vault', vaultPath],
    { cwd: process.cwd(), encoding: 'utf8' }
  )
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Fixture export failed.')
}

try {
  exportFixture()
  const required = [
    '00 - Home.md',
    'Lanes/Today.md',
    'Lanes/Pipeline.md',
    'Lanes/Growth.md',
    'Lanes/AI Brain.md',
    'Lanes/System.md',
    'Dashboards/Strategies.base',
    'Dashboards/Experiments.base',
    'Maps/VestBlock Operating System.canvas',
    'Notes/Founder Notes.md',
    '.vestblock-export-manifest.json',
  ]
  for (const relative of required) {
    if (!fs.existsSync(path.join(vaultPath, relative))) throw new Error(`Missing ${relative}`)
  }

  const canvas = JSON.parse(fs.readFileSync(path.join(vaultPath, 'Maps', 'VestBlock Operating System.canvas'), 'utf8'))
  const ids = [...canvas.nodes, ...canvas.edges].map((item) => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('Canvas IDs are not unique.')
  const nodeIds = new Set(canvas.nodes.map((node) => node.id))
  if (canvas.edges.some((edge) => !nodeIds.has(edge.fromNode) || !nodeIds.has(edge.toNode))) {
    throw new Error('Canvas contains a dangling edge.')
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(vaultPath, '.vestblock-export-manifest.json'), 'utf8'))
  if (manifest.source !== 'controlled-fixture') throw new Error('Fixture source was not preserved.')
  if (manifest.piiExported !== false || manifest.publishAuthority !== false) {
    throw new Error('Safety boundaries are missing from the manifest.')
  }

  const strategyFiles = fs
    .readdirSync(path.join(vaultPath, 'Strategies'))
    .map((name) => `Strategies/${name}`)
  const generatedText = [...required.filter((relative) => !relative.endsWith('.canvas')), ...strategyFiles]
    .map((relative) => fs.readFileSync(path.join(vaultPath, relative), 'utf8'))
    .join('\n')
  if (/jane@example\.com|123 Main Street/i.test(generatedText)) {
    throw new Error('Fixture PII was exported into the generated vault.')
  }
  if (!/\[REDACTED EMAIL\]|\[REDACTED STREET ADDRESS\]/.test(generatedText)) {
    throw new Error('Value-level PII redaction was not demonstrated.')
  }

  const founderFile = path.join(vaultPath, 'Notes', 'Founder Notes.md')
  fs.appendFileSync(founderFile, '\nPersistent founder thought.\n')
  exportFixture()
  if (!fs.readFileSync(founderFile, 'utf8').includes('Persistent founder thought.')) {
    throw new Error('Exporter overwrote the human-owned Founder Notes file.')
  }

  console.log('Obsidian strategy vault fixture, Canvas, safety manifest, and human-note preservation passed.')
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true })
}
