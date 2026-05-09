# DealVault Audit

## Summary

This audit covers the standalone `trustvault-smart-agreements` project extracted to:

- `/Users/mrsanders/Downloads/Codex Folder/.external/trustvault-smart-agreements`

The target integration repo is the current VestBlock workspace at:

- `/Users/mrsanders/Downloads/Codex Folder`

Canonical product naming for integration work:

- Public/module name: `DealVault`
- Legacy/source reference name: `TrustVault`

## What Was Found

The standalone project is a real Next.js 14 App Router application with meaningful implementation, not just stubs.

High-confidence reusable areas:

- Solidity contracts:
  - `contracts/VestBlockProofVault.sol`
  - `contracts/VestBlockPartnerPay.sol`
  - `contracts/VestBlockMilestoneVault.sol`
- Hardhat config and contract scripts:
  - `hardhat.config.ts`
  - `scripts/deploy.ts`
  - `scripts/verify.ts`
  - `scripts/copyAbis.ts`
- Feature APIs:
  - `app/api/proof-vault/*`
  - `app/api/partner-pay/*`
  - `app/api/milestone-vault/*`
  - `app/api/blockchain/*`
- Blockchain service layer:
  - `lib/blockchain/*`
- Hashing/certificate concepts:
  - `lib/documents/hashDocument.ts`
  - `lib/documents/proofVerifier.ts`
  - `lib/documents/certificateGenerator.ts`
- Validation and payment-rail concepts:
  - `lib/validations/index.ts`
  - `lib/payments/*`
- Documentation:
  - `docs/DEPLOYMENT.md`
  - `docs/SECURITY.md`
  - `docs/SMART_CONTRACTS.md`
  - `docs/VESTBLOCK_INTEGRATION_PLAN.md`

## What Works

Initial audit indicates the standalone module has:

- A coherent product model across proofs, partner deals, and milestone projects
- Server-side blockchain write patterns
- Async queue patterns through Inngest
- Supabase schema and RLS files
- A usable dashboard/admin UI structure
- Contract tests and application tests present on disk

The contracts themselves appear directionally sound for MVP:

- OpenZeppelin-based access control and pausing
- No tokenization
- No fund custody
- No raw document contents on-chain
- Event-driven auditability

## What Is Broken

The standalone project is not production-ready without stabilization.

Confirmed issues so far:

1. `npm install` fails with plain npm resolution.
   - Root cause: peer dependency resolution conflict around `inngest`
   - Current workaround: `npm install --legacy-peer-deps`

2. `npm run typecheck` fails immediately.
   - Confirmed failure source: `lib/payments/adapter.ts`
   - Likely cause: a block comment contains `settle*/disburse()` which prematurely terminates the comment and breaks TypeScript parsing

3. `npm run compile:contracts` fails.
   - Root cause: `@nomicfoundation/hardhat-toolbox` peer dependencies are incomplete
   - Missing packages reported by Hardhat:
     - `@nomicfoundation/hardhat-chai-matchers`
     - `@nomicfoundation/hardhat-ignition-ethers`
     - `@nomicfoundation/hardhat-network-helpers`
     - `@typechain/ethers-v6`
     - `@typechain/hardhat`

4. The prompt inventory does not perfectly match the actual repo.
   - The archive does not contain `hooks/usePolling.ts`
   - Some components perform inline polling instead of using a shared hook

5. Auth and profile assumptions conflict with VestBlock.
   - Standalone project uses `users_profile`
   - VestBlock uses `user_profiles`
   - Standalone auth helpers are not drop-in compatible

6. Layout and nav assumptions conflict with VestBlock.
   - Standalone app has its own dashboard shell/sidebar
   - VestBlock already has protected navigation and admin shell patterns

7. Environment variable naming is not namespaced enough for safe integration.
   - Standalone app uses generic `BLOCKCHAIN_*` and `NEXT_PUBLIC_*_ADDRESS` names
   - VestBlock integration should move to `DEALVAULT_*`-prefixed server vars where possible

## What VestBlock Already Has

The existing VestBlock repo already provides:

- Next.js App Router app with active customer/admin flows
- Supabase auth/client/server/admin helpers
- `user_profiles` table conventions
- admin shell and admin navigation patterns
- middleware-based protected route handling
- Inngest already installed in the main app

Important constraint:

- The VestBlock repo is currently a very dirty worktree with extensive unrelated modifications. Integration work must avoid reverting or disturbing unrelated files.

## Integration Direction

Recommended integration strategy:

1. Treat the standalone repo as a source module, not as a transplant.
2. Reuse the best primitives:
   - contracts
   - blockchain wrappers
   - hashing/certificate logic
   - validations
   - selected UI pieces
3. Rebuild the app boundary around VestBlock-native patterns:
   - `user_profiles`
   - existing Supabase helpers
   - existing admin layout
   - existing dashboard routing
   - feature-flag gating

## Chosen Naming

Chosen canonical name for this integration:

- `DealVault`

Usage:

- Routes: `/dashboard/dealvault`, `/admin/dealvault`, `/api/dealvault/*`
- Library namespace: `lib/dealvault/*`
- Docs: `docs/DEALVAULT_*`
- Feature flag: `NEXT_PUBLIC_ENABLE_DEALVAULT`

Legacy `TrustVault` naming will only remain where needed to trace imported source code or contract history.

## Initial Fixes In Progress

- Create VestBlock-native `lib/dealvault/*` foundations
- Add DealVault feature flag handling
- Document the audit and integration direction
- Begin mapping standalone schema and services into VestBlock-safe module boundaries

## Progress Since Audit

The integration has moved past the initial audit stage.

Completed validation to date:

- DealVault contracts were rebuilt inside the VestBlock repo under `contracts/`
- Hardhat compile passes in the main repo
- Hardhat contract tests pass in the main repo
- A live Base Sepolia deployment succeeded
- A live smoke script executed end-to-end writes against all four deployed contracts

Current live deployment artifacts:

- `deployments/baseSepolia.json`
- `deployments/baseSepolia.smoke.json`

This means the smart-contract lane is no longer theoretical. It is deployed on testnet and has already exercised proof creation, deal creation, payout ledger actions, and milestone actions with real testnet transactions.

## Remaining Work

- Stabilize the standalone code enough to extract cleanly
- Add DealVault schema SQL for VestBlock
- Bring in blockchain dependencies and contract tooling safely
- Implement DealVault pages, API routes, and admin views behind feature flags
- Wire proof hashing, certificate generation, and transaction logging
- Verify build, lint, and test impact in the VestBlock app
