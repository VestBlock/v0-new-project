import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error('POSTGRES_URL is required for the Gate 3D.1 rollback-only rehearsal.')
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

const migrationPaths = [
  'supabase/migrations/20260815223944_gate3d1_canary_controls.sql',
  'supabase/migrations/20260815230000_gate3d1_one_shot_dispatch.sql',
  'supabase/migrations/20260815231000_gate3d1_seller_reply_canary_candidate.sql',
]
const migrations = migrationPaths.map((migrationPath) => ({
  name: migrationPath,
  source: readFileSync(resolve(process.cwd(), migrationPath), 'utf8'),
}))
const regression = readFileSync(
  resolve(process.cwd(), 'scripts/test-gate3d1-canary-controls-database.sql'),
  'utf8'
)

for (const [name, source] of [
  ...migrations.map(({ name, source }) => [name, source]),
  ['regression', regression],
]) {
  if (source.includes('session_replication_role')) {
    throw new Error(`Gate 3D.1 ${name} must not bypass database triggers.`)
  }
}

const rollbackMarker = '\nROLLBACK;\n'
const rollbackIndex = regression.indexOf(rollbackMarker)
if (rollbackIndex < 0) {
  throw new Error('The Gate 3D.1 regression suite is missing its rollback boundary.')
}
const transactionalRegression = regression
  .slice(0, rollbackIndex + rollbackMarker.length)
  .replace(/^\\set[^\n]*\n/m, '')
  .replace(/^BEGIN;\n/m, '')

const postRollbackProof = `
DO $gate3d1_rehearsal_cleanup$
BEGIN
  IF to_regclass('public.operating_strategy_outbound_controls') IS NOT NULL
    OR to_regclass('private.gate3d1_canary_dispatch_claims') IS NOT NULL
    OR to_regclass('private.gate3d1_canary_dispatch_events') IS NOT NULL
    OR to_regprocedure(
      'public.set_operating_strategy_outbound_control(uuid,boolean,uuid,text,text)'
    ) IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'operating_strategy_runtime_controls'
        AND column_name = 'outbound_kill_switch'
    ) THEN
    RAISE EXCEPTION 'Gate 3D.1 rollback-only rehearsal left schema objects behind.';
  END IF;
  IF (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17
    OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_versions
      WHERE status <> 'draft'
         OR external_send_cap <> 0
         OR execution_mode IN ('internal_test', 'approved_live')
         OR approved_at IS NOT NULL
         OR activated_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Gate 3D.1 rollback-only rehearsal changed production strategy state.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities) THEN
    RAISE EXCEPTION 'Gate 3D.1 rollback-only rehearsal left reviewer authority behind.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_dispatch_reservations) THEN
    RAISE EXCEPTION 'Gate 3D.1 rollback-only rehearsal left a reservation behind.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 rollback-only rehearsal changed n8n live-send state.';
  END IF;
END
$gate3d1_rehearsal_cleanup$;
`

const migrationSql = migrations.map(({ source }) => source).join('\n')
const rehearsal = `BEGIN;\n${migrationSql}\n${transactionalRegression}\n${postRollbackProof}`

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
      PGAPPNAME: 'vestblock-gate3d1-rollback-rehearsal',
    },
    input: rehearsal,
    encoding: 'utf8',
    timeout: 240_000,
  }
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) throw result.error
if (result.signal) throw new Error(`Gate 3D.1 rehearsal stopped by ${result.signal}.`)
if (result.status !== 0) {
  throw new Error(`Gate 3D.1 rehearsal failed with exit code ${result.status}.`)
}

console.log(
  'Gate 3D.1 migration and real activation/reservation regression passed in a rollback-only transaction.'
)
