# DealMachine Wholesaling Revamp - 2026-06-08

## Problem

The weekend outreach did not produce leads because the active stack over-weighted contactability. A reachable owner is not the same thing as a motivated seller.

The old `contact-first-stack` gave the largest queue to records that had both email and phone plus a loose weighted score. That created volume, but it also pulled in stale owners, weak-problem owners, sold properties, and bank-owned records that are no longer normal seller conversations.

## New Buyer-Seller Logic

Seller outreach should now prioritize owners with a live, solvable problem:

- Current tax delinquency, especially 2025 tax year or nonzero past-due amount.
- In preforeclosure, but not bank-owned.
- Vacant with equity, but not sold, failed, or bank-owned.
- Absentee ownership plus an active property problem.
- Recent records first, because old distress often means the opportunity already passed.

Contactability is now a delivery requirement, not the core motivation signal.

## Updated Stack Lanes

The DealMachine harvest now exports these seller-intent lanes:

- `live-problem-stack`: recent 2026 record, contactable, not sold/failed/bank-owned, with at least two active problem signals.
- `tax-due-now-stack`: current tax delinquency plus equity/contactability.
- `preforeclosure-saveable-stack`: in preforeclosure plus equity, excluding bank-owned records.
- `absentee-problem-stack`: out-of-state owner with vacancy, tax delinquency, lien, or live preforeclosure.
- `vacant-equity-stack`: vacant and equity-positive, excluding sold/failed/bank-owned records.
- `contactable-nurture-stack`: contactable records with weaker or unproven live intent. This is a nurture pool, not the first campaign.

## What To Stop Doing

- Stop sending the broad `contact-first-stack` as the main campaign.
- Stop treating `Bank Owned` as preforeclosure. That is usually too late for seller acquisition.
- Stop prioritizing markets only by list volume.
- Stop using text/email alone as the proof of market quality. The first metric should be live-problem density.

## Outreach Pivot

Use a two-step acquisition motion:

1. Work only the strongest seller-intent lanes by phone-first/manual review.
2. Use email/text as supporting follow-up after the owner has a clear live problem.

Recommended message angle:

> "I saw the property may have a tax/vacancy/preforeclosure issue. Are you still the owner, and are you looking for options before it gets more expensive?"

This is cleaner than a generic cash-buyer pitch because it asks whether the problem is current.

## Revenue Plan

Daily target:

- Pull refreshed stack files.
- Review the top 25-50 records from `live-problem-stack`, `tax-due-now-stack`, and `preforeclosure-saveable-stack`.
- Skip sold, failed, bank-owned, stale 2024-only, and negative-equity records unless there is another strong signal.
- Call first where compliant and appropriate; use email/text as follow-up, respecting DNC/TCPA rules.
- Track replies by lane, not just by market.

Market expansion should follow live-problem density:

- Keep a market only if it produces recent, owner-held, equity-positive problems.
- Pause a market if most high-scoring records are sold, bank-owned, or stale.
- Expand into suburbs only when the nearby city shows live-problem density, not just contactability.

## Current Strategic Read

Milwaukee had the most volume, but it also included sold and bank-owned records that should not be treated as seller leads.

Toledo is more interesting than its raw count suggests because its records are more tax-delinquency-heavy and more recent.

Macon has volume, but it needs the new filters before outreach because broad contactability was carrying the old score.

Cincinnati and Detroit should be worked only from the highest-intent lanes until they prove reply/call conversion.
