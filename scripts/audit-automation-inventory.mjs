#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const excludedDirectories = new Set([
  '.git',
  '.next',
  '.npm-cache',
  '.playwright-cli',
  '.venv-homeharvest',
  'artifacts',
  'cache',
  'data',
  'logs',
  'node_modules',
  'output',
  'reports',
  'test-results',
  'tmp',
  'vendor',
])

const operationalPattern =
  /(agent|alert|automation|autopilot|batch|bounce|brief|buyer|campaign|content|cron|daily|dealmachine|discover|distress|email|enrich|export|follow.?up|funding|growth|harvest|index|inngest|investor|lead|lender|loop|market|monitor|notification|opportunity|orchestrat|outreach|pipeline|pr-engine|property|publish|queue|report|research|sam-|score|scrape|seller|send|sequence|social|source|sms|suppress|sync|task|visibility|watch|webhook|worker|workflow)/i

const serviceMatchers = [
  ['Apify', /\bapify\b/i],
  ['DealMachine', /\bdealmachine\b/i],
  ['Google', /googleapis|google[_-](?:places|workspace|search)|maps\.google/i],
  ['HomeHarvest', /homeharvest/i],
  ['Hunter', /hunter\.io|hunter_api/i],
  ['IndexNow', /indexnow/i],
  ['Inngest', /\binngest\b/i],
  ['Instantly', /\binstantly\b/i],
  ['OpenAI', /\bopenai\b/i],
  ['Outscraper', /\boutscraper\b/i],
  ['PayPal', /\bpaypal\b/i],
  ['RentCast', /\brentcast\b/i],
  ['Resend', /\bresend\b/i],
  ['SAM.gov', /sam\.gov|sam_gov|\bsam automation\b/i],
  ['Sentry', /\bsentry\b/i],
  ['Supabase', /\bsupabase\b/i],
  ['Vercel', /\bvercel\b/i],
]

function walk(directory, prefix = '') {
  const absolute = path.join(directory, prefix)
  if (!fs.existsSync(absolute)) return []

  const files = []
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...walk(directory, relative))
    else if (entry.isFile()) files.push(relative)
  }
  return files
}

function readJson(relative, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
  } catch {
    return fallback
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort()
}

