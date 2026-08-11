import fs from 'node:fs/promises'
import path from 'node:path'

const target = path.resolve(process.cwd(), '.env.local')
const allowed = new Set([
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'OUTLOOK_ACQUISITIONS_MAILBOX',
  'DEALMACHINE_WEBHOOK_SECRET',
  'ATTOM_API_KEY',
])
const stat = await fs.lstat(target)
if (stat.isSymbolicLink()) throw new Error('Refusing to write through a symlink.')
const lines = (await fs.readFile(target, 'utf8')).split(/\r?\n/)
const removed = []
const kept = lines.filter((line) => {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
  if (!match || !allowed.has(match[1])) return true
  const value = match[2].trim().replace(/^['"]|['"]$/g, '')
  if (value.toLowerCase() !== '[sensitive]') return true
  removed.push(match[1])
  return false
})
const temporary = `${target}.placeholder-cleanup-${process.pid}`
try {
  await fs.writeFile(temporary, `${kept.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 })
  await fs.rename(temporary, target)
  await fs.chmod(target, 0o600)
} finally {
  await fs.rm(temporary, { force: true })
}
console.log(JSON.stringify({ ok: true, removed, secretValuesExposed: false }, null, 2))
