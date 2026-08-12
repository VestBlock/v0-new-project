# VestBlock Gate 3 — Homepage and Next-Move Funnel

Status: **PASS — ready for owner approval; not deployed**

Prepared: August 12, 2026

Branch: `codex/operation-rebrand-final`

Gate 3 implements the approved nine-part VestBlock homepage and a public, goal-based Next-Move funnel. It preserves the Material Ledger direction, routes visitors across Capital, Deals, and Opportunity, and connects the free questionnaire to Supabase CRM, OpenAI-assisted roadmap generation, Resend transactional delivery, human review tasks, and customer-controlled export and deletion.

## Work completed

- Implemented the approved homepage sequence: hero, path directory, how VestBlock works, Capital, Deals, Opportunity, DealVault, trust/limitations, and the free questionnaire CTA.
- Promoted Capital, Deals, and Opportunity into keyboard-accessible navigation throughout the public homepage.
- Implemented the approved responsive Material Ledger video hero with a Black business owner, live assistant overlays, coordinated scene states, pause/play control, mobile media, and reduced-motion fallback.
- Built `/next-move` as a three-step public questionnaire spanning Capital, Deals, and Opportunity.
- Added deterministic 7/30/60/90-day roadmaps plus schema-validated OpenAI refinement with deterministic fallback.
- Connected the questionnaire to existing free credit-report upload and financial-roadmap routes. The free credit review is clearly the recommended first step and explicitly states that it is not a credit application or hard inquiry.
- Added builder/developer and business-acquisition routing through structured Next-Move CRM briefs and operator tasks.
- Added source attribution, distinct analysis and marketing consent, human follow-up requests, access labels, limitations, and financial/credit cautions.
- Added Resend-first transactional roadmap email delivery while preserving Google Workspace for its approved mailbox role.
- Added customer export and deletion management with high-entropy, hashed lifecycle tokens.
- Applied the private `next_move_questionnaires` table migration to the existing VestBlock Supabase project with RLS and service-only access.

## Data and security behavior

- Public writes are validated server-side and protected by same-origin checks, a honeypot, and per-origin rate limiting.
- Questionnaire records are inaccessible to anonymous and authenticated Supabase roles; only the server service role can access them.
- The lifecycle token is returned once; only its SHA-256 hash is stored.
- Analysis consent is required and stored separately from optional marketing consent. Marketing is off by default.
- Phone is requested only when the visitor explicitly asks for human follow-up.
- OpenAI requests use structured output, a timeout, `store: false`, and a hashed safety identifier. The deterministic roadmap remains available if AI refinement fails.
- The public API response does not expose internal lead or questionnaire IDs.
- Deletion anonymizes the questionnaire and CRM record, sets the lead to do-not-contact, clears structured personal data, dismisses the related operator task, removes the questionnaire email event, strips any legacy address metadata from related activity, and invalidates the lifecycle link.
- Credit copy does not promise deletion, a score change, approval, rates, limits, awards, matches, or transaction outcomes.

## Verification evidence

### Code and build

- `pnpm exec tsc --noEmit`: PASS
- Focused ESLint across all Gate 3 routes, components, and libraries: PASS with no findings
- `git diff --check`: PASS
- `pnpm build`: PASS; all 247 static pages generated and `/`, `/next-move`, `/next-move/manage`, `/api/next-move`, and `/api/next-move/manage` were included in the release build
- The full repository build continues to report pre-existing non-blocking lint warnings outside the Gate 3 scope; Gate 3 files are clean under the focused lint run.

### Responsive and accessibility

- Homepage checked at 390, 1024, and 1440 CSS pixels with zero horizontal overflow.
- Mobile selected `mobile.webm`; tablet and desktop selected `desktop.webm`.
- Video reached ready state 4 and played at all tested widths; browser and page-error collection returned no errors.
- Pause/play, responsive media, keyboard-accessible path links, static poster, and reduced-motion fallback are present.
- Final roadmap result checked at 1440 pixels with zero overflow and no console errors.
- Independent fresh-eyes design review returned **PASS** after confirming that no test identity is visible, the free credit path is the clear recommended next action, the no-hard-inquiry explanation is visible, and result hierarchy is appropriately scaled.

Screenshot evidence is stored in the ignored local QA folder:

- `output/playwright/gated-completion/gate-3/home-desktop.png`
- `output/playwright/gated-completion/gate-3/home-tablet.png`
- `output/playwright/gated-completion/gate-3/home-mobile.png`
- `output/playwright/gated-completion/gate-3/next-move-result-desktop-final.png`

### Live integration lifecycle

One controlled test used the configured VestBlock internal mailbox and no marketing consent:

1. Same-origin questionnaire submission returned HTTP 200.
2. OpenAI produced a schema-valid refined roadmap; deterministic fallback remained available.
3. Supabase stored the questionnaire with analysis consent `true`, marketing consent `false`, attribution source `internal_gate_test`, and AI status `completed`.
4. CRM stored a `lead_intelligence` record sourced from `next_move_questionnaire`; outreach remained `not_started`.
5. The requested human follow-up created an open `next_move_followup` operator task.
6. Resend accepted the transactional roadmap from the verified `vestblock.io` domain and its provider API later reported the message as `delivered`.
7. Export returned the customer record without internal questionnaire or lead IDs.
8. Delete returned HTTP 200, anonymized both records, set the CRM record to do-not-contact, dismissed the task, and invalidated the lifecycle link; a subsequent export returned HTTP 404.

No public outreach, unattended sending, ad spend, payment, blockchain, or deployment action was triggered. The only external message was the controlled transactional roadmap test to VestBlock's configured internal mailbox.

## Files and workflows changed

- Homepage and navigation: `app/page.tsx`, `components/cinematic/*`, `components/home/*`, `components/navigation.tsx`, `app/globals.css`
- Next-Move public and management journeys: `app/next-move/*`, `components/next-move/*`
- Next-Move APIs and services: `app/api/next-move/*`, `lib/next-move/*`
- Existing free credit/roadmap integration and safeguards: `app/credit-upload/page.tsx`, `app/api/generate-roadmap/route.ts`, `middleware.ts`
- Transactional provider routing and privacy cleanup: `lib/email/sendEmail.ts`
- Database: `supabase/migrations/20260812172547_create_next_move_questionnaires.sql`
- Responsive media: `public/hero/material-ledger/*`

## Remaining blockers and approval boundary

There is no Gate 3 implementation blocker. Production still serves the preserved Gate 0 release because this gate does not authorize deployment.

Exact owner action: review Gate 3 and reply **“approve Gate 3”** to authorize work on Gate 4. This approval does not authorize production deployment, real outreach, unattended sending, or ad spend.

Gate commit: the focused commit containing this report and the files above. See Git history and the gate handoff for its exact SHA.

## Verdict

**PASS — Gate 3 is complete, verified, committed at the gate boundary, and awaiting owner approval.**
