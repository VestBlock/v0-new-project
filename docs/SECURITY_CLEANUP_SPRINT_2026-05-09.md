# Security Cleanup Sprint - 2026-05-09

## Summary

This sprint focused on safe production hardening without changing customer-facing product behavior.

Completed:
- Verified production dependencies with the pnpm lockfile.
- Removed a browser-side debug path that asked admins to paste an OpenAI API key.
- Marked the Supabase admin client as server-only.
- Removed public admin email fallback from server-side admin authorization checks.
- Added baseline response security headers.
- Stopped production builds from ignoring TypeScript errors.
- Added no-store cache behavior for protected/internal pages.
- Added production diagnostics gating through `ENABLE_INTERNAL_DIAGNOSTICS`.

## Checks

- `corepack pnpm audit --prod`: no known production dependency vulnerabilities found.
- Full `npm run lint`: still blocked by existing React lint debt in older admin/dashboard components.
- Focused lint for touched code files: passed.
- `npm run typecheck`: passed.
- `npm run check:contracts`: passed, 4 contract tests passing.
- `npm run build`: passed with TypeScript validation enabled.
- GitHub Dependabot alert details could not be fetched locally because the GitHub CLI is not installed in this workspace.

## Remaining Security Cleanup

- Clean the existing full-repo lint debt before enabling ESLint enforcement during `next build`.
- Move or remove legacy debug/test pages after the recovery workflows are no longer needed.
- Keep `CRON_SECRET` configured in production so scheduled endpoints remain fail-closed.
- Confirm Vercel deployment protection/runtime headers after the next production deployment.
