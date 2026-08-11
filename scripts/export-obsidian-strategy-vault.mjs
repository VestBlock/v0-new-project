import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const SKILLS_COMMIT = 'a1dc48e68138490d522c04cbf5822214c6eb1202'
const DEFAULT_VAULT = path.join(os.homedir(), 'Documents', 'VestBlock Strategy Vault')
const SENSITIVE_KEY = /(address|email|phone|password|secret|token|credential)/i

const argValue = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const hasArg = (name) => process.argv.includes(name)
const clean = (value, fallback = '') =>
  value === null || value === undefined ? fallback : String(value).replace(/\r?\n/g, ' ').trim() || fallback
const yaml = (value) => JSON.stringify(clean(value))
const md = (value, fallback = 'Not recorded.') => clean(value, fallback)
const hash = (value, length = 12) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length)
const slug = (value) =>
  clean(value, 'untitled').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'untitled'

function resolveVaultPath(input) {
  const value = clean(input || process.env.VESTBLOCK_OBSIDIAN_VAULT || DEFAULT_VAULT)
  const expanded = value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value
  const resolved = path.resolve(expanded)
  if (resolved === path.parse(resolved).root || resolved === os.homedir()) {
    throw new Error('Refusing to use a filesystem root or home directory as the vault.')
  }
  return resolved
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(temporary, content, 'utf8')
  fs.renameSync(temporary, filePath)
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) atomicWrite(filePath, content)
}

function frontmatter(values) {
  const lines = ['---']
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`, ...value.map((item) => `  - ${yaml(item)}`))
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${yaml(value)}`)
    }
  }
  return `${lines.join('\n')}\n---\n`
}

function bullets(values, fallback) {
  const entries = Array.isArray(values) ? values.map((value) => clean(value)).filter(Boolean) : []
  return entries.length ? entries.map((value) => `- ${value}`).join('\n') : `- ${fallback}`
}

function assertNoSensitiveKeys(value, context) {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new Error(`Sensitive field blocked in ${context}: ${key}`)
    assertNoSensitiveKeys(nested, context)
  }
}

async function queryRows(client, table, configure, warnings) {
  const { data, error } = await configure(client.from(table).select('*'))
  if (error) {
    warnings.push(`${table}: ${error.message}`)
    return []
  }
  return data || []
}

async function liveSnapshot() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase URL and service role key are required for a live vault export.')
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const warnings = []
  const [strategies, experiments, campaigns, contentAssets] = await Promise.all([
    queryRows(client, 'strategy_updates', (q) => q.eq('target_type', 'vestblock_strategy').order('created_at', { ascending: false }).limit(250), warnings),
    queryRows(client, 'experiment_results', (q) => q.eq('category', 'strategy_revenue_attribution').order('created_at', { ascending: false }).limit(250), warnings),
    queryRows(client, 'command_center_strategy_runs', (q) => q.order('created_at', { ascending: false }).limit(250), warnings),
    queryRows(client, 'content_assets', (q) => q.order('created_at', { ascending: false }).limit(1000), warnings),
  ])
  return { source: 'live-supabase', strategies, experiments, campaigns, contentAssets, warnings }
}

function fixtureSnapshot() {
  return {
    source: 'controlled-fixture', warnings: [], experiments: [], campaigns: [], contentAssets: [],
    strategies: [{
      id: 'fixture-strategy', title: 'Fixture strategy for exporter validation', target_key: 'fixture:strategy',
      risk_level: 'low', approval_status: 'queued', created_at: '2026-08-10T00:00:00.000Z', updated_at: '2026-08-10T00:00:00.000Z',
      proposed_change_json: {
        vertical: 'seo', status: 'candidate', hypothesis: 'Validate the exporter without touching live data.',
        tactic: 'Generate a temporary vault and run structural checks.', targetAudience: 'VestBlock operator',
        expectedOutcome: 'A valid local test vault.', primaryKpi: 'valid files', secondaryKpis: ['valid canvas', 'valid links'],
        evidence: ['Controlled fixture'], confidence: 100, score: { total: 100, formula: 'fixture' },
      },
    }],
  }
}

