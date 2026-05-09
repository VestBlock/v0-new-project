# DealVault Integration

## What Was Added

DealVault is being integrated into VestBlock as an additive, feature-gated module.

Primary additions so far:

- Feature flag helper: `lib/dealvault/featureFlag.ts`
- Shared module types, templates, validations, calculations, and hashing:
  - `lib/dealvault/types.ts`
  - `lib/dealvault/dealTemplates.ts`
  - `lib/dealvault/dealCalculations.ts`
  - `lib/dealvault/validations.ts`
  - `lib/dealvault/proof.ts`
- SQL schema and RLS drafts:
  - `supabase/dealvault_schema.sql`
  - `supabase/dealvault_policies.sql`
- Initial dashboard/admin routes:
  - `/dashboard/dealvault`
  - `/dashboard/dealvault/new`
  - `/dashboard/dealvault/proof-vault`
  - `/dashboard/dealvault/partner-pay`
  - `/dashboard/dealvault/milestone-vault`
  - `/admin/dealvault`
  - `/admin/blockchain`
- Admin diagnostics API:
  - `/api/dealvault/health`
- Contract/tooling foundation:
  - `contracts/*.sol`
  - `hardhat.config.ts`
  - `scripts/copyAbis.ts`
  - `deployments/*`

## Route Strategy

DealVault uses VestBlock-native routing rather than importing the standalone app shell directly.

Customer routes:

- `/dashboard/dealvault`
- `/dashboard/dealvault/new`
- `/dashboard/dealvault/proof-vault`
- `/dashboard/dealvault/partner-pay`
- `/dashboard/dealvault/milestone-vault`

Admin routes:

- `/admin/dealvault`
- `/admin/blockchain`

API routes:

- `/api/dealvault/health`

## Data Strategy

DealVault is being adapted to VestBlock’s existing `user_profiles` pattern instead of the standalone app’s `users_profile` table.

Draft DealVault tables:

- `real_estate_deals`
- `real_estate_deal_proofs`
- `real_estate_payout_splits`
- `real_estate_status_events`
- `dealvault_milestone_projects`
- `dealvault_milestone_items`
- `dealvault_blockchain_transactions`
- `dealvault_audit_logs`
- `dealvault_subscriptions`
- `dealvault_idempotency_keys`
- `dealvault_usage_logs`

## Feature Flag

DealVault is protected by:

- `NEXT_PUBLIC_ENABLE_DEALVAULT`

Behavior:

- Navigation is hidden unless enabled
- Dashboard pages show a disabled state when off
- Admin diagnostics remain available for setup/readiness

## Current Limitations

- The customer-facing forms and API mutation routes are not fully wired yet
- Proof certificate generation is not yet ported into the main module
- Standalone polling behavior still needs to be normalized into shared VestBlock patterns
- Standalone naming and env conventions are still being migrated to DealVault conventions

