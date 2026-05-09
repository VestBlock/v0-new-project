# VestBlock Production Readiness

## Current status

VestBlock is closer to a controlled beta than a true public production launch.

Recent hardening already completed:

- DealVault end-to-end flow passes in local verification against Base Sepolia.
- DealVault admin/blockchain screens now use the shared admin pattern and admin guard.
- DealVault blockchain writes now use a shared simulate-and-confirm flow.
- DealVault transaction logs now record `confirmed_at` for successful writes.
- DealVault health now reports readiness, deployment artifacts, smoke-test evidence, and recent failure counts.
- Lead admin alerts no longer fire for low-context scraped/imported records that would create empty emails.
- Lead admin dashboards now show the top email-autopilot blocker reasons.

## Platform-wide blockers before production

### Security and secrets

- Rotate the exposed DealVault test/admin wallet and issue fresh server secrets.
- Verify all production `.env` values are set only in secure deployment environments.
- Review service-role key usage and make sure client bundles never expose sensitive credentials.
- Perform a final auth/role review across admin-only routes and background jobs.

### Reliability and monitoring

- Finish repo-wide lint cleanup until the main CI lint gate passes cleanly.
- Verify Sentry coverage and alerts for core API failures, outreach failures, and DealVault blockchain failures.
- Add a small operator playbook for incident response, rollback, and degraded-mode behavior.
- Add automated health checks for the highest-value APIs and scheduled jobs.

### QA and release safety

- Run full regression QA on homepage, auth, dashboard, admin, lead intake, outreach, and DealVault.
- Keep the existing DealVault verifier green while adding unhappy-path checks.
- Validate production-like environment variables in staging before enabling customer-facing flags.
- Confirm backups, migrations, and rollback steps for Supabase changes.

## Lead and outreach readiness

- Review every lead ingestion source for minimum required fields and bad-record suppression.
- Confirm daily digests, admin alerts, and send queues each have the right thresholds and no duplicate noise.
- Expose more operator-facing reasons for blocked, paused, or suppressed outreach in the admin UI.
- Recheck deliverability safeguards: suppression handling, bounce tracking, and domain/email mismatch rules.

## DealVault-specific blockers before production

### Blockchain lane

- Run a final contract review and external security audit before any mainnet or customer-critical rollout.
- Add stronger transaction reconciliation for partial failures and retry-safe recovery paths.
- Expand admin diagnostics to surface stale/unconfirmed writes, failed writes, and recent chain activity trends.
- Verify chain-specific deployment/runbooks for the chosen production network.

### Product gating

- Keep DealVault behind the feature flag until staging QA is complete.
- Reconfirm all API routes degrade cleanly when blockchain is disabled or misconfigured.
- Perform a final certificate, proof, payout, and milestone QA pass with production-like data.

### Operations

- Apply the final Supabase schema/policy set to the intended production project.
- Verify RLS behavior with real non-admin and admin accounts.
- Establish support/debug steps for blockchain write failures and proof verification disputes.

## Suggested order

1. Finish repo-wide lint and CI cleanup.
2. Rotate secrets and wallet material.
3. Complete staging regression QA for core VestBlock flows.
4. Complete DealVault production-hardening around retries, reconciliation, and monitoring.
5. Run a release checklist with feature flags still off.
6. Enable DealVault for a controlled internal beta first.