function providerVerification() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'provider-verification.json'), 'utf8'))
  } catch {
    return { checkedAt: null, providers: {} }
  }
}

function providerLines(verification) {
  const entries = Object.entries(verification.providers || {})
  return entries.length
    ? entries.map(([name, value]) => `- **${name}: ${clean(value.status, 'unknown')}** — ${md(value.detail)}`).join('\n')
    : '- Provider verification was unavailable.'
}

function strategyNote(row) {
  const value = row.proposed_change_json || {}
  const score = value.score || {}
  const title = md(value.name || row.title, 'Untitled strategy')
  const vertical = clean(value.vertical, 'unclassified')
  return {
    title,
    body: [
      frontmatter({
        title, type: 'strategy', tags: ['vestblock', 'strategy', `vertical/${vertical}`], vertical,
        status: clean(value.status, 'candidate'), approval: clean(row.approval_status, 'queued'),
        risk: clean(value.risk || row.risk_level, 'unknown'), score: Number(score.total || 0),
        confidence: Number(value.confidence || 0), created: clean(row.created_at || value.dateCreated),
        updated: clean(row.updated_at || row.created_at), source_id: clean(row.id),
      }),
      `# ${title}`, '',
      '> [!info] Derived decision record',
      '> Supabase remains authoritative. Durable founder thinking belongs in `Notes/`.', '',
      '## Decision frame', '',
      `**Hypothesis:** ${md(value.hypothesis || row.rationale)}`, '',
      `**Problem:** ${md(value.problem)}`, '',
      `**Audience:** ${md(value.targetAudience)}`, '',
      `**Channel:** ${md(value.channel)}`, '',
      `**Tactic:** ${md(value.tactic)}`, '',
      `**Expected outcome:** ${md(value.expectedOutcome)}`, '',
      '## Measurement', '',
      `**Primary KPI:** ${md(value.primaryKpi)}`, '',
      '**Secondary KPIs**', bullets(value.secondaryKpis, 'No secondary KPI recorded.'), '',
      `**Score:** ${Number(score.total || 0)}/100`, '',
      `**Formula:** ${md(score.formula)}`, '',
      '## Evidence', '', bullets(value.evidence, 'No evidence recorded.'), '',
      '## Learning memory', '',
      `**Result:** ${md(value.result)}`, '',
      `**Lesson:** ${md(value.lesson)}`, '',
      `**Next iteration:** ${md(value.nextIteration)}`, '',
      '[[00 - Home|Back home]]', '',
    ].join('\n'),
  }
}

function experimentNote(row) {
  const allowed = ['leads', 'replies', 'opportunities', 'conversions', 'revenue', 'measuredAt']
  const metrics = Object.fromEntries(allowed.filter((key) => row.metrics_json?.[key] !== undefined).map((key) => [key, row.metrics_json[key]]))
  assertNoSensitiveKeys(metrics, `experiment ${row.id || row.experiment_key}`)
  const title = clean(row.experiment_key || row.id, 'Untitled experiment')
  return [
    frontmatter({
      title, type: 'experiment', tags: ['vestblock', 'experiment'], category: clean(row.category),
      variant: clean(row.variant_key), winner: Boolean(row.winner), created: clean(row.created_at), source_id: clean(row.id),
    }),
    `# ${title}`, '',
    '> [!info] Aggregate measurement; lead and customer details are excluded.', '',
    '## Metrics', '',
    Object.keys(metrics).length ? Object.entries(metrics).map(([key, value]) => `- **${key}:** ${clean(value)}`).join('\n') : '- No measured metrics recorded.', '',
    '## Lesson', '', md(row.notes), '', '[[00 - Home|Back home]]', '',
  ].join('\n')
}

