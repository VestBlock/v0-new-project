# VestBlock Gate 4A — Public Routes and Conversion Journeys

Status: **PASS — awaiting owner approval; not deployed**

Prepared: August 12, 2026

Branch: `codex/operation-rebrand-final`

Gate 4A closes the public discovery and entry layer without claiming that the specialized Capital, Deals, Opportunity, DealVault, account, or operations workflows have passed their later subgates.

## Work completed

- Added an executable Gate 4 closure matrix covering all 104 page routes and 202 route handlers. Every item has one owner, purpose, subgate, and explicit status; no item is unassigned.
- Verified the public homepage narrative and Capital, Deals, Opportunity, DealVault, and free-roadmap navigation in a real browser.
- Preserved the approved Material Ledger hero and Next-Move funnel; this gate did not rebrand or redirect the approved product direction.
- Kept `/next-move` public for guests and corrected the AI-assistant request boundary so guest visitors are not incorrectly forced through authentication.
- Added shared same-origin, JSON-content, request-size, and rate-limit protection to 13 public mutation endpoints. Reverse-proxy host and protocol handling was verified so the guard works behind Vercel.
- Added structured server validation to the real-estate funding and seller entry handlers.
- Removed internal lead IDs, buyer/lender IDs, growth-system IDs, and internal automation error details from public success responses where the visitor does not need them.
- Replaced the public Deal Hunter's broad owner/property query with a capped, purpose-built query. The public response now hides street address, ZIP code, owner records, internal property UUIDs, and precise coordinates while retaining useful city/state opportunity signals.
- Reduced public map zoom so approximate coordinates cannot be presented as an exact property location.
- Added cache and graceful unavailable-state behavior to the public property feed.
- Expanded the sitemap to include the approved Next-Move, service, proof, and Deal Hunter entry routes.
- Corrected duplicated brand suffixes in public browser titles and broadened pricing/learning language so VestBlock is not presented as only real-estate software.
- Removed the remaining disabled Twilio configuration block. Repository runtime searches found no PostHog, Twilio, or Postiz implementation or package dependency.

## End-to-end public journey evidence

One controlled test used the configured VestBlock internal mailbox. It did not authorize marketing or outreach.

1. `/next-move` accepted a business-acquisition questionnaire and returned HTTP 200 with a Deals roadmap.
2. OpenAI returned a schema-valid refinement; deterministic fallback remained available.
3. Supabase stored analysis consent `true`, marketing consent `false`, source `internal_gate_test`, and AI status `completed`.
4. The CRM stored the lead under `next_move_questionnaire`; outreach remained `not_started` and marketing eligibility remained false.
5. The requested human review created an open `next_move_followup` operator task.
6. Resend accepted the transactional roadmap email. No campaign or external prospect message was sent.
7. Customer export returned HTTP 200 and did not expose questionnaire or CRM IDs.
8. Customer deletion returned HTTP 200, anonymized the questionnaire, suppressed and cleared the CRM record, dismissed the operator task, and invalidated the lifecycle token. A subsequent export returned HTTP 404.

## Validation, authorization, failure recovery, and privacy

- Cross-origin requests against all 13 guarded public mutations returned HTTP 403.
- Non-JSON requests against all 13 returned HTTP 415.
- Same-origin invalid payloads returned the expected HTTP 400, with invalid Next-Move lifecycle tokens returning HTTP 404.
- Reverse-proxy-origin requests were accepted by the guard and reached normal schema validation; this covers the Vercel forwarding boundary.
- Invalid buyer and lender portal tokens returned HTTP 404.
- A guest AI-assistant invalid submission reached public schema validation instead of redirecting to login.
- The property analyzer returned a complete calculation with persistence disabled, proving useful public value without creating an operator record.
- A private-network URL submitted to the site-preview flow produced the safe fallback preview without fetching the private target.
- The public Deal Hunter returned 24 capped records with no owner data, street addresses, ZIP codes, internal property UUIDs, or high-precision coordinates.

## Route and browser verification

- Generated sitemap sweep: **544 URLs checked; 543 HTTP 200; one deliberate invalid resource slug HTTP 404; 0 unexpected statuses**.
- Desktop and mobile homepage browser checks: correct title and H1, Capital/Deals/Opportunity links present, zero horizontal overflow, hero video ready and playing.
- At 390 CSS pixels the browser selected `mobile.webm`; the video reached ready state 4.
- Next-Move query routing selected business acquisition correctly, rejected a blank obstacle with an accessible inline alert, preserved required analysis consent, and defaulted human follow-up and marketing to off.
- Deal Hunter rendered the privacy disclosure with no internal property identifier in page text and no browser console errors.

Local screenshot evidence is stored in the ignored QA folder:

- `output/playwright/gated-completion/gate-4a/home-mobile-final.png`
- `output/playwright/gated-completion/gate-4a/next-move-mobile-final.png`
- `output/playwright/gated-completion/gate-4a/deal-hunter-final.png`

## Code and release verification

- `pnpm typecheck`: PASS
- Focused ESLint across all Gate 4A changes: PASS
- `git diff --check`: PASS
- `pnpm audit:gate4-matrix -- --summary`: PASS; 306 items, 0 unassigned
- `pnpm build`: PASS; all 247 static pages generated in the tested release artifact

The full build retains pre-existing non-blocking lint warnings outside Gate 4A. No Gate 4A lint or type errors remain.

## Approval boundary

Gate 4A is complete but is not deployed. It did not trigger public outreach, ad spend, payment, blockchain writes, or unattended sending. The only external message was the controlled transactional roadmap to VestBlock's internal mailbox.

Gate 4B may begin only after explicit owner approval of Gate 4A. Production deployment remains reserved for Gate 9, and external outreach remains reserved for Gate 10.

## Verdict

**PASS — Gate 4A is implemented and verified. Awaiting owner approval before Gate 4B.**
