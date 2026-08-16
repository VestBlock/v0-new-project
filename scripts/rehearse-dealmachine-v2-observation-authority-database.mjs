import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.POSTGRES_URL
if (!databaseUrl) {
  throw new Error(
    'POSTGRES_URL is required for the local DealMachine v2 rollback-only rehearsal.'
  )
}

const parsedDatabaseUrl = new URL(databaseUrl)
if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
  throw new Error('POSTGRES_URL must use the postgres or postgresql protocol.')
}
const databaseHost = parsedDatabaseUrl.hostname
  .toLowerCase()
  .replace(/^\[|\]$/g, '')
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
  throw new Error(
    `Refusing DealMachine v2 rollback rehearsal against non-local host ${parsedDatabaseUrl.hostname}.`
  )
}

const candidates = [
  process.env.PSQL_BIN,
  '/opt/homebrew/opt/libpq/bin/psql',
  'psql',
].filter(Boolean)
const psql = candidates.find((candidate) =>
  candidate === 'psql' ? true : existsSync(candidate)
)
if (!psql) throw new Error('psql was not found. Set PSQL_BIN to its absolute path.')

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260816022833_dealmachine_v2_observation_authority.sql'
)
const regressionPath = resolve(
  process.cwd(),
  'scripts/test-dealmachine-v2-observation-authority-database.sql'
)
const migration = readFileSync(migrationPath, 'utf8')
const regression = readFileSync(regressionPath, 'utf8')

const beginMarker = '\nBEGIN;\n'
const rollbackMarker = '\nROLLBACK;\n'
const beginIndex = regression.indexOf(beginMarker)
const rollbackIndex = regression.indexOf(rollbackMarker)
if (beginIndex < 0 || rollbackIndex < 0 || rollbackIndex <= beginIndex) {
  throw new Error(
    'The DealMachine v2 regression suite is missing its transaction boundaries.'
  )
}
const transactionalRegression = regression.slice(
  beginIndex + beginMarker.length,
  rollbackIndex
)

const postRollbackProof = `
DO $dealmachine_v2_rehearsal_cleanup$
BEGIN
  IF to_regclass('public.dealmachine_v2_runtime_controls') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_credit_reservations') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_requests') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_request_evidence') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_credit_settlements') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_observations') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_observation_payloads') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_observation_evidence') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_observation_entity_links') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_source_attributions') IS NOT NULL
    OR to_regclass('public.dealmachine_v2_operator_reviews') IS NOT NULL
    OR to_regprocedure('private.dealmachine_v2_canonical_jsonb(jsonb)') IS NOT NULL
    OR to_regprocedure(
      'public.begin_dealmachine_v2_request(text,text,text,text,text,text,integer,text,timestamptz)'
    ) IS NOT NULL THEN
    RAISE EXCEPTION 'DealMachine v2 rollback-only rehearsal left schema objects behind.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = 'd2000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'DealMachine v2 rollback-only rehearsal left its reviewer fixture behind.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_versions version
    JOIN public.operating_strategies strategy
      ON strategy.id = version.operating_strategy_id
    WHERE strategy.strategy_key IN (
      'property_opportunity_discovery',
      'seller_options_intake'
    )
      AND version.version = 1
      AND version.status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'DealMachine v2 rollback-only rehearsal left a strategy active.';
  END IF;
END
$dealmachine_v2_rehearsal_cleanup$;
`

const rehearsal = `BEGIN;\n${migration}\n${transactionalRegression}\nROLLBACK;\n${postRollbackProof}`
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
      PGSSLMODE: parsedDatabaseUrl.searchParams.get('sslmode') || 'disable',
      PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '10',
      PGAPPNAME: 'vestblock-dealmachine-v2-rollback-rehearsal',
    },
    input: rehearsal,
    encoding: 'utf8',
    timeout: 240_000,
  }
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) throw result.error
if (result.signal) {
  throw new Error(`DealMachine v2 rehearsal stopped by ${result.signal}.`)
}
if (result.status !== 0) {
  throw new Error(
    `DealMachine v2 rollback rehearsal failed with exit code ${result.status}.`
  )
}

console.log(
  'DealMachine v2 migration and database authority suite passed in a local rollback-only transaction.'
)