function makeCanvas() {
  const lanes = [
    ['Today', -900, '1'], ['Pipeline', -450, '2'], ['Growth', 0, '4'], ['AI Brain', 450, '6'], ['System', 900, '5'],
  ]
  const homeId = hash('canvas-home', 16)
  const nodes = [
    { id: hash('canvas-group', 16), type: 'group', x: -1020, y: -230, width: 2240, height: 620, label: 'VestBlock Decision Operating System', color: '#c9ff00' },
    { id: homeId, type: 'file', x: 0, y: 160, width: 320, height: 160, file: '00 - Home.md' },
    ...lanes.map(([name, x, color]) => ({ id: hash(`lane-${name}`, 16), type: 'file', x, y: -120, width: 320, height: 190, file: `Lanes/${name}.md`, color })),
  ]
  const edges = lanes.map(([name]) => ({
    id: hash(`edge-${name}`, 16), fromNode: homeId, fromSide: 'top', toNode: hash(`lane-${name}`, 16),
    toSide: 'bottom', toEnd: 'arrow', label: name,
  }))
  return { nodes, edges }
}

function validateCanvas(canvas) {
  const ids = [...canvas.nodes, ...canvas.edges].map((item) => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('Canvas contains duplicate IDs.')
  const nodes = new Set(canvas.nodes.map((item) => item.id))
  if (canvas.edges.some((edge) => !nodes.has(edge.fromNode) || !nodes.has(edge.toNode))) throw new Error('Canvas contains a dangling edge.')
}

function tally(rows, key = 'status') {
  return rows.reduce((result, row) => {
    const value = clean(row[key], 'unknown')
    result[value] = (result[value] || 0) + 1
    return result
  }, {})
}

function generateVault(vaultPath, snapshot) {
  fs.mkdirSync(vaultPath, { recursive: true })
  const generatedAt = new Date().toISOString()
  const verification = providerVerification()
  const generatedFiles = []
  const strategyLinks = []
  const queuedLinks = []
  const experimentLinks = []

  for (const row of snapshot.strategies) {
    const note = strategyNote(row)
    const relative = `Strategies/${slug(note.title)}--${hash(row.id || row.target_key || note.title)}.md`
    atomicWrite(path.join(vaultPath, relative), note.body)
    generatedFiles.push(relative)
    const link = `[[${relative.slice(0, -3)}|${note.title}]]`
    strategyLinks.push(link)
    if (clean(row.approval_status, 'queued') === 'queued') queuedLinks.push(link)
  }
  for (const row of snapshot.experiments) {
    const title = clean(row.experiment_key || row.id, 'experiment')
    const relative = `Experiments/${slug(title)}--${hash(row.id || title)}.md`
    atomicWrite(path.join(vaultPath, relative), experimentNote(row))
    generatedFiles.push(relative)
    experimentLinks.push(`[[${relative.slice(0, -3)}|${title}]]`)
  }

  const campaignCounts = tally(snapshot.campaigns)
  const contentCounts = tally(snapshot.contentAssets)
  const logoSource = path.join(ROOT, 'public', 'brand', 'vestblock-monogram.png')
  const hasLogo = fs.existsSync(logoSource)
  const pages = {
    '00 - Home.md': [
      frontmatter({ title: 'VestBlock Strategy Vault', type: 'home', tags: ['vestblock', 'operating-system'], generated: generatedAt, source: snapshot.source }),
      '# VestBlock Strategy Vault', '', hasLogo ? '![[Assets/vestblock-monogram.png|160]]' : '', '',
      '> [!warning] Read-only operating projection',
      '> Supabase and the VestBlock Command Center remain authoritative. Generated records are overwritten; durable human thinking belongs in [[Notes/Founder Notes]].', '',
      '## Five decision lanes', '',
      '- [[Lanes/Today|Today]] — decisions and the smallest useful move',
      '- [[Lanes/Pipeline|Pipeline]] — strategy campaigns closest to execution',
      '- [[Lanes/Growth|Growth]] — content and channel readiness',
      '- [[Lanes/AI Brain|AI Brain]] — hypotheses, evidence, scores, and lessons',
      '- [[Lanes/System|System]] — provider truth and operating boundaries', '',
      '## Current memory', '',
      `- Strategies: **${snapshot.strategies.length}**`, `- Awaiting approval: **${queuedLinks.length}**`,
      `- Planned campaigns: **${campaignCounts.planned || 0}**`, `- Measured experiments: **${snapshot.experiments.length}**`, '',
      '## Views', '',
      '- [[Dashboards/Strategies.base|Strategy dashboard]]', '- [[Dashboards/Experiments.base|Experiment dashboard]]',
      '- [[Maps/VestBlock Operating System.canvas|Operating-system map]]', '- [[Notes/Founder Notes|Founder notes]]', '',
      `_Last generated ${generatedAt} on ${os.hostname()}._`, '',
    ].join('\n'),
    'Lanes/Today.md': [
      frontmatter({ title: 'Today', type: 'lane', lane: 'today', generated: generatedAt, tags: ['vestblock', 'lane/today'] }),
      '# Today', '', '> [!todo] Needs a founder decision',
      queuedLinks.length ? queuedLinks.map((link) => `- ${link}`).join('\n') : '- No queued strategy decision is present.', '',
      '## Smallest useful move', '',
      queuedLinks.length ? `Review ${queuedLinks[0]}. Approval creates only a plan; it does not grant launch authority.` : 'Generate grounded weekly candidates when new operating evidence is available.', '',
      '[[00 - Home|Back home]]', '',
    ].join('\n'),
    'Lanes/Pipeline.md': [
      frontmatter({ title: 'Pipeline', type: 'lane', lane: 'pipeline', generated: generatedAt, tags: ['vestblock', 'lane/pipeline'] }),
      '# Pipeline', '', '> [!info] Strategy campaigns only',
      '> Lead and customer records are excluded. Use the Command Center for operational pipeline details.', '',
      snapshot.campaigns.length
        ? snapshot.campaigns.slice(0, 50).map((row) => `- **${md(row.strategy_name, 'Unnamed strategy')}** — ${clean(row.status, 'unknown')} · ${clean(row.created_at, 'date unavailable')}`).join('\n')
        : '- No strategy campaign run is recorded.', '', '[[00 - Home|Back home]]', '',
    ].join('\n'),
    'Lanes/Growth.md': [
      frontmatter({ title: 'Growth', type: 'lane', lane: 'growth', generated: generatedAt, tags: ['vestblock', 'lane/growth'] }),
      '# Growth', '', '## Content inventory', '',
      Object.keys(contentCounts).length ? Object.entries(contentCounts).map(([status, count]) => `- **${status}:** ${count}`).join('\n') : '- No content records were available.', '',
      '## Provider truth', '', providerLines(verification), '', '[[00 - Home|Back home]]', '',
    ].join('\n'),
    'Lanes/AI Brain.md': [
      frontmatter({ title: 'AI Brain', type: 'lane', lane: 'ai-brain', generated: generatedAt, tags: ['vestblock', 'lane/ai-brain'] }),
      '# AI Brain', '', '> [!tip] Compounding memory', '> Compare hypotheses with outcomes. Do not convert confidence into certainty.', '',
      '## Strategies', '', strategyLinks.length ? strategyLinks.map((link) => `- ${link}`).join('\n') : '- No strategy memory is recorded yet.', '',
      '## Experiments', '', experimentLinks.length ? experimentLinks.map((link) => `- ${link}`).join('\n') : '- No measured experiment is recorded yet.', '',
      '[[00 - Home|Back home]]', '',
    ].join('\n'),
    'Lanes/System.md': [
      frontmatter({ title: 'System', type: 'lane', lane: 'system', generated: generatedAt, tags: ['vestblock', 'lane/system'] }),
      '# System', '', '## Authority', '',
      '- **Authoritative:** Supabase and VestBlock Command Center', '- **Derived:** this local Obsidian vault',
      '- **Export mode:** read-only aggregates; no lead/customer PII', '- **Publishing or spend authority:** none', '',
      '## Provider verification', '', providerLines(verification), '', '## Export warnings', '',
      snapshot.warnings.length ? snapshot.warnings.map((warning) => `- ${warning}`).join('\n') : '- None.', '', '[[00 - Home|Back home]]', '',
    ].join('\n'),
    'README.md': '# VestBlock Strategy Vault\n\nOpen `00 - Home.md` first. This is a generated, read-only projection of strategy and aggregate experiment records.\n\nRegenerate with `pnpm run obsidian:vault:export`.\n',
    'Dashboards/Strategies.base': [
      'filters:', '  and:', '    - \'file.inFolder("Strategies")\'', '    - \'type == "strategy"\'', 'views:',
      '  - type: table', '    name: "Decision Queue"', '    filters:', '      and:', '        - \'approval == "queued"\'',
      '    order:', '      - file.name', '      - vertical', '      - approval', '      - score', '      - confidence', '      - risk', '      - updated',
      '  - type: table', '    name: "All Strategy Memory"', '    order:', '      - file.name', '      - vertical', '      - status', '      - approval', '      - score', '      - updated', '',
    ].join('\n'),
    'Dashboards/Experiments.base': [
      'filters:', '  and:', '    - \'file.inFolder("Experiments")\'', '    - \'type == "experiment"\'', 'views:',
      '  - type: table', '    name: "Experiment Memory"', '    order:', '      - file.name', '      - category', '      - variant', '      - winner', '      - created', '',
    ].join('\n'),
  }
  for (const [relative, body] of Object.entries(pages)) {
    atomicWrite(path.join(vaultPath, relative), body)
    generatedFiles.push(relative)
  }

  const canvas = makeCanvas()
  validateCanvas(canvas)
  atomicWrite(path.join(vaultPath, 'Maps', 'VestBlock Operating System.canvas'), `${JSON.stringify(canvas, null, 2)}\n`)
  generatedFiles.push('Maps/VestBlock Operating System.canvas')
  writeIfMissing(path.join(vaultPath, 'Notes', 'Founder Notes.md'), `${frontmatter({ title: 'Founder Notes', type: 'founder-notes', tags: ['vestblock', 'founder-notes'] })}# Founder Notes\n\nThis file is human-owned and is never overwritten by the exporter.\n\n## Decisions\n\n- \n`)
  writeIfMissing(path.join(vaultPath, 'Templates', 'Decision Note.md'), `${frontmatter({ title: 'Decision Note', type: 'decision', status: 'open', tags: ['vestblock', 'decision'] })}# Decision\n\n## Context\n\n## Evidence\n\n## Decision\n\n## Expected result\n\n## Review date\n`)
  writeIfMissing(path.join(vaultPath, '.obsidian', 'app.json'), `${JSON.stringify({ newLinkFormat: 'shortest', useMarkdownLinks: false }, null, 2)}\n`)
  writeIfMissing(path.join(vaultPath, '.obsidian', 'appearance.json'), `${JSON.stringify({ baseFontSize: 16, theme: 'obsidian' }, null, 2)}\n`)
  if (hasLogo) {
    fs.mkdirSync(path.join(vaultPath, 'Assets'), { recursive: true })
    fs.copyFileSync(logoSource, path.join(vaultPath, 'Assets', 'vestblock-monogram.png'))
    generatedFiles.push('Assets/vestblock-monogram.png')
  }

  const manifest = {
    schemaVersion: 1, generatedAt, generatedOn: os.hostname(), source: snapshot.source,
    sourceOfTruth: 'Supabase and VestBlock Command Center', piiExported: false, publishAuthority: false,
    skillsCommit: SKILLS_COMMIT,
    counts: { strategies: snapshot.strategies.length, experiments: snapshot.experiments.length, campaigns: snapshot.campaigns.length, contentAssets: snapshot.contentAssets.length },
    warnings: snapshot.warnings, generatedFiles: generatedFiles.sort(),
  }
  assertNoSensitiveKeys(manifest, 'manifest')
  atomicWrite(path.join(vaultPath, '.vestblock-export-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return { vaultPath, ...manifest }
}

async function main() {
  const vaultPath = resolveVaultPath(argValue('--vault'))
  const snapshot = hasArg('--fixture') ? fixtureSnapshot() : await liveSnapshot()
  process.stdout.write(`${JSON.stringify(generateVault(vaultPath, snapshot), null, 2)}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
