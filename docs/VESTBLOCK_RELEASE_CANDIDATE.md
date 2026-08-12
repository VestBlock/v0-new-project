# VestBlock Unified Release Candidate

Updated: 2026-08-11
Branch: `codex/vestblock-unified-release-candidate`
Production promotion: not authorized

## Release notes

- Grounds the VB identity in a static responsive brand composition and removes the home hero’s continuous WebGL motion.
- Uses one graphite, ivory, and electric-lime system across the main experience and DealVault demo surfaces.
- Rewrites customer-visible internal language and differentiates Capital, Deals, and Opportunities by inputs, process, outcomes, proof, and limitations.
- Replaces the long Get Started directory with three primary choices and clear account expectations.
- Corrects auth page headings, nested interactive elements, and minimum touch targets.
- Adds mobile width containment to the DealVault live-contract area.
- Rejects personal/secret PostHog keys and reports coarse analytics readiness.
- Wires Sentry for client, server, edge, request, router-transition, and global error capture with default PII disabled.
- Makes buyer/lender sends and Entity SEO publishing fail closed.
- Removes editable profile roles from server and middleware authorization; includes a reviewed-but-unapplied privilege-protection migration.
- Requires operator authorization before a public property analysis can write Command Center memory.
- Protects cost-bearing/account-specific APIs and derives record ownership from the authenticated user.
- Binds PayPal create/capture to authenticated user, product, request, USD amount, provider transaction, and idempotent payment record.
- Adds an exact nine-vertical Strategy Brain with structured evidence, research-required behavior, focus/challenger selection, cost/compliance gates, attribution, and PII-safe Obsidian projection.

## Verification evidence

Verified on the authoritative Mac Pro checkout at commit `d2e651b` with its local environment configuration:

- `pnpm install --frozen-lockfile`
- `pnpm run typecheck`
- changed-file ESLint with zero warnings (run before push)
- `pnpm run test:autopilot-strategy`
- `pnpm run test:payment-order-binding`
- `pnpm run test:obsidian-vault`
- `pnpm run build` (246 static pages generated)
- six Playwright release-candidate checks against the local production server, including desktop/mobile hero, Capital, Deals, Opportunities, Get Started, DealVault, login semantics, and 390-pixel overflow assertions

The final desktop home, mobile home, and mobile DealVault captures were inspected after the tests. This proves the committed build on the Mac Pro; it does not substitute for provider sandbox checks or a hosted preview review.

## Production blockers requiring separate approval

1. Revoke the exposed PostHog `phx_` personal key and configure a project token.
2. Review and apply migration 057 after the duplicate-transaction precheck and admin-app-metadata check.
3. Verify one non-production Sentry event, source-map symbolication, release/environment tags, and alert ownership.
4. Add distributed per-user/per-IP rate and cost limits to the remaining AI/PDF routes.
5. Run PayPal sandbox create/approve/capture/retry tests; do not use a real payment.
6. Verify canonical-host redirect, analytics capture, auth, password reset, inquiry delivery, DealVault overflow, and the top customer paths on the non-production preview.
7. Review the final diff and preview evidence, then explicitly approve production promotion.

## Rollback

No production rollback is needed until this branch is promoted. If a preview or later production promotion fails:

1. Stop promotion and retain the failed deployment logs.
2. Point the Vercel production alias back to the last known-good deployment; do not rewrite Git history.
3. Revert the release commit in a new branch/PR if source rollback is required.
4. If migration 057 was applied, keep the privilege protection in place unless a reviewed replacement is ready. The payment unique index can be dropped separately only after proving why it is unsafe; never loosen profile privilege controls merely to restore a UI write.
5. Restore provider variables through Vercel environment history or the credential owner. Never paste secret values into tickets, logs, or Obsidian.

## Production data safety

This release-candidate operation does not deploy, rotate credentials, send outreach, publish content, create ad spend, process a real payment, execute blockchain writes, or apply database migrations. All live-state checks are read-only unless a separate approval is recorded.
