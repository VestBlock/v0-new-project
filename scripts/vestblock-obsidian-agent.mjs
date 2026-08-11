import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REPO = process.cwd()
const VAULT_NAME = 'VestBlock Strategy Vault'
const VAULT_PATH = path.join(os.homedir(), 'Documents', VAULT_NAME)
const OBSIDIAN = '/opt/homebrew/bin/obsidian'
const ARGS = process.argv.slice(2)
if (ARGS[0] === '--') ARGS.shift()
const FORBIDDEN_NOTE_CONTENT = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/,
  /\b(api[_ -]?key|auth[_ -]?token|private[_ -]?key|password|credential|webhook[_ -]?secret)\b/i,
]

function option(name, fallback = '') {
  const index = ARGS.indexOf(name)
  return index >= 0 ? String(ARGS[index + 1] || '') : fallback
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: options.cwd || REPO,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error((result.stderr || result.stdout || `${binary} failed`).trim())
  }
  return { status: result.status, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() }
}

function ensurePrimaryHost() {
  run(process.execPath, [path.join(REPO, 'scripts', 'require-primary-machine.mjs')])
}

function ensureCli() {
  if (!fs.existsSync(OBSIDIAN)) throw new Error(`Obsidian CLI is missing at ${OBSIDIAN}.`)
  let check = run(OBSIDIAN, ['version'], { allowFailure: true })
  if (check.status === 0) return check.stdout
  run('/usr/bin/open', ['-a', 'Obsidian'])
  for (let attempt = 0; attempt < 20; attempt += 1) {
    sleep(500)
    check = run(OBSIDIAN, ['version'], { allowFailure: true })
    if (check.status === 0) return check.stdout
  }
  throw new Error(check.stderr || check.stdout || 'Obsidian started, but its CLI did not become ready.')
}

function obsidian(args) {
  return run(OBSIDIAN, [`vault=${VAULT_NAME}`, ...args]).stdout
}

function safeVaultPath(input, extensions = ['.md', '.base', '.canvas']) {
  const relative = String(input || '').trim().replaceAll('\\', '/')
  if (!relative || path.isAbsolute(relative) || relative.startsWith('.') || relative.includes('../')) {
    throw new Error('Use a non-hidden path inside the VestBlock vault.')
  }
  const extension = path.extname(relative).toLowerCase()
  if (!extensions.includes(extension)) throw new Error(`Unsupported vault file type: ${extension || 'none'}`)
  const resolved = path.resolve(VAULT_PATH, relative)
  if (!resolved.startsWith(`${path.resolve(VAULT_PATH)}${path.sep}`)) throw new Error('Vault path escaped the allowed root.')
  return { relative, resolved }
}

function safeNoteText(input, label, limit) {
  const value = String(input || '').trim()
  if (!value) throw new Error(`${label} is required.`)
  if (value.length > limit) throw new Error(`${label} exceeds ${limit} characters.`)
  if (FORBIDDEN_NOTE_CONTENT.some((pattern) => pattern.test(value))) {
    throw new Error(`${label} appears to contain PII or a credential. Store that outside Obsidian.`)
  }
  return value
}

function audit(action, target) {
  const activityPath = path.join(VAULT_PATH, 'Notes', 'Agent Activity.md')
  if (!fs.existsSync(activityPath)) {
    obsidian(['create', 'path=Notes/Agent Activity.md', 'content=# Agent Activity\n\nGuarded writes performed through `obsidian:agent`.'])
  }
  obsidian(['append', 'path=Notes/Agent Activity.md', `content=- ${new Date().toISOString()} — ${action}: ${target}`])
}

function selfTest() {
  const allowed = safeVaultPath('Notes/Founder Notes.md')
  if (!allowed.resolved.startsWith(VAULT_PATH)) throw new Error('Allowed path validation failed.')
  for (const blocked of ['../outside.md', '.obsidian/app.json', '/tmp/note.md', 'Notes/file.txt']) {
    let rejected = false
    try { safeVaultPath(blocked) } catch { rejected = true }
    if (!rejected) throw new Error(`Unsafe path was accepted: ${blocked}`)
  }
  let secretRejected = false
  try { safeNoteText('API key: dangerous', 'Text', 100) } catch { secretRejected = true }
  if (!secretRejected) throw new Error('Credential-like note content was accepted.')
  console.log('VestBlock Obsidian agent path, file-type, and sensitive-content guards passed.')
}

function main() {
  const command = ARGS[0] || 'status'
  if (command === 'self-test') return selfTest()
  ensurePrimaryHost()
  const version = ensureCli()

  if (command === 'status') {
    const result = {
      host: os.hostname(), version, vault: VAULT_NAME,
      path: obsidian(['vault', 'info=path']),
      files: Number(obsidian(['files', 'total']) || 0),
      bases: obsidian(['bases']).split('\n').filter(Boolean),
      errors: obsidian(['dev:errors']),
      authority: 'local-vault-only',
    }
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (command === 'refresh') {
    const result = run(process.execPath, [path.join(REPO, 'scripts', 'export-obsidian-strategy-vault.mjs')])
    audit('refresh', 'derived strategy vault')
    console.log(result.stdout)
    return
  }

  if (command === 'read') {
    const target = safeVaultPath(option('--path'))
    console.log(obsidian(['read', `path=${target.relative}`]))
    return
  }

  if (command === 'search') {
    const query = safeNoteText(option('--query'), 'Search query', 240)
    const limit = Math.max(1, Math.min(50, Number(option('--limit', '20')) || 20))
    console.log(obsidian(['search', `query=${query}`, `limit=${limit}`]))
    return
  }

  if (command === 'open') {
    const target = safeVaultPath(option('--path'))
    obsidian(['open', `path=${target.relative}`])
    console.log(`Opened ${target.relative}`)
    return
  }

  if (command === 'append-founder') {
    const text = safeNoteText(option('--text'), 'Founder note', 2000)
    const target = 'Notes/Founder Notes.md'
    obsidian(['append', `path=${target}`, `content=\n- ${new Date().toISOString()} — ${text}`])
    audit('append-founder', target)
    console.log(obsidian(['read', `path=${target}`]))
    return
  }

  if (command === 'create-decision') {
    const title = safeNoteText(option('--title'), 'Decision title', 120)
    const content = safeNoteText(option('--content'), 'Decision content', 8000)
    const relative = `Notes/Decisions/${new Date().toISOString().slice(0, 10)}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)}.md`
    const target = safeVaultPath(relative)
    if (fs.existsSync(target.resolved)) throw new Error(`Decision already exists: ${target.relative}`)
    const body = `---\ntitle: ${JSON.stringify(title)}\ntype: "decision"\nstatus: "open"\ncreated: ${JSON.stringify(new Date().toISOString())}\ntags:\n  - "vestblock"\n  - "decision"\n---\n# ${title}\n\n${content}\n`
    obsidian(['create', `path=${target.relative}`, `content=${body}`])
    audit('create-decision', target.relative)
    console.log(obsidian(['read', `path=${target.relative}`]))
    return
  }

  throw new Error('Allowed commands: status, refresh, read, search, open, append-founder, create-decision, self-test.')
}

try { main() } catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
