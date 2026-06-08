# VestBlock Facebook Content Team

This is the operating team for the 90-day Buffer content calendar.

## Editor in Chief
- Owner: Brand and direction
- Job: Keep every post aligned with VestBlock as a real estate partner network: sellers, buyers, lenders, operators, capital partners, DealVault, and visibility support.

## Acquisitions Voice
- Owner: Seller pain and offer paths
- Job: Explain fast cash, creative structure, and novation review without promising offers, prices, or timelines.

## Buyer Network Strategist
- Owner: Buy box and deal flow
- Job: Speak to buyers who need better-fit opportunities, clean criteria, and capital confidence before they move.

## Capital Partner Editor
- Owner: No Limit Capital and funding education
- Job: Frame NLC as a partner path for fix-and-flip, bridge, DSCR, and ground-up construction review while keeping terms subject to underwriting.

## DealVault Trust Producer
- Owner: Proof and partner trust
- Job: Turn messy referral, payout, milestone, and partner-agreement pain into simple proof-layer content.

## AEO/SEO Growth Producer
- Owner: Member visibility campaigns
- Job: Explain how VestBlock can help buyers, lenders, sellers, and operators become easier to find and understand online.

## Compliance Editor
- Owner: Risk review
- Job: Remove guarantees, broker/lender confusion, unsupported claims, and raw partner pricing that should not be public copy.

## Publishing Rules
- Never promise funding, approvals, rates, offers, closings, rankings, or deal volume.
- Keep No Limit Capital framed as a partner review path, not a guarantee.
- Keep VestBlock framed as a real estate partner network and routing layer, not a brokerage, lender, or closing agent.
- Every post should point to one of the core paths: sellers, buyers, lenders, funding review, DealVault, visibility, or get started.
- Use Facebook comments to ask clarifying questions and move qualified replies into the right VestBlock intake path.

## Buffer Scheduling Notes
- The scheduler uses Buffer's current GraphQL API and creates Facebook posts with `metadata.facebook.type: post`.
- Live scheduling is intentionally batched with `--max=6` because Buffer returned a 15-minute rate-limit window after six creates.
- Result files are used as the resume ledger. Re-running the scheduler skips days that already have Buffer post IDs, so it will continue without duplicating posts.
- The API key is read from `BUFFER_API_KEY` at runtime and is not written into the repository.

Calendar JSON: /Users/mrsanders/Downloads/Codex Folder/data/buffer/vestblock-facebook-90-day-calendar.json
Calendar CSV: /Users/mrsanders/Downloads/Codex Folder/data/buffer/vestblock-facebook-90-day-calendar.csv
