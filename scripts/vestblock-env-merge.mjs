import fs from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const prefix = `--${name}=`
  const found = args.find((value) => value.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}
const source = path.resolve(process.cwd(), arg('source'))
const target = path.resolve(process.cwd(), arg('target', '.env.local'))
const requested = new Set(String(arg('names', '')).split(',').map((value) => value.trim()).filter(Boolean))
const allowed = new Set([
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'OUTLOOK_ACQUISITIONS_MAILBOX',
  'DEALMACHINE_WEBHOOK_SECRET',
  'RESEND_WEBHOOK_SECRET',
  'ATTOM_API_KEY',
])
for (const name of requested) if (!allowed.has(name)) throw new Error(`Environment name is not approved for this merge: ${name}`)
if (!requested.size) throw new Error('At least one approved environment name is required.')

const targetStat = await fs.lstat(target)
if (targetStat.isSymbolicLink()) throw new Error('Refusing to write through a target symlink.')
const sourceText = await fs.readFile(source, 'utf8')
let targetText = await fs.readFile(target, 'utf8')

const assignments = new Map()
for (const line of sourceText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
  if (match && requested.has(match[1])) assignments.set(match[1], line)
}
const missingFromSource = [...requested].filter((name) => !assignments.has(name))
if (missingFromSource.length) throw new Error(`Source is missing requested environment names: ${missingFromSource.join(', ')}`)

const placeholderNames = [...assignments].filter(([, line]) => {
  const value = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
  return value.toLowerCase() === '[sensitive]'
}).map(([name]) => name)
if (placeholderNames.length) {
  console.log(JSON.stringify({ ok: false, placeholderNames, merged: [], skipped: [], secretValuesExposed: false }, null, 2))
  process.exit(2)
}

const merged = []
const skipped = []
for (const name of requested) {
  if (new RegExp(`^${name}=`, 'm').test(targetText)) {
    skipped.push(name)
    continue
  }
  targetText = `${targetText.replace(/\s*$/, '')}\n${assignments.get(name)}\n`
  merged.push(name)
}

const temporary = `${target}.env-merge-${process.pid}`
try {
  await fs.writeFile(temporary, targetText, { mode: 0o600 })
  await fs.rename(temporary, target)
  await fs.chmod(target, 0o600)
} finally {
  await fs.rm(temporary, { force: true })
}

console.log(JSON.stringify({ ok: true, merged, skipped, secretValuesExposed: false }, null, 2))
