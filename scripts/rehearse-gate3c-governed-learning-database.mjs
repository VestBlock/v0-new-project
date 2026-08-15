import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error('POSTGRES_URL is required for the Gate 3C rollback-only rehearsal.')
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

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260815212701_gate3c_governed_learning.sql'),
  'utf8'
)
const regression = readFileSync(
  resolve(process.cwd(), 'scripts/test-gate3c-governed-learning-database.sql'),
  'utf8'
)
const rollbackMarker = '\nROLLBACK;\n'
const rollbackIndex = regression.indexOf(rollbackMarker)
if (rollbackIndex < 0) {
  throw new Error('The Gate 3C regression suite is missing its rollback boundary.')
}
const transactionalRegression = regression
  .slice(0, rollbackIndex + rollbackMarker.length)
  .replace(/^\\set[^\n]*\n/m, '')
  .replace(/^BEGIN;\n/m, '')

const postRollbackProof = `
DO $gate3c_rehearsal_cleanup$
BEGIN
  IF to_regclass('public.operating_strategy_activities') IS NOT NULL
    OR to_regclass('public.operating_strategy_outcomes') IS NOT NULL
    OR to_regclass('public.operating_strategy_runtime_controls') IS NOT NULL THEN
    RAISE EXCEPTION 'Gate 3C rollback-only rehearsal left schema objects behind.';
  END IF;
  IF (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17
    OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_versions
      WHERE status <> 'draft'
         OR external_send_cap <> 0
         OR approved_at IS NOT NULL
         OR activated_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Gate 3C rollback-only rehearsal changed the 17 production drafts.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3C rollback-only rehearsal enabled n8n.';
  END IF;
END
$gate3c_rehearsal_cleanup$;
`
const rehearsal = `BEGIN;\n${migration}\n${transactionalRegression}\n${postRollbackProof}`

const result = spawnSync(
  psql,
  ['-X', '--no-password', '-v', 'ON_ERROR_STOP=1'],
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
      PGAPPNAME: 'vestblock-gate3c-rollback-rehearsal',
    },
    input: rehearsal,
    encoding: 'utf8',
    timeout: 240_000,
  }
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) throw result.error
if (result.signal) throw new Error(`Gate 3C rehearsal stopped by ${result.signal}.`)
if (result.status !== 0) {
  throw new Error(`Gate 3C rehearsal failed with exit code ${result.status}.`)
}

console.log('Gate 3C migration and database suite passed in a rollback-only transaction.')
