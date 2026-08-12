import { spawnSync } from 'node:child_process'

const connection = String(
  process.env.POSTGRES_URL || process.env.SUPABASE_POOLER_URL || '',
).trim()

if (!connection) {
  throw new Error('POSTGRES_URL or SUPABASE_POOLER_URL is required.')
}

const databaseUrl = new URL(connection)

// Supabase migration operations need the session pooler. The transaction
// pooler can reuse prepared statement names during CLI migration commands.
databaseUrl.port = '5432'

const passthrough = process.argv.slice(2)
const result = spawnSync(
  'npx',
  ['--yes', 'supabase@latest', 'db', 'push', '--db-url', databaseUrl.toString(), ...passthrough],
  { stdio: 'inherit' },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
