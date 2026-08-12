# VestBlock Supabase Operations

## Authoritative project

- Production project reference: `iplmxoxncjyxbixdhrst`
- API host: `https://iplmxoxncjyxbixdhrst.supabase.co`
- Transaction pooler cluster: `aws-1-us-east-2.pooler.supabase.com`
- PostgreSQL major version: 17

The API project reference, JWT project claim, and database pooler username must
all match. Run `pnpm audit:supabase` before reporting a database-backed feature
as complete.

## Migration policy

`supabase/migrations` is the only authoritative migration directory going
forward. Files under `db/migrations` are legacy history and must not be applied
wholesale; some early files contain destructive development-time statements.

Use the checked-in CLI configuration and the encrypted local database URL:

```bash
pnpm supabase:push:dry-run
pnpm supabase:push
pnpm audit:supabase
```

The wrapper derives the session-pooler port at runtime. This avoids the
prepared-statement collisions produced by the transaction pooler and does not
print or commit the database credential.

Never pass credentials as literal command arguments in documentation, scripts,
or committed files. Keep `.env.local` mode `0600` and keep production variables
encrypted in Vercel.

## Completion standard

A Supabase-backed feature is complete only after all of these are true:

1. Its migration is present in `supabase/migrations` and recorded in live
   `supabase_migrations.schema_migrations`.
2. Every referenced table and RPC exists in the authoritative project.
3. RLS and explicit grants match the application access path.
4. A service-role persistence test succeeds and is cleaned up.
5. Anonymous access is tested for protected data.
6. `pnpm audit:supabase` and `pnpm typecheck` pass.

The hosted Supabase MCP connector should not be pointed at production data.
Use the direct migration workflow above until a separate development project or
branch is available.
