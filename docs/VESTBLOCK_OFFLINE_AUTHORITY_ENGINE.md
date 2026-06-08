# VestBlock Offline Authority Engine

This is the private authority system for VestBlock. It should compound market authority without cluttering the public website with growth-agency language.

## Goal

Increase the odds that VestBlock is mentioned for real estate questions by improving:

- crawlability and indexing
- real-estate entity clarity
- city and intent coverage
- backlinks and partner mentions
- PR and podcast targets
- proof assets and prompt-test tracking

## Public-facing rule

Do not lead the main website with SEO, AEO, PR, or authority-service language.

The website should stay focused on:

- sellers
- buyers
- lenders
- funding
- DealVault
- partner routing

Authority work should happen behind the scenes and support the real-estate business instead of competing with it.

## Daily offline authority workflow

1. Check live production AEO health.
2. Check indexing readiness and changed URLs.
3. Review real-estate query gaps and prompt-test gaps.
4. Identify the next content pages that strengthen real-estate authority.
5. Identify backlink and partner-mention targets worth pursuing.
6. Identify PR or podcast angles that reinforce VestBlock as a real-estate company.
7. Keep recommendations tied to real-estate demand, not generic visibility work.

## Best daily actions

- Ship or queue one strong real-estate content angle
- Push indexing for priority URLs
- Add or update one proof asset
- Advance one backlink or directory target
- Advance one PR, podcast, or partner-mention target
- Record the next mention-gap opportunities for sellers, buyers, lenders, and funding

## Core files and systems

- Live AEO audit: `/api/cron/aeo-site-audit`
- Local scorecard: `pnpm visibility:aeo-scorecard`
- Indexing push: `pnpm visibility:indexing-dry-run` and `pnpm visibility:indexing-push`
- Backlink pipeline: [docs/content/VESTBLOCK_BACKLINK_AND_PROOF_PIPELINE.md](/Users/mrsanders/Downloads/Codex%20Folder/docs/content/VESTBLOCK_BACKLINK_AND_PROOF_PIPELINE.md)
- PR angles: [docs/VESTBLOCK_PR_PARTNER_PITCHES_2026-05-15.md](/Users/mrsanders/Downloads/Codex%20Folder/docs/VESTBLOCK_PR_PARTNER_PITCHES_2026-05-15.md)

## Guardrails

- No fake ranking guarantees
- No spam backlink buying
- No generic small-business drift when the real target is real estate
- No public copy that confuses users about the core offer