function humanize(value) {
  return value
    .replace(/\/route\.[^.]+$/, '')
    .replace(/\.[^.]+$/, '')
    .split(/[\\/]/)
    .pop()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function lastKnownUse(relative) {
  try {
    const value = execFileSync('git', ['log', '-1', '--format=%cI', '--', relative], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (value) return { value, basis: 'last git commit touching file' }
  } catch {
    // Untracked or repository history unavailable; fall through to file metadata.
  }

  const modified = fs.statSync(path.join(root, relative)).mtime.toISOString()
  return { value: modified, basis: 'file modification time; runtime use unconfirmed' }
}

function extractQuoted(content, expression) {
  return unique([...content.matchAll(expression)].map((match) => match[1]))
}

function localImportSpecifiers(content) {
  return unique(
    [...content.matchAll(/(?:from\s+|import\s*\()(['"])(@\/[^'"]+|\.\.?\/[^'"]+)\1/g)].map(
      (match) => match[2],
    ),
  )
}

function resolveLocalImport(fromRelative, specifier) {
  const base = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : path.resolve(root, path.dirname(fromRelative), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ]

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue
    return path.relative(root, candidate)
  }
  return null
}

function dependencyClosure(relative, maxDepth = 4) {
  const visited = new Set([relative])
  const discovered = []
  let frontier = [{ relative, depth: 0 }]

  while (frontier.length) {
    const next = []
    for (const item of frontier) {
      if (item.depth >= maxDepth) continue
      const content = fs.readFileSync(path.join(root, item.relative), 'utf8')
      for (const specifier of localImportSpecifiers(content)) {
        const resolved = resolveLocalImport(item.relative, specifier)
        if (!resolved || visited.has(resolved)) continue
        visited.add(resolved)
        discovered.push(resolved)
        next.push({ relative: resolved, depth: item.depth + 1 })
      }
    }
    frontier = next
  }

  return discovered
}

function classifyFamily(relative) {
  const normalized = relative.toLowerCase()
  if (/buyer/.test(normalized)) return 'buyer acquisition and matching'
  if (/lender/.test(normalized)) return 'lender and capital matching'
  if (/investor|partner/.test(normalized)) return 'partner acquisition'
  if (/seller|distress|dealmachine|property|foreclosure|listing/.test(normalized)) return 'real-estate acquisition'
  if (/funding|capital|credit/.test(normalized)) return 'capital acquisition'
  if (/outreach|email|sms|campaign|bounce|suppress/.test(normalized)) return 'shared outreach'
  if (/content|seo|aeo|visibility|pr-engine|social|index/.test(normalized)) return 'growth and content'
  if (/command-center|boss|autopilot|daily-ops|growth-scoreboard/.test(normalized)) return 'operating control plane'
  if (/sam-|grant/.test(normalized)) return 'legacy government opportunity'
  if (/paypal|payment|dealvault/.test(normalized)) return 'payments and DealVault'
  if (/inngest|workflow|queue|worker/.test(normalized)) return 'workflow infrastructure'
  return 'supporting operations'
}

function recommendationFor(relative, family) {
  const normalized = relative.toLowerCase()

  if (/paypal-webhook|dealvault|api\/inngest|lib\/inngest/.test(normalized)) return 'KEEP'
  if (family === 'operating control plane') return 'MODERNIZE'
  if (family === 'shared outreach') return 'MERGE'
  if (/buyers-(discover|followup|performance|score)|lenders-(discover|followup|performance|score)|investors-(discover|followup|performance|score)/.test(normalized)) {
    return 'MERGE'
  }
  if (/pr-engine|sam-|credit-repair|dispute-letter|optimize-content|entity-seo|content-publisher/.test(normalized)) return 'ARCHIVE'
  if (/dealmachine|seller|distress|property|funding|capital|buyer|lender|investor|match|pipeline|score/.test(normalized)) return 'MODERNIZE'
  if (/visibility|seo|aeo|content|social/.test(normalized)) return 'MODERNIZE'
  return 'KEEP'
}

function businessValueFor(family) {
  const values = {
    'buyer acquisition and matching': 'Directly supports deal matching and conversion.',
    'lender and capital matching': 'Directly supports capital qualification, referral, and monetization.',
    'partner acquisition': 'Supports buyer, lender, and referral capacity.',
    'real-estate acquisition': 'Directly supports property discovery, seller intent, and deal creation.',
    'capital acquisition': 'Directly supports funding qualification and referral revenue.',
    'shared outreach': 'Moves qualified leads into conversations when consent and suppression controls hold.',
    'growth and content': 'May produce traffic and intent; retain only when attribution is observable.',
    'operating control plane': 'Coordinates prioritization, approvals, observability, and founder attention.',
    'legacy government opportunity': 'Outside the primary Capital/Deals engine unless evidence proves meaningful revenue.',
    'payments and DealVault': 'Supports revenue collection, deal execution, or transaction records.',
    'workflow infrastructure': 'Shared execution infrastructure; removal can break customer and internal workflows.',
    'supporting operations': 'Potential supporting value; requires owner and usage confirmation.',
  }
  return values[family]
}

function removalRisk(relative, recommendation) {
  if (/webhook|payment|paypal|dealvault|inngest|auth|sync/i.test(relative)) {
    return 'HIGH — external callers, financial state, authentication, or synchronization may depend on it.'
  }
  if (recommendation === 'ARCHIVE') return 'MEDIUM — stop scheduling first and preserve code, logs, and historical rows.'
  if (recommendation === 'MERGE' || recommendation === 'MODERNIZE') {
    return 'MEDIUM — callers and data writes must move to the shared replacement before disablement.'
  }
  return 'UNKNOWN — trace runtime callers and data writes before changing status.'
}

const packageJson = readJson('package.json', { scripts: {} })
const vercel = readJson('vercel.json', { crons: [] })
const packageScripts = packageJson.scripts || {}
const vercelSchedules = new Map((vercel.crons || []).map((entry) => [entry.path, entry.schedule]))
const allFiles = walk(root)

const packageCallers = new Map()
for (const [name, command] of Object.entries(packageScripts)) {
  for (const match of String(command).matchAll(/(?:^|\s)(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts|sh|py))/g)) {
    const callers = packageCallers.get(match[1]) || []
    callers.push(name)
    packageCallers.set(match[1], callers)
  }
  for (const match of String(command).matchAll(/(\/api\/cron\/[A-Za-z0-9_/-]+)/g)) {
    const route = `app${match[1]}/route.ts`
    const callers = packageCallers.get(route) || []
    callers.push(name)
    packageCallers.set(route, callers)
  }
}

function isCandidate(relative) {
  if (/^app\/api\/cron\/.*\/route\.ts$/.test(relative)) return true
  if (/^app\/api\/.*webhooks?.*\/route\.ts$/.test(relative)) return true
  if (/^(app\/api\/inngest|lib\/inngest)\//.test(relative)) return true
  if (/^scripts\//.test(relative) && /\.(mjs|cjs|js|ts|sh|py)$/.test(relative)) {
    return operationalPattern.test(relative) || packageCallers.has(relative)
  }
  if (/^lib\//.test(relative) && /\.(mjs|cjs|js|ts)$/.test(relative)) return operationalPattern.test(relative)
  if (/\.(command|sh)$/.test(relative) && !relative.startsWith('node_modules/')) return true
  if (/\.sql$/.test(relative)) {
    const content = fs.readFileSync(path.join(root, relative), 'utf8')
    return /(pg_cron|cron\.schedule|create\s+(?:or\s+replace\s+)?(?:function|trigger)|net\.http|webhook)/i.test(content)
  }
  if (/^\.github\/workflows\//.test(relative)) return true
  return false
}

const records = allFiles.filter(isCandidate).sort().map((relative) => {
  const content = fs.readFileSync(path.join(root, relative), 'utf8')
  const dependencyFiles = dependencyClosure(relative)
  const dependencyContent = dependencyFiles
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n')
  const tracedContent = `${content}\n${dependencyContent}`
  const routeMatch = relative.match(/^app(\/api\/(?:cron\/[^/]+|.*webhooks?.*))\/route\.ts$/)
  const route = routeMatch?.[1] || null
  const packageNames = unique(packageCallers.get(relative) || [])
  const methods = unique([...content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]))
  const localImports = localImportSpecifiers(content)
  const env = unique([
    ...extractQuoted(tracedContent, /process\.env(?:\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]|\.([A-Za-z_][A-Za-z0-9_]*))/g),
    ...[...tracedContent.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]),
  ])
  const tables = unique(extractQuoted(tracedContent, /\.from\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*\)/g))
  const urls = unique([...tracedContent.matchAll(/https?:\/\/([^/'"`\s)]+)/g)].map((match) => match[1].toLowerCase()))
  const services = unique(serviceMatchers.filter(([, matcher]) => matcher.test(tracedContent) || matcher.test(relative)).map(([name]) => name))
  const writes = unique([
    ...[...tracedContent.matchAll(/\.(insert|upsert|update|delete)\s*\(/g)].map((match) => `database ${match[1]}`),
    ...[...tracedContent.matchAll(/\b(?:writeFile|appendFile|createWriteStream|rename|unlink|rm)\s*\(/g)].map((match) => `filesystem ${match[0].split('(')[0].trim()}`),
    ...[...tracedContent.matchAll(/\b(send|sendEmail|sendSms|sendMessage|emails\.send)\s*\(/gi)].map(() => 'external message send'),
  ])
  const family = classifyFamily(relative)
  const recommendation = recommendationFor(relative, family)
  const lastUse = lastKnownUse(relative)

  let status = 'library/support code; runtime caller requires tracing'
  const trigger = []
  if (route) {
    trigger.push(`${methods.join('/') || 'HTTP'} ${route}`)
    status = vercelSchedules.has(route) ? 'scheduled in vercel.json' : 'HTTP-callable; no repository schedule found'
  }
  if (packageNames.length) {
    trigger.push(...packageNames.map((name) => `manual package script: ${name}`))
    if (!route) status = 'manual/package-script entry point; external scheduling unconfirmed'
  }
  if (/webhooks?/.test(relative)) status = 'externally callable webhook; provider configuration unconfirmed'
  if (/^lib\/inngest/.test(relative)) status = 'registered Inngest workflow code; cloud registration unconfirmed'
  if (/^app\/api\/inngest/.test(relative)) status = 'Inngest serving endpoint'
  if (vercelSchedules.has(route)) trigger.push(`Vercel Cron: ${vercelSchedules.get(route)}`)
  if (!trigger.length) trigger.push('Imported caller, shell scheduler, or manual invocation; trace required')

  const duplicates = family === 'supporting operations'
    ? []
    : [`Review against other ${family} records for consolidation.`]

  return {
    name: humanize(relative),
    path: relative,
    purpose: `${humanize(relative)} operation in the ${family} family; confirm exact owner and intended outcome before migration.`,
    trigger,
    input: unique([
      ...env.map((name) => `environment: ${name}`),
      ...localImports.map((value) => `module: ${value}`),
    ]),
    output: writes.length ? writes : ['Return value, status response, or downstream module effect; inspect before migration.'],
    databaseDependencies: tables,
    apiDependencies: urls,
    externalService: services,
    dependencyFiles,
    currentStatus: status,
    lastKnownUse: lastUse,
    businessValue: businessValueFor(family),
    riskIfRemoved: removalRisk(relative, recommendation),
    duplicates,
    recommendation,
    family,
  }
})

const summary = {
  generatedAt: new Date().toISOString(),
  repositoryRoot: root,
  counts: {
    total: records.length,
    byRecommendation: Object.fromEntries(
      ['KEEP', 'MODERNIZE', 'MERGE', 'REPLACE', 'ARCHIVE', 'REMOVE'].map((key) => [
        key,
        records.filter((record) => record.recommendation === key).length,
      ]),
    ),
    byFamily: Object.fromEntries(
      unique(records.map((record) => record.family)).map((family) => [
        family,
        records.filter((record) => record.family === family).length,
      ]),
    ),
  },
  schedules: {
    vercel: vercel.crons || [],
    packageScriptCount: Object.keys(packageScripts).length,
  },
  records,
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
