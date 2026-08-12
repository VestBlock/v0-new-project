# VestBlock Security Review

Date: 2026-07-20

## Scope

This review covered the Next.js application, admin and diagnostic routes, outbound-email workflows, webhook handlers, AI endpoints, generated-HTML previews, package dependencies, secret exposure, and deployment controls.

## Resolved Findings

### SEC-001: Unsigned duplicate PayPal webhook (critical)

`/api/paypal-webhook` accepted payment-completion payloads without validating a PayPal signature. The duplicate endpoint is permanently retired with HTTP 410. Payment events must use the signed `/api/webhook` handler.

### SEC-002: HTTP SQL execution and setup routes (critical)

Legacy `/api/execute-sql`, `/api/run-db-setup`, and `/api/setup-database` routes exposed privileged database operations behind runtime flags. All three are permanently retired. Database changes now require reviewed migration files and the database deployment workflow.

### SEC-003: Unauthenticated AI resource consumption (high)

Chat and assistant API routes could consume paid model capacity without a valid user session. Middleware now protects the AI endpoints, `/api/chat` verifies the Supabase user directly, and request schemas cap message count and input sizes.

### SEC-004: Untrusted generated HTML execution (high)

AI-generated business-credit and grant content was rendered directly with `dangerouslySetInnerHTML`. Previews now run in sandboxed iframes without script, navigation, form, or same-origin privileges.

### SEC-005: Dependency vulnerabilities (high)

Production dependencies were upgraded or overridden to patched versions. An outdated chat package with an unpatched resource-consumption advisory was replaced with a bounded local streaming hook. `pnpm audit --prod` now reports zero known vulnerabilities.

### SEC-006: False delivery state and unsafe follow-up (high)

Outreach now records provider acceptance separately from delivery, captures verified Resend webhook events, suppresses replied or unsubscribed contacts, uses idempotency keys, and blocks live seller outreach when mailbox reply capture is unavailable.

### SEC-007: Cross-site mutations and admin exposure (high)

Protected state-changing routes reject cross-site requests using `Origin` and `Sec-Fetch-Site`. Admin and diagnostic pages and APIs require authenticated admin access, return no-store/no-index headers, and fail closed.

### SEC-008: Build checks could be bypassed (medium)

Next.js settings that ignored TypeScript and ESLint build failures were removed. Production builds now fail on compile errors.

## Verified Controls

- DealMachine webhooks verify the raw-body signature.
- Resend webhooks verify Svix signatures before recording delivery events.
- PayPal events use the signed webhook handler.
- Security headers and Content Security Policy are configured centrally.
- Site preview requests validate DNS/IP results and redirects to prevent private-network access.
- No tracked environment files, Twilio implementation, or public-prefixed secrets were found.
- TypeScript, production build, targeted operating-system tests, and production dependency audit pass.

## External Readiness Blockers

These are fail-closed operational dependencies, not silently bypassed application errors:

1. Microsoft Graph credentials are not present in the Vercel production environment. Reply capture therefore cannot prove mailbox safety, and live seller sends are intentionally blocked.
2. The Supabase connector is linked to a different inactive project than VestBlock's live project. The live REST database is healthy and the delivery tables exist, but the final constraints in the canonical migration cannot be independently applied or verified until the correct project is connected.
3. DealMachine's direct API currently returns a Cloudflare 403. Fresh exports must continue through its supported export/webhook path until DealMachine enables the API account path.
4. The previously configured PostHog project key returned 401/404 responses. PostHog has since been removed from the application runtime; database-backed revenue reporting continues independently.

## Residual Engineering Debt

ESLint exits successfully with no errors, but legacy React advisory and unused-code warnings remain outside the release-critical paths. They should be reduced incrementally; they do not bypass authentication, delivery evidence, suppression, or production build gates.
