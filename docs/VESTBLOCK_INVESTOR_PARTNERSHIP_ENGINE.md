# VestBlock Investor Outreach & Partnership Engine

The Investor Outreach & Partnership Engine lives at `/admin/investor-partnerships` and stores its operating records in DealVault-backed Supabase tables created by `db/migrations/052-create-investor-partnership-engine.sql`.

## Phase 1 Markets

- Toledo, OH
- Cleveland, OH
- Milwaukee, WI
- Racine, WI
- Kenosha, WI

## Discovery Inputs

Investor profiles can be imported through `POST /api/admin/investor-partnerships` with source evidence from:

- Recent flip transactions
- County deed records
- LLC ownership records
- DealMachine exports
- Public property sales
- LinkedIn
- Facebook investor groups
- Local REIA directories
- Public foreclosure buyers

Each profile stores name, LLC/company, email, phone, website, LinkedIn/Facebook, markets, property types, estimated buy box, transactions, financing indicators, and source evidence.

## Classification

Profiles support these primary classifications and can also carry secondary tags:

- Fix and Flip
- Buy and Hold
- DSCR Investor
- Wholesaler
- Acquisition Manager
- Institutional Buyer
- Private Lender
- Hard Money Borrower

## Partnership Score

The engine calculates a 0-100 VestBlock Partnership Score from:

- Recent Activity
- Transaction Volume
- Geographic Fit
- Financing Need
- Disposition Need
- Partnership Potential

The score also selects the first outreach sequence:

- `A` Deal Flow
- `B` Disposition Support
- `C` Financing Support
- `D` Strategic Partnership

## Outreach And Follow-Up

Admins can generate, approve, queue, and mark outreach from the dashboard. Engagement events track opens, clicks, replies, calls booked, lending requests, buy box information, deals submitted, deals sold, and funding closed.

The AI Follow-Up Agent endpoint is `POST /api/admin/investor-partnerships/follow-up-agent`. It reads an inbound reply, creates follow-up tasks, opens matching opportunities, and routes work to acquisitions, lending, dispositions, or partnerships.

## Dashboards

The dashboard summarizes:

- Active Buyers
- Active Borrowers
- Active Sellers
- Lending Opportunities
- Partnership Opportunities
- Revenue Opportunities
