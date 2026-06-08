# DealVault Revenue Operator

Use this skill when improving DealVault as a sales-ready product, demo asset, or outreach offer.

## Goal

Turn DealVault interest into qualified conversations by making the product easy to understand:

- store agreement records
- create proof certificates
- track milestones
- clarify referral and payout records
- show a buyer-ready demo without legal, escrow, custody, or tokenization claims

## Start Here

- Public page: `app/dealvault/page.tsx`
- Demo page: `app/dealvault/demo/`
- Dashboard: `app/dashboard/dealvault/`
- APIs: `app/api/dealvault/`
- Shared code: `lib/dealvault/`
- Demo package: `scripts/createDealVaultDemoPackage.ts`
- Proof assets: `public/dealvault/`, `deployments/dealvault-demo-package.json`

## Buyer Language

Use plain language:

- agreement record
- proof certificate
- milestone status
- payout split record
- document hash
- timestamp
- dashboard record

Avoid overclaiming:

- do not say DealVault replaces attorneys, title, escrow, custody, compliance, or signed agreements
- do not imply tokenized ownership or passive investment returns
- do not put raw private documents, property addresses, SSNs/EINs, or private keys on-chain

## Revenue Loop

1. Confirm the demo PDF, proof hash, and certificate still generate.
2. Confirm the page explains who it helps and what to do next.
3. Add screenshots, proof examples, or flow graphics only when honest.
4. Route interested buyers to a clear demo or get-started CTA.
5. Log blockers in `docs/VESTBLOCK_GROWTH_BACKLOG.md`.

## Verification

- `npm run demo:dealvault`
- `npm run verify:dealvault:ui`
- `npm run check:contracts`
- `npm run typecheck`
- `npm run build` when route/shared code changed
