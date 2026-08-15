# Gate 3A — Canonical strategy contracts and fail-closed registry

Date: 2026-08-15
Authority: VestBlock LLC founder approval
Execution host: primary Mac Pro (`MacBookPro.lan`)
Repository baseline: `87e4c10a` on `codex/operation-rebrand-final`

## Gate result

Gate 3A is complete. VestBlock now has one governed, versioned strategy registry that preserves the approved portfolio direction while giving every executable operating strategy a stable identity, parent, destination posture, CRM lifecycle, owner contract, outcome contract, provenance, and zero-send guardrail.

This gate did not deploy the application, activate an operating-strategy version, enable n8n live sending, begin outreach, change a schedule, or change a customer-facing design.

## Canonical registry delivered

- 12 portfolio IDs are registered.
- The 10 existing portfolio IDs remain approved and active at their prior portfolio version.
- `public_sector_opportunities` and `customer_lifecycle_growth` are registered as proposed portfolios with draft-only contracts.
- 17 stable operating strategies each have exactly one immutable parent portfolio.
- All 17 operating-strategy version-1 records remain drafts.
- All 17 records have an external send cap of zero.
- 132 historical and current identifiers are preserved in a namespaced crosswalk.
- The live `seller-outreach` compatibility key now resolves explicitly to `seller_options_intake`.
- Overlapping raw identifiers remain namespaced; no global fuzzy alias or generic fallback was introduced.

The TypeScript contract is in `lib/strategy/registry.ts`. The database is the runtime authority.

## Database enforcement delivered

The applied migration history is:

1. `20260815165840_gate3a_strategy_registry_contracts.sql`
2. `20260815170631_gate3a_strategy_registry_hardening.sql`
3. `20260815173723_gate3a_strategy_registry_enforcement.sql`
4. `20260815174041_gate3a_strategy_registry_index_reconciliation.sql`
5. `20260815175020_gate3a_outcome_validator_null_semantics.sql`

The database now enforces:

- substantive nonblank/type-correct operating, lifecycle, owner, outcome, and provenance contracts before activation;
- valid public destinations and CTAs, or an explicit internal-only destination posture;
- approved parent portfolios and approved operators before activation;
- sequential, atomic supersession with retained history;
- immutable active and retired operating-strategy contracts;
- immutable active and retired portfolio-strategy contracts;
- no delete or truncate privilege for service-role strategy/proposal history;
- an atomic proposal-apply RPC that locks the proposal and parent portfolio, creates the successor, activates it, and records the applied proposal in one transaction;
- a private, narrowly scoped runtime binding trigger that can read the forced-RLS registry without exposing it to browser roles;
- rejection of unknown, inactive, conflicting, or ambiguous strategy keys on every new or explicitly re-keyed row in:
  - `command_center_strategy_runs`
  - `strategy_lead_memberships`
  - `command_center_outbound_enrollments`
  - `strategy_market_state`
  - `strategy_source_events`

Historical runtime rows were not rewritten. Ordinary status or metrics updates to historical rows remain possible because binding runs only on inserts or explicit binding-field changes.

## Application contract delivered

`lib/strategy/governance.ts` now:

- exposes the canonical registry snapshot and service-only runtime resolver;
- labels the static TypeScript resolver as registration-only and never execution-ready;
- applies approved portfolio proposals only through `apply_strategy_lane_proposal`;
- no longer performs the prior read → insert → activate → update sequence in separate application calls.

The targeted seller-send and guarded seller-follow-up paths now bind every delivery and outbound enrollment to the governed `seller-outreach` compatibility key. Seller `market_segment` values remain available as analytics metadata, but they can no longer become executable strategy identifiers or bypass the registry when a new segment is introduced.

No executor, cron definition, dispatch flag, batch limit, channel, or live-send setting changed.

## Verification evidence

The production service-role regression test runs inside a transaction and rolls back every test mutation. It proves:

- hollow JSON contracts fail activation;
- otherwise valid outcome contracts missing `learningWindowDays` or `minimumExposure` fail closed rather than returning a nullable validation result;
- a valid draft can activate and resolve;
- an unknown runtime key fails before persistence;
- seller delivery paths use the governed seller key and preserve market segmentation only as metadata;
- a strategy under a proposed portfolio fails before persistence or activation;
- version 2 atomically retires version 1 and preserves both records;
- retired operating and portfolio contracts reject mutation;
- crosswalk successors preserve prior mappings;
- proposal apply participates in the caller transaction;
- one approved proposal creates exactly one successor and cannot apply twice;
- the real `service_role` lacks delete/truncate privileges on governed history.

Passing checks on the Mac Pro:

- `test:strategy-registry-contracts`
- `test:strategy-registry-database`
- `test:operating-architecture`
- `test:operating-loops`
- `test:command-center-ops`
- `test:command-center-autopilot`
- `test:strategy-execution`
- `test:strategy-source-contracts`
- `test:qualified-seller-routing`
- full TypeScript check with `--noEmit --incremental false`
- targeted ESLint for the Gate 3A TypeScript and test files
- full optimized Next.js production build (pre-existing warnings only; no Gate 3A errors)

Post-rollback production truth:

- portfolios: 12
- proposed portfolios: 2
- operating strategies: 17
- operating versions: 17
- active operating versions: 0
- operating versions with send capacity: 0
- crosswalk rows: 132
- current `seller-outreach` mappings: 1
- active legacy portfolio versions: 10
- n8n live-send rows: 0
- scoped uncovered foreign keys: 0

Supabase reports only the expected `RLS enabled, no policy` informational notices for the private service-only registry tables. This is intentional: browser roles receive no direct policy or grant. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Boundary for Gate 3B

Gate 3B must complete each draft operating contract with truthful lane-specific routes, lifecycles, ownership, measurement, and zero-send controls. Gate 3C—not Gate 3B—will connect canonical version IDs to application consumers and outcome capture. External sending, n8n live mode, production outreach, and deployment remain separately gated.
