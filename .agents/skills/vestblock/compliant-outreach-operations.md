# Compliant Outreach Operations

Use this skill when expanding VestBlock's outbound system.

## Core rule

Do not treat automation as permission to blast.

## Required controls

- approval states
- send caps
- provider readiness checks
- error logging
- opt-out language
- do-not-contact status support
- compliant physical mailing address in every cold email
- no-email leads must never enter email send queues
- sent messages must not be overwritten back to review or approved states

## Transactional vs outbound

- Resend is for system and transactional mail first
- Gmail / Workspace is preferred for inbox-style outbound if configured
- keep those roles separate in code and in operations

## Safe defaults

- auto-send off by default
- use dry-run tests first
- surface missing provider keys clearly
- never crash the workflow because a send provider is unavailable

## Current Commands

Use this sequence before any send:

1. `npm run outreach:scorecard`
2. `npm run outreach:preflight`
3. `npm run outreach:review`
4. `npm run outreach:approve-safe` only when candidates pass guardrails
5. `npm run outreach:send:small` only after explicit send approval or an already-approved automation window

Use `scripts/process-gmail-bounces.mjs`, `scripts/suppress-bad-lead-emails.mjs`, and `scripts/sanitize-no-email-manual-export.mjs` for bounce/suppression hygiene.

## Daily Target Rule

Aim for 100 quality emails/day, but only from production-eligible leads with usable emails, safe copy, unsubscribe language, and a recorded business reason. If the qualified pool is empty, the correct fix is source/enrichment quality, not forcing sends.
