# Production Launch Verification

Use this skill when checking whether VestBlock is ready to go live after deploys, domain moves, env changes, Supabase restores, or payment/email updates.

## Core Checks

- Confirm the active deployment URL and custom domains.
- Confirm `vestblock.io` redirects consistently to the chosen primary domain.
- Confirm `/`, `/login`, `/register`, `/credit-upload`, `/dashboard`, `/funding`, and `/admin-panel` load.
- Confirm `/admin-panel` and diagnostic/setup pages are protected.
- Confirm unauthenticated admin APIs return 401 or 403, not 500.
- Confirm Supabase env vars point to the intended project.
- Confirm Resend, PayPal, and OpenAI env vars exist before testing those flows.

## Smoke Tests

- Public pages return 200.
- `vestblock.io` returns 307/308 to `www.vestblock.io` if www is primary.
- Login/register render without hydration crashes.
- `/api/admin/dashboard` returns `Admin access required` for anonymous users.
- `/setup-database` redirects anonymous users to login.
- Upload page renders and asks unauthenticated users to sign in or upgrade as intended.

## Domain Rules

- Upgraded project: `v0-vest-block-rebuild`.
- Old project: `vest-block-pro`.
- If Vercel still lists domains under `vest-block-pro`, the domain move is not complete even if DNS appears to respond.
- Do not remove domains from the old project unless immediately adding them to the upgraded project.

## Final Report

Report:

- Deployment URL.
- Primary domain.
- Domain project assignment.
- Env verification status.
- Supabase project ref.
- Smoke-test results.
- Remaining manual blockers.
