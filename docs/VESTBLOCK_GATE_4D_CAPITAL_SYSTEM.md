# VestBlock Gate 4D — Capital system

Status: **PASS**

Baseline: `4bf02c1624128149255a0ccead22695ba87bf5c5`

Scope: Gate 4D only. No homepage/hero redesign and no production deployment.

## What shipped

- One customer-facing Capital workbench at `/capital` for six paths: business funding, real-estate funding, business acquisition, business credit/readiness, verified grants/programs, and lender/capital-provider participation.
- Path-specific intake questions, required-document checklists, provider criteria, readiness feedback, explicit provider decision ownership, post-submission expectations, and no-guarantee language.
- Private guest drafts with high-entropy resume tokens, account ownership and resume history, guest-to-account claiming, path/email deduplication, and idempotent retries.
- A shared case lifecycle with status history, operator assignment, controlled transitions, approval evidence, decline reasons, and a safe routing-pending fallback.
- CRM records and follow-up tasks for submitted customer cases; private lender-network records and criteria for provider submissions.
- A Capital case review queue at `/admin/funding`, linked from the Command Center navigation.

## Security and privacy contract

- `capital_cases` and `capital_case_events` have RLS enabled and deny direct `anon` and `authenticated` table access. Only the server-side service role has table grants.
- Customer ownership is checked server-side with a verified Supabase user or a hashed guest resume token.
- Public responses omit token hashes, dedupe/idempotency keys, internal user/CRM/provider/task IDs, operator IDs, and internal event metadata.
- Admin responses require existing VestBlock admin authorization and omit token/deduplication fields.
- Mutations require JSON, apply same-origin checks and rate limits, and reject cross-site requests.
- No service-role key or production credential is delivered to browser code or committed.
- The intake warns customers not to submit SSNs, full account numbers, or sensitive document contents.

## Verification

`npm run typecheck` — PASS

`npm run build` — PASS (pre-existing repository warnings remain outside Gate 4D)

`QA_SITE_URL=http://127.0.0.1:3415 npm run qa:gate4d:capital` — PASS, 19 checks

The QA run uses disposable Supabase users and records and removes them after execution. It proves:

1. Direct anonymous/authenticated table access is denied.
2. Business-funding, real-estate-funding, and provider seed cases persist and connect to CRM/provider records.
3. All six Capital paths save and submit through the shared lifecycle.
4. Authenticated dedupe and idempotency do not create duplicate cases, histories, or active review tasks.
5. Incomplete submissions return actionable readiness gaps without creating a case.
6. Cross-account reads fail; guest resume requires the private token; sign-in can claim the guest case.
7. Customer history, operator intake detail, tasks, CRM links, and status events persist.
8. Invalid status jumps fail; declines retain a reason; approvals require provider evidence.
9. Cross-site mutation attempts fail.
10. Customer and operator views have no horizontal overflow at 1440 px or 390 px.
11. Customer controls retain programmatic labels, path tabs support keyboard navigation, and guest resume tokens leave the address bar after a successful private resume.

The customer Capital render passed desktop and mobile visual review. The tab list supports arrow, Home, and End keys with a visible focus indicator. All text inputs, selects, and textareas have programmatic labels. A separate fresh-eyes reviewer returned **PASS** with no material Gate 4D visual, responsive, readability, or interaction-clarity issue.

## Data model

- `capital_cases`: customer/guest owner, Capital path, intake, consents, readiness, document state, provider criteria snapshot, CRM/provider/task links, status, assignment, and timestamps.
- `capital_case_events`: append-only customer/operator lifecycle history.
- Existing `leads`, `lenders`, `admin_tasks`, and `admin_activity` remain the operational systems of record for CRM, provider criteria, follow-up, and auditing.

VestBlock prepares and reviews each file. A lender, issuer, agency, seller, fund, or program administrator makes the relevant eligibility, underwriting, pricing, award, approval, and closing decisions.
