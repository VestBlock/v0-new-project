# Gate 3B — Complete operating contracts

Date: 2026-08-15
Authority: VestBlock LLC founder-approved Gate 2 architecture
Repository authority: Mac Pro, `codex/operation-rebrand-final`

## Gate boundary

Gate 3B completes the 17 canonical operating strategies as truthful, reviewable version-1 drafts. It does not activate a strategy, authorize an external send, connect a runtime consumer, deploy the website, schedule automation, start outreach, or change n8n.

Runtime strategy-version binding, source-to-outcome attribution, operating outcome records, governed proposal learning, and Obsidian projection remain Gate 3C work. A contract describes the intended operating system; it is not evidence that every lifecycle state or outcome is already persisted.

## Result

- 17 lane-specific operating contracts replace the single generic Gate 3A lifecycle, cadence, indicator set, and sample threshold.
- Every contract names its target participant, problem, offer, eligibility and disqualification rules, prioritization, evidence authority, channels, cadence, nurture and reactivation limits, cross-lane handoffs, human approvals, compliance limits, learning inputs, failure conditions, and stop rules.
- Every contract distinguishes current persisted states and events from target-only stages.
- Every contract names a measurable primary conversion, exposure unit, minimum sample, minimum primary conversions, learning window, two-window decision safeguard, verified-outcome rule, attribution dimensions, and guardrails.
- All 17 versions remain `draft`, unapproved, unactivated, and externally blocked with `external_send_cap = 0`.
- No contract grants dispatch authority. The Gate 3B contract value is `none_in_gate_3b`.

## Canonical destinations

### Public routes — 12

| Operating strategy | Route | CTA |
|---|---|---|
| `capital_readiness_intake` | `/capital` | Start your capital readiness review |
| `seller_options_intake` | `/sell` | Review my selling options |
| `buyer_buy_box_activation` | `/workspace/profiles/new?role=buyer` | Create your free buyer profile |
| `lender_provider_criteria` | `/workspace/profiles/new?role=lender` | Add your lending criteria |
| `next_move_free_roadmap` | `/next-move` | Build my free Next Move roadmap |
| `credit_education_support` | `/credit-upload` | Review my credit report and build an action plan |
| `business_formation_readiness` | `/next-move?focus=start-business` | Build my business readiness roadmap |
| `dealvault_activation` | `/dealvault/demo` | Request a private demo |
| `service_provider_network` | `/workspace/profiles/new?role=service_provider` | Create your service provider profile |
| `investor_capital_relationships` | `/workspace/profiles/new?role=investor` | Create your real estate investor profile |
| `professional_participant_activation` | `/workspace/profiles` | Create your free participant profile |
| `content_authority_intelligence` | `/next-move` | Build my free Next Move roadmap |

### Internal-only controllers — 3

- `property_opportunity_discovery`
- `public_sector_opportunity_readiness`
- `customer_lifecycle_orchestration`

These contracts expose no public CTA. Property discovery is an evidence-review process, public-sector readiness remains an operator-only SAM/readiness process, and the lifecycle controller may propose a handoff but may not send or call n8n.

### Unresolved and inactive — 2

- `partner_referral_network`: no governed partner record, economics/disclosure contract, or approved destination exists.
- `business_acquisition_network`: no confidential business-opportunity authority, bilateral disclosure lifecycle, compensation/licensing decision, or approved matching destination exists.

`/capital?path=business-acquisition` remains a financing-readiness path and is not treated as the business-acquisition matching destination.

## Truthful authority boundaries

- Capital and seller contracts use their current case and append-only event records; future provider, introduction, offer, and close stages are not treated as present merely because the contracts name them.
- Buyer, lender, investor, and service-provider strategies start after professional participant activation. A profile becoming active does not itself authorize matching or outreach. The current investor route is explicitly limited to a real-estate investor profile; it does not represent a cross-sector capital-partner schema.
- Next Move currently proves submission/generation, not every proposed save, checkpoint, and progress event.
- Credit processing records are separate from the future customer action-plan engagement lifecycle.
- Business-readiness milestones are target-only; a static page or generated roadmap is not a verified milestone.
- DealVault demo interest and product activation are separate conversions. A generic lead is not a verified first record or authorized participant.
- Content delivery signals are leading indicators, not customer conversions. Each future asset must snapshot an approved destination and CTA, and the current ready-to-published/auto-publish bypass must be removed or review-gated before activation.
- Customer lifecycle orchestration is an internal owner-routing controller. The existing direct-reminder behavior is legacy and is not certified by this contract.

## Activation and learning safety

The versions intentionally remain blocked. A minimum sample and two completed windows describe the evidence needed for a later recommendation; they do not create an automatic promotion mechanism. Delivery, opens, clicks, and provider acceptance cannot satisfy a business conversion by themselves. Complaints, suppression errors, duplicate dispatch, identity conflicts, material claim failures, or other guardrail regressions block promotion.

Gate 3C must add exact operating-version binding, an append-only operating outcome authority, evidence attribution, founder-review fingerprinting, and atomic activation controls before any version can be considered for activation. Proposed parent portfolios remain proposed, and no parent status is changed here.

## Production verification

- Supabase migration `20260815192922_gate3b_operating_contracts` is applied and matches the checked-in migration payload.
- A rollback-only Mac Pro rehearsal completed the full migration and postconditions before production apply.
- Production contains 17 version-1 drafts, zero active operating versions, zero nonzero send caps, zero approval or activation fields, and zero n8n live-send rows.
- The service-role database regression passed inside a rolled-back transaction, including review validation, fail-closed activation, resolver behavior, history protection, and runtime identifier enforcement.
- The Gate 3B contract, registry, operating architecture, operating loops, Command Center, execution, and source-contract test suites passed.
- Targeted ESLint, full TypeScript validation, and the Next.js production build passed; the build generated all 261 static pages.
- Scoped Supabase security and performance advisors returned only expected informational notices for intentionally private RLS tables and newly introduced indexes; no Gate 3B warning or error was introduced.

## Integration truth

- n8n remains an orchestration dependency only; Gate 3B does not enable it or authorize live sending.
- DealMachine exports remain retired. The native API stays blocked until the replacement key and contact-data contract are reviewed in a later gate.
- Buffer may be used only with VestBlock-owned profiles after channel and content approval.
- Missing partner, confidential acquisition, public-sector participant, response-state, and outcome integrations are recorded as blockers rather than represented as operational.

## Gate 3C handoff

Gate 3C must connect new execution and outcome records to the immutable operating-strategy version, preserve source provenance through enrollment and communication, separate one participant's multiple strategies, snapshot the destination and CTA, enforce the contract lifecycle, and project the approved registry into Obsidian. It must not infer that a Gate 3B draft is executable.
