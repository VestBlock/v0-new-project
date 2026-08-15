import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error('POSTGRES_URL is required for the Gate 3A database regression test.')
}
const parsedDatabaseUrl = new URL(databaseUrl)

const candidates = [
  process.env.PSQL_BIN,
  '/opt/homebrew/opt/libpq/bin/psql',
  'psql',
].filter(Boolean)

const psql = candidates.find((candidate) =>
  candidate === 'psql' ? true : existsSync(candidate)
)
if (!psql) throw new Error('psql was not found. Set PSQL_BIN to its absolute path.')

const postgresEnv = {
  ...process.env,
  PGHOST: parsedDatabaseUrl.hostname,
  PGPORT: parsedDatabaseUrl.port || '5432',
  PGUSER: decodeURIComponent(parsedDatabaseUrl.username),
  PGPASSWORD: decodeURIComponent(parsedDatabaseUrl.password),
  PGDATABASE: decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, '')),
  PGSSLMODE: parsedDatabaseUrl.searchParams.get('sslmode') || 'require',
  PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '10',
}
const gate3cProbe = spawnSync(
  psql,
  [
    '-X',
    '--no-password',
    '-A',
    '-t',
    '-c',
    "SELECT (to_regclass('public.operating_strategy_runtime_controls') IS NOT NULL)::text",
  ],
  {
    cwd: process.cwd(),
    env: postgresEnv,
    encoding: 'utf8',
    timeout: 30_000,
  }
)
if (gate3cProbe.error) throw gate3cProbe.error
if (gate3cProbe.status !== 0) {
  if (gate3cProbe.stderr) process.stderr.write(gate3cProbe.stderr)
  throw new Error('Could not determine the installed strategy-registry database generation.')
}
const gate3cInstalled = gate3cProbe.stdout.trim() === 'true'
const sqlPath = resolve(
  process.cwd(),
  gate3cInstalled
    ? 'scripts/test-gate3c-governed-learning-database.sql'
    : 'scripts/test-strategy-registry-database.sql'
)
if (gate3cInstalled) {
  console.log('Gate 3C is installed; running the superseding governed-learning registry regression.')
}
const result = spawnSync(
  psql,
  ['-X', '--no-password', '-v', 'ON_ERROR_STOP=1', '-f', sqlPath],
  {
    cwd: process.cwd(),
    env: postgresEnv,
    encoding: 'utf8',
    timeout: 120_000,
  }
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.error) throw result.error
if (result.signal) throw new Error(`Gate 3A database test stopped by ${result.signal}.`)
if (result.status !== 0) {
  throw new Error(`Gate 3A database test failed with exit code ${result.status}.`)
}
