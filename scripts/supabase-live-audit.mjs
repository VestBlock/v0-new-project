import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOTS = ['app', 'lib', 'scripts', 'components']
const SOURCE_EXTENSION = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'dist', 'coverage'])

function findPsql() {
  const candidates = [
    process.env.PSQL_BIN,
    '/opt/homebrew/opt/libpq/bin/psql',
    '/usr/local/bin/psql',
    'psql',
  ].filter(Boolean)
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
    if (probe.status === 0) return candidate
  }
  throw new Error('psql is required for the live Supabase audit.')
}

function query(psql, connection, sql) {
  const result = spawnSync(psql, [connection, '-v', 'ON_ERROR_STOP=1', '-Atc', sql], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Supabase SQL query failed.')
  }
  return result.stdout.trim().split(/\n/).map((value) => value.trim()).filter(Boolean)
}

function collectFiles() {
  const files = []
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (SOURCE_EXTENSION.test(entry.name)) files.push(target)
    }
  }
  ROOTS.forEach(walk)
  return files
}

function collectReferences(files, pattern) {
  const references = new Map()
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      const name = match[1]
      if (!references.has(name)) references.set(name, new Set())
      references.get(name).add(file)
    }
  }
  return references
}

function projectRefFromUrl(value) {
  return String(value || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || null
}

function projectRefFromConnection(value) {
  try {
    const url = new URL(value)
    return url.username.startsWith('postgres.') ? url.username.slice('postgres.'.length) : null
  } catch {
    return null
  }
}

const connection = String(process.env.POSTGRES_URL || process.env.SUPABASE_POOLER_URL || '').trim()
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
if (!connection) throw new Error('POSTGRES_URL or SUPABASE_POOLER_URL is required.')
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required.')

const psql = findPsql()
const files = collectFiles()
const tableReferences = collectReferences(files, /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g)
const rpcReferences = collectReferences(files, /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)
const liveTables = new Set(query(psql, connection, "select tablename from pg_tables where schemaname='public' order by tablename"))
const liveFunctions = new Set(query(psql, connection, "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by p.proname"))
const rlsDisabled = query(psql, connection, `
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
  order by c.relname
`)
const anonymousExposureWithoutRls = query(psql, connection, `
  select distinct grants.table_name
  from information_schema.role_table_grants grants
  join pg_class c on c.relname = grants.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = grants.table_schema
  where grants.table_schema = 'public'
    and grants.grantee = 'anon'
    and not c.relrowsecurity
  order by grants.table_name
`)
const publicSecurityDefinerFunctions = query(psql, connection, `
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
  order by p.proname
`)
const anonymousExecutableFunctions = query(psql, connection, `
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
  order by p.proname
`)
const userMetadataAuthorizationPolicies = query(psql, connection, `
  select tablename || ':' || policyname
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') ilike '%user_metadata%'
      or coalesce(with_check, '') ilike '%user_metadata%'
    )
  order by tablename, policyname
`)
const authUserTriggers = query(psql, connection, `
  select trigger.tgname || ':' || function_schema.nspname || '.' || function.proname
  from pg_trigger trigger
  join pg_class relation on relation.oid = trigger.tgrelid
  join pg_namespace relation_schema on relation_schema.oid = relation.relnamespace
  join pg_proc function on function.oid = trigger.tgfoid
  join pg_namespace function_schema on function_schema.oid = function.pronamespace
  where relation_schema.nspname = 'auth'
    and relation.relname = 'users'
    and not trigger.tgisinternal
  order by trigger.tgname
`)
const authenticatedPrivilegedProfileWrites = query(psql, connection, `
  select columns.table_name || '.' || columns.column_name
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name in ('profiles', 'user_profiles')
    and columns.column_name in (
      'role',
      'is_admin',
      'is_pro',
      'is_subscribed',
      'paypal_order_id',
      'paypal_order_product'
    )
    and (
      has_column_privilege(
        'authenticated',
        format('%I.%I', columns.table_schema, columns.table_name),
        columns.column_name,
        'UPDATE'
      )
      or has_column_privilege(
        'authenticated',
        format('%I.%I', columns.table_schema, columns.table_name),
        columns.column_name,
        'INSERT'
      )
    )
  order by columns.table_name, columns.column_name
`)
const missingUserProfiles = Number(query(psql, connection, `
  select count(*)
  from auth.users users
  left join public.user_profiles profiles
    on profiles.id = users.id or profiles.user_id = users.id
  where profiles.id is null
`)[0] || 0)
const migrationVersions = query(psql, connection, `
  select version
  from supabase_migrations.schema_migrations
  order by version
`)

const missingTables = [...tableReferences.keys()].filter((name) => !liveTables.has(name)).sort()
const missingRpcs = [...rpcReferences.keys()].filter((name) => !liveFunctions.has(name)).sort()
const apiProjectRef = projectRefFromUrl(supabaseUrl)
const databaseProjectRef = projectRefFromConnection(connection)
const projectBindingMatches = Boolean(apiProjectRef && databaseProjectRef && apiProjectRef === databaseProjectRef)
const healthy = missingTables.length === 0
  && missingRpcs.length === 0
  && rlsDisabled.length === 0
  && anonymousExposureWithoutRls.length === 0
  && publicSecurityDefinerFunctions.length === 0
  && anonymousExecutableFunctions.length === 0
  && userMetadataAuthorizationPolicies.length === 0
  && authUserTriggers.length === 1
  && authUserTriggers[0] === 'on_auth_user_created:private.handle_new_user'
  && authenticatedPrivilegedProfileWrites.length === 0
  && missingUserProfiles === 0
  && migrationVersions.length > 0
  && projectBindingMatches

console.log(JSON.stringify({
  healthy,
  project: {
    apiProjectRef,
    databaseProjectRef,
    bindingMatches: projectBindingMatches,
  },
  schema: {
    livePublicTables: liveTables.size,
    referencedTables: tableReferences.size,
    missingTables,
    referencedRpcs: rpcReferences.size,
    missingRpcs,
  },
  security: {
    rlsDisabled,
    anonymousExposureWithoutRls,
    publicSecurityDefinerFunctions,
    anonymousExecutableFunctions,
    userMetadataAuthorizationPolicies,
    authUserTriggers,
    authenticatedPrivilegedProfileWrites,
  },
  integrity: {
    missingUserProfiles,
  },
  migrations: {
    appliedCount: migrationVersions.length,
    latest: migrationVersions.at(-1) || null,
  },
}, null, 2))

if (!healthy) process.exitCode = 1
