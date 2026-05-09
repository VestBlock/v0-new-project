# VestBlock Lender Matching

## Purpose

Borrower-to-lender matching helps VestBlock route funding users to better-fit lenders instead of treating every lender as interchangeable.

## Inputs used

The matching engine can use:

- funding mode
- borrower state
- business industry
- business revenue
- time in business
- FICO estimate
- funding goal amount
- deal type
- language preference
- investor experience
- DSCR
- owner-occupied preference
- cash-out intent
- urgency
- docs readiness
- VestBlock service type

## Matching logic

The engine ranks lenders using:

- lender category fit
- state coverage
- startup tolerance
- investor / real-estate tolerance
- score and confidence
- bilingual / Spanish support
- goal amount fit
- borrower segment fit

Each match stores:

- confidence score
- fit summary
- fit explanation
- next docs needed
- fallback options

## Current integration points

- `/api/lenders/match`
- `/api/funding/recommendation`

The funding recommendation route now persists lender matches when a recommendation is generated or fetched.

## How to use it

### For a funding user

1. Save a funding profile.
2. Generate a funding recommendation.
3. Read lender matches returned alongside the recommendation.

### For admin

1. Open `/admin/lender-matches`.
2. Review match quality and confidence.
3. Open the lender detail page to see outreach, notes, and performance.

## Guardrails

- Matches are not lender approvals.
- Stored matches are updated for the same lender/user/recommendation combination instead of endlessly duplicating rows.
- Weak-fit matches still store fallback guidance so the operator can route more honestly.
