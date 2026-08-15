# Gate 3C — Governed runtime and learning

Date: 2026-08-15
Authority: VestBlock LLC founder-approved Gate 3C
Repository authority: Mac Pro, `codex/operation-rebrand-final`

## Gate boundary

Gate 3C connects the canonical operating-strategy registry to a fail-closed runtime, immutable evidence, outcome attribution, learning windows, and founder-reviewed decisions. The database schema is applied in compatibility mode so it can safely precede the matching application release.

This gate does not deploy the application, activate a strategy, grant send capacity, start outreach, change the 17 Gate 3B drafts, enable n8n live mode, restore DealMachine exports, or authorize an unreviewed automation. Legacy records remain historical and are not fabricated into governed evidence.

## Result

- A strict runtime resolver requires one current approved crosswalk and one active canonical operating-strategy version before governed work can execute.
- Every governed activity snapshots the exact operating version, contract fingerprint, destination, CTA, source, subject, consent, suppression, message version, and writer release.
- Dispatch capacity is reserved atomically before a durable outbound intent and before any provider call. Exact adapters are selected in advance and governed sends disable fallback.
- Canonical activity, outcome, attribution, learning, review, reservation, and quarantine records are append-only and service-only.
- Resend and Outlook callbacks resolve an exact provider message, enrollment, subject, and version. Missing or ambiguous governed attribution is rejected or quarantined instead of mass-updating a lead.
- n8n receives the same immutable strategy/version evidence. `approved_live` remains hard-blocked, and existing no-send tests cannot become outreach authority.
- One participant may hold independent evidence under several strategies without reusing the legacy global membership row as canonical truth.
- The lifecycle monitor is reduced to internal task/proposal behavior; it does not send customer reminders under the new controller.
- The Obsidian agent now reads a PII-free, service-role registry projection for all 17 operating strategies and 10 approved portfolios.

## Canonical evidence chain

The governed record chain is:

`source or intake → canonical activity → membership or handoff → dispatch reservation → outbound intent → provider result or reply → domain event → verified outcome → attributed learning window → founder review manifest`

Delivery, acceptance, opens, clicks, and replies are evidence but cannot satisfy a business conversion or verified value by themselves. A verified conversion or value requires substantive provenance and an exact governed domain event for the same version and subject.

## Runtime compatibility boundary

Production control remains:

- `enforcement_mode = compatibility`
- `schema_status = staged_pending_app_deployment`
- `app_release_status = not_deployed`
- `required_writer_release = NULL`
- zero reviewer authorities

Legacy writers therefore remain compatible until a separately approved application release. The later cutover to `governed_required` must name the required writer release, record the founder-authorized cutover, and prove that no legacy-only writes remain. Existing legacy rows stay unattributed and excluded from governed learning.

## Learning integrity

- A learning window starts at the version activation time, uses the contract's exact duration, and must be consecutive with the prior window.
- Exposure, primary conversion, and guardrail units count once per canonical subject/outcome key even if a producer changes an idempotency key.
- New or backdated evidence cannot alter a finalized window.
- Only learning-eligible, exact-version evidence inside the activation-bound window contributes to a decision.
- A proposal requires the latest two complete eligible windows, minimum exposure, minimum primary conversions, and no blocking guardrail failure.
- A review manifest pins the exact contract and evidence fingerprints. Any drift invalidates approval.
- Service-role automation may prepare evidence and a manifest but cannot impersonate the founder, approve, or activate a version.
- A retired version may receive a late conversion or verified value only through a genuinely post-retirement child domain event on its immutable active-era lineage. It cannot start new work, rewrite a destination, or change a finalized learning window.

## Production migrations

- `20260815212701_gate3c_governed_learning`
  - reviewed SQL SHA-256: `93271fa2754e4025d9a6ffca468a4502dd6c5d44e0360753a2c0457e56164075`
- `20260815212931_gate3c_index_reconciliation`
  - reviewed SQL SHA-256: `798f5aaa72cfa60c9d622e38d231111b9cfdce8f288a80e8402a6e2d41fb96c5`

The second migration removes only two Gate 3C partial indexes that exactly duplicated the canonical Gate 3A operating-version indexes.

## Verification evidence

- The exact main migration and 164-statement database suite passed together in a rollback-only transaction against PostgreSQL on the Mac Pro.
- The same database regression passed again against the applied production schema and rolled back all fixtures.
- Independent SQL/security review passed the exact frozen migration, regression, and runner hashes.
- Independent TypeScript-to-SQL RPC parity review passed the resolver, reservation, activity, outcome, quarantine, and registry-projection contracts.
- Runtime, secondary-outbound, opportunity-match retry, and consumer-cutover guard suites passed.
- Targeted ESLint, full TypeScript validation, `git diff --check`, and the Next.js production build passed. The build generated 261 static pages.
- Production contains 17 operating versions, all 17 still `draft`, zero active versions, zero nonzero send caps, zero reviewer authorities, zero governed activities, outcomes, reservations, learning windows, review manifests, or quarantine rows, and zero n8n live-send controls.
- The Supabase duplicate-index warnings introduced by the first migration were removed by the reviewed reconciliation migration.
- Remaining Gate 3C advisor notices for service-only RLS tables without browser policies and newly created unused indexes are expected informational notices.
- Supabase also reports generic security warnings for the two authenticated `SECURITY DEFINER` founder-review RPCs. They are intentional entry points protected by exact `auth.uid()` matching, an explicit reviewer-authority allowlist, immutable manifest fingerprints, fixed empty `search_path`, and revoked service-role decision authority. Reference: [Supabase database linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Deferred integrations

- No canonical version is active, so all governed execution remains fail-closed.
- DealMachine exports remain retired. A replacement native API key and its contact-data contract belong to a later source-integration gate.
- n8n remains a signed orchestration dependency, not CRM truth, and live mode stays disabled.
- Broader capital-partner, confidential business-acquisition, partner-referral, public-sector participant, bilateral response, and verified close/value authorities remain blocked where Gate 3B recorded them.
- A true two-session dispatch-cap concurrency test is a nonblocking defense-in-depth follow-up; independent review found the shared version-row lock design sound.

## Gate 3D handoff

Gate 3D may deploy the reviewed application changes in compatibility mode, run live read-only and no-send smoke tests, verify the Obsidian projection, and observe that governed-capable writers create no activity while all strategies remain drafts. A later explicit gate must approve any contract activation, reviewer authority, nonzero send cap, `governed_required` cutover, n8n live mode, or external outreach batch.
