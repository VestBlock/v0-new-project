# DealVault Security

## MVP Security Boundaries

DealVault is intentionally limited to proof, status, and audit workflows.

Not in MVP:

- tokenized real estate ownership
- fractional ownership
- escrow or custody
- on-chain money movement
- NFT issuance
- raw private documents on-chain
- raw property addresses on-chain

## On-Chain Data Rules

Allowed on-chain:

- hashes
- ids
- timestamps
- statuses
- external references

Not allowed on-chain:

- raw property addresses
- private agreements
- document bodies
- sensitive personal details

## Key Handling

Private key requirements:

- server-side only
- never `NEXT_PUBLIC_*`
- store in deployment secrets
- use testnets first

Current server env targets:

- `DEALVAULT_BLOCKCHAIN_RPC_URL`
- `DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY`
- `DEALVAULT_BLOCKCHAIN_EXPLORER_API_KEY`

## Database Security

DealVault SQL drafts enable RLS and assume ownership/admin checks through:

- `auth.uid() = user_id`
- `private.vestblock_is_admin()`

## Known Risks

- The broader VestBlock repo currently has unrelated lint issues that should be cleaned up before treating lint as a release gate
- Hardhat warns on the current Node version even though compile succeeded
- Customer mutation routes are still being wired, so this module should remain feature-flagged until the full CRUD surface is tested

## Pre-Launch Requirements

Before public enablement:

- run schema + RLS in the real Supabase project
- verify contract deploys on testnet
- verify proof hashing and certificate generation
- verify no secret env vars leak into the client bundle
- add focused tests for hashing, validation, and route gating

