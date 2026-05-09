# DealVault Deployment

## 1. Environment

Add the following env vars:

- `NEXT_PUBLIC_ENABLE_DEALVAULT=false`
- `NEXT_PUBLIC_CHAIN_ID=84532`
- `NEXT_PUBLIC_BLOCKCHAIN_NETWORK=base-sepolia`
- `NEXT_PUBLIC_DEALVAULT_REAL_ESTATE_ADDRESS=`
- `NEXT_PUBLIC_PROOF_VAULT_ADDRESS=`
- `NEXT_PUBLIC_PARTNER_PAY_ADDRESS=`
- `NEXT_PUBLIC_MILESTONE_VAULT_ADDRESS=`
- `DEALVAULT_ADMIN_ADDRESS=`
- `DEALVAULT_BLOCKCHAIN_RPC_URL=`
- `DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY=`
- `DEALVAULT_BLOCKCHAIN_EXPLORER_API_KEY=`
- `ALLOW_MAINNET_DEPLOYMENT=false`

`DEALVAULT_ADMIN_ADDRESS` can be the same public wallet address as the deployer/admin wallet. If omitted, the deployer wallet becomes the admin automatically.

For any real-chain deploy, only set `ALLOW_MAINNET_DEPLOYMENT=true` intentionally and only with a fresh wallet.

## 2. Database

Run:

1. `supabase/dealvault_schema.sql`
2. `supabase/dealvault_policies.sql`

## 3. Contracts

Compile:

```bash
corepack pnpm exec hardhat compile
```

Run contract tests:

```bash
corepack pnpm exec hardhat test
```

Copy ABIs:

```bash
corepack pnpm copy-abis
```

## 4. Deployment Records

Template files exist at:

- `deployments/amoy.json`
- `deployments/baseSepolia.json`

Populate the deployed contract addresses after testnet deployment.

Deploy to Amoy:

```bash
corepack pnpm deploy:dealvault:amoy
```

Deploy to Base Sepolia:

```bash
corepack pnpm deploy:dealvault:base-sepolia
```

Check mainnet readiness for Base:

```bash
corepack pnpm check:dealvault:deploy:base
```

Deploy to Base mainnet:

```bash
corepack pnpm deploy:dealvault:base
```

Check mainnet readiness for Polygon:

```bash
corepack pnpm check:dealvault:deploy:polygon
```

Deploy to Polygon mainnet:

```bash
corepack pnpm deploy:dealvault:polygon
```

Run the live Base Sepolia smoke test:

```bash
corepack pnpm smoke:dealvault:base-sepolia
```

## 5. Verified Base Sepolia Deployment

The current local integration has been deployed and smoke-tested on Base Sepolia.

- Network: `base-sepolia`
- Chain ID: `84532`
- Deployer/Admin: `0x017B65db53ff8d587AaC723A279Fa6a62a16ed23`
- DealVaultRealEstate: `0x4005D1cFB956F8B3b6244412Bfe16Fd7369C1274`
- ProofVault: `0x168638046f41C52BC41FA16960F367916E48335C`
- PartnerPay: `0x3ca01c84a93c9927034Fd0afb3cFc298528E1092`
- MilestoneVault: `0xB0B594e1e1142E6E7743b66a904252f2367D0D78`

Deployment artifact:

- `deployments/baseSepolia.json`

Smoke-test artifact:

- `deployments/baseSepolia.smoke.json`

The smoke test executed live writes against all four contracts:

- `ProofVault.createProof`
- `DealVaultRealEstate.createDeal`
- `DealVaultRealEstate.updateDealStatus`
- `DealVaultRealEstate.attachProof`
- `PartnerPay.createDeal`
- `PartnerPay.addSplit`
- `PartnerPay.lockDeal`
- `PartnerPay.markSplitPaid`
- `MilestoneVault.createProject`
- `MilestoneVault.addMilestone`
- `MilestoneVault.submitMilestoneProof`
- `MilestoneVault.approveMilestone`
- `MilestoneVault.completeMilestone`

## 6. Rollout

Recommended order:

1. Keep `NEXT_PUBLIC_ENABLE_DEALVAULT=false`
2. Verify `/admin/blockchain`
3. Verify `/api/dealvault/health`
4. Validate dashboard routes
5. Run proof and deal flows in test/staging
6. Flip `NEXT_PUBLIC_ENABLE_DEALVAULT=true`

## 7. Recommended Same-Day Real-Chain Trial

If the goal is to try a real blockchain today, the safest path is:

1. Use a fresh dedicated admin wallet, not the earlier exposed test wallet.
2. Prefer `Base mainnet` first to keep costs lower.
3. Fund the wallet with a small amount of real gas.
4. Set `.env.local` with:
   - `DEALVAULT_BLOCKCHAIN_RPC_URL`
   - `DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY`
   - `DEALVAULT_ADMIN_ADDRESS`
   - `ALLOW_MAINNET_DEPLOYMENT=true`
5. Run:
   - `corepack pnpm check:dealvault:deploy:base`
   - `corepack pnpm deploy:dealvault:base`
6. Copy the deployed addresses into:
   - `NEXT_PUBLIC_DEALVAULT_REAL_ESTATE_ADDRESS`
   - `NEXT_PUBLIC_PROOF_VAULT_ADDRESS`
   - `NEXT_PUBLIC_PARTNER_PAY_ADDRESS`
   - `NEXT_PUBLIC_MILESTONE_VAULT_ADDRESS`
7. Re-test the app flow immediately after deploy.

Do not use mainnet for the first try unless you are comfortable paying real gas and using a fresh wallet.
