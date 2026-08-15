import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error('POSTGRES_URL is required for the Gate 3C database regression test.')
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

const sqlPath = resolve(
  process.cwd(),
  'scripts/test-gate3c-governed-learning-database.sql'
)
const result = spawnSync(
  psql,
  ['-X', '--no-password', '-v', 'ON_ERROR_STOP=1', '-f', sqlPath],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PGHOST: parsedDatabaseUrl.hostname,
      PGPORT: parsedDatabaseUrl.port || '5432',
      PGUSER: decodeURIComponent(parsedDatabaseUrl.username),
      PGPASSWORD: decodeURIComponent(parsedDatabaseUrl.password),
      PGDATABASE: decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, '')),
      PGSSLMODE: parsedDatabaseUrl.searchParams.get('sslmode') || 'require',
      PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '10',
      PGAPPNAME: 'vestblock-gate3c-rollback-regression',
    },
    encoding: 'utf8',
    timeout: 180_000,
  }
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.error) throw result.error
if (result.signal) throw new Error(`Gate 3C database test stopped by ${result.signal}.`)
if (result.status !== 0) {
  throw new Error(`Gate 3C database test failed with exit code ${result.status}.`)
}
