# Gate 2 — Canonical Strategy Inventory and Architecture

**Program:** VestBlock LLC production growth system
**Gate:** 2 — Complete strategy inventory
**Date:** 2026-08-15 (America/Chicago)
**Authoritative repository:** `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`
**Branch:** `codex/operation-rebrand-final`
**Starting commit:** `97a67e6a`
**Gate mode:** Analysis and architecture only

## Outcome

Gate 2 is complete as an evidence-backed inventory and proposed operating architecture.

VestBlock has a strong governed foundation, but it does not yet have one executable strategy system. Ten versioned portfolio lanes exist in Supabase and project into Obsidian. The application, CRM, scheduled jobs, legacy scripts, website journeys, and Command Center also use several independent strategy catalogs and lifecycle models. Those systems do not share one stable hierarchy, and the governed portfolio registry has no measured outcome windows.

The Gate 3 decision proposed here is:

1. Preserve the ten approved portfolio IDs already in production.
2. Add two missing portfolio IDs: `public_sector_opportunities` and `customer_lifecycle_growth`.
3. Define every executable tactic, funnel, and audience program as a versioned child strategy with exactly one canonical parent.
4. Treat city scenarios, Next Move focus plans, Capital paths, and recommendation tags as segments or journeys—not parallel strategy registries.
5. Keep Supabase and the application CRM authoritative; n8n may orchestrate approved commands but may not become a second CRM or strategy source of truth.
6. Keep external sends disabled until the later CRM and outreach gates pass.

No strategy code, production data, automation, deployment, live-send flag, customer record, or outreach message was changed in Gate 2.

## Completion-gate boundaries

Gate 2 performed:

- repository and runtime inventory;
- aggregate-only production CRM inspection;
- versioned strategy-lane inspection;
- Obsidian Strategy Vault inspection;
- n8n workflow/configuration inspection;
- website journey and CTA mapping;
- conflict, duplication, and missing-strategy analysis;
- proposed canonical registry and operating contracts.

Gate 2 did **not**:

- migrate or mutate Supabase;
- change a current strategy version;
- disable or delete an automation;
- alter n8n workflows or credentials;
- enable any live-send setting;
- dispatch outreach;
- deploy the application;
- rewrite the approved VestBlock platform identity.

The requested graph code-navigation capability was not available in this runtime. The repository analysis therefore used exhaustive read-only `rg`, code-path tracing, migration inspection, runtime configuration inspection, and aggregate database queries. That limitation did not prevent completion of the inventory.

## Evidence and authority hierarchy

The following hierarchy resolves conflicting definitions:

1. **Founder-approved release/gate decisions** define business direction and boundaries.
2. **Versioned Supabase portfolio and child-strategy records** will be the machine-readable strategy authority.
3. **Application services and the CRM** will enforce eligibility, lifecycle, suppression, attribution, and approvals.
4. **Automation ownership records** will identify the single approved executor for each event.
5. **n8n** may consume signed, approved orchestration commands and return signed acknowledgements; it may not originate unregistered outreach or own CRM truth.
6. **The Command Center and AI brain** will read approved versions and propose evidence-backed improvements.
7. **Obsidian** will remain a read-only operational-memory projection.
8. **Historical scripts, documents, and legacy tables** are evidence only unless mapped to an approved version.

Primary evidence includes:

- `lib/strategy/governance.ts`
- `supabase/migrations/20260814110000_gate4e3_strategy_matching_orchestration.sql`
- `lib/admin/strategyExecutionCatalog.ts`
- `lib/admin/autonomousOperatingCore.ts`
- `lib/admin/cityScenarioStrategyCatalog.ts`
- `lib/automation/n8n-orchestrator.ts`
- `lib/matching/opportunity-matches.ts`
- `lib/platform/lanes.ts`
- `lib/participant-profiles/config.ts`
- `lib/capital/catalog.ts`
- `lib/next-move/types.ts`
- `vercel.json`
- the production Supabase schema and aggregate operational counts;
- `/Users/mrsanders/Documents/VestBlock Strategy Vault`;
- the signed-in `vestblock.app.n8n.cloud` workspace.

## Current production evidence

### Governed strategy state

- `strategy_lane_versions`: 10 rows, 10 distinct active portfolio IDs, all version 1.
- `strategy_lane_outcomes`: 0 rows. No governed portfolio has completed a measured learning window.
- `strategy_updates`: 378 general recommendations, but none constitute measured portfolio-lane outcomes.
- All ten current lane contracts use substantially the same generic 30-day hypothesis and decision rule.
- Obsidian contains ten corresponding active strategy notes but its Home page reports zero strategies.
- The Obsidian Strategies dashboard filters for `type == "strategy"`; the projected notes lack that property, so the dashboard is likely empty.

### CRM and execution state

- The legacy `leads` CRM contains 9,031 records. Most are `contacted` or `outreach_ready`; only seven are marked replied, and none are recorded as qualified, interested, won, or lost.
- `outreach_messages` contains 11,544 rows and `outreach_send_events` contains 16,931 rows. Provider-status history includes 608 `delivered` and 103 `bounced` events, but end-to-end stage and conversion attribution are weak.
- Buyer records: 708 buyers and 708 active buy boxes; 81 matches exist, but none progressed beyond `matched`.
- Lender records: 198 lenders; no lender products or lender matches exist.
- Investor profiles: 0, while investor automation has 1,446 historical run rows, including 625 failures.
- New controlled layers are unused in production: 0 capital cases, 0 seller cases, 0 participant profiles, 0 participant matches, and 0 Deal Pipeline items.
- Next Move has three questionnaires across two primary paths.
- Admin follow-up has 495 tasks, 490 of them open and none completed.
- `command_center_strategy_runs` contains 3,215 historical runs across 40 tactic keys.
- `strategy_lead_memberships` contains 1,088 memberships across eight tactic keys.
- `strategy_lane_outcomes` remains empty, so execution history does not close the governed learning loop.

These counts describe operational evidence, not customer success. Historical records must be preserved and cross-walked; they must not be discarded or presented as verified conversions.

## n8n status on the Mac Pro

### What is already connected

- The Mac Pro has server-only `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` configuration.
- The configured host is `vestblock.app.n8n.cloud` and passes the application host/HTTPS allowlist.
- The n8n workspace contains one published workflow: **VestBlock Signed Command Bridge**.
- The workflow visibly contains a signed webhook, fail-closed validation, and a controlled 202 preview response.
- It has no downstream write or outreach node.
- The n8n execution list showed five successful rows after an initial error; its overview separately reported four production executions and zero failed production executions. Neither view proves that VestBlock received a signed callback.
- Production orchestration control remains `live_send_enabled=false`.

### What is not connected

- The current n8n trial displays **Upgrade to use API**. A management API key cannot be created during the present trial.
- The workspace showed ten trial days remaining when inspected. Continued n8n Cloud hosting/webhook availability after trial expiration must be confirmed before VestBlock depends on it.
- A browser login cookie is not an n8n management API credential and must not be copied to the Mac Pro.
- The application has no business workflow calling the bridge; only the admin contract-test route calls `dispatchN8nWorkflow`.
- The latest persisted VestBlock contract-test row is an older HTTP 403 and contains no signed acknowledgement receipt.
- The current n8n UI success evidence therefore proves a published, reachable preview workflow, but VestBlock has not yet proven the complete application → n8n → signed callback → CRM acknowledgement cycle.

### Gate decision

Classify n8n as **configured and preview-reachable during the current trial, not end-to-end operational**.

The signed-webhook design itself does not require a management API key. Before the trial expires, VestBlock must confirm the plan needed to keep the hosted workflow/webhook available; management-API access may have an additional plan requirement. No purchase or upgrade was made.

Before any live use, a later gate must:

1. run a new no-send contract test;
2. receive and persist the signed acknowledgement;
3. prove replay/idempotency protection;
4. prove suppression is rechecked immediately before dispatch;
5. prove no duplicate application/n8n/manual owner exists;
6. perform an internal VestBlock-controlled delivery test;
7. obtain explicit approval before a limited live pilot.

## Canonical registry model

The word **strategy** is currently overloaded. Gate 3 should introduce a two-level model.

### Level 1 — portfolio lane

A durable business domain used in navigation, governance, reporting, and cross-lane routing.

| Canonical portfolio ID | Current status | Gate 3 decision |
|---|---|---|
| `capital_funding` | Active v1; incomplete execution | Retain and version. |
| `real_estate_buyers_investors` | Active v1; duplicated buyer/investor models | Retain and version. |
| `seller_property_acquisition` | Active v1; fragmented execution | Retain and version. |
| `lenders_capital_providers` | Active v1; duplicated intake paths | Retain and version. |
| `real_estate_professionals_providers` | Active v1; incomplete provider activation | Retain and version. |
| `business_buyers_sellers` | Active v1; missing executable journey | Retain and version. |
| `next_move_roadmaps` | Active v1; functioning entry journey | Retain and version. |
| `dealvault_opportunities` | Active v1; product active, adoption loop missing | Retain and version. |
| `partnerships_referrals` | Active v1; conflicts with legacy affiliate flow | Retain and version. |
| `content_visibility` | Active v1; split across content/AEO/SEO/PR | Retain and version. |
| `public_sector_opportunities` | Missing canonical lane; dormant subsystem exists | Proposed: add in controlled dormant mode pending founder approval; otherwise formally retire the subsystem. |
| `customer_lifecycle_growth` | Missing canonical lane; partial components exist | Add as the single lifecycle/cross-lane owner. |

### Level 2 — operating strategy

A versioned, executable contract belonging to exactly one portfolio. It defines target, qualification, source, message/offer, destination, CRM lifecycle, executor, cadence, guardrails, measurement, and stop rules.

### Segments, scenarios, and journeys

The following are not independent portfolio registries:

- the 17 seller execution tactic IDs;
- the 14 Command Center/autopilot IDs;
- the 33 city scenario IDs;
- the 14 Next Move focus plans;
- the six Capital paths;
- revenue-campaign categories;
- buyer, lender, and investor subcategories;
- website navigation scenarios.

Each must be represented as one of:

- a child operating strategy;
- a qualification segment;
- a source tactic;
- a customer journey;
- a recommendation tag.

Every historical identifier must get a crosswalk. Historical rows stay intact; new activity must record the canonical portfolio ID, operating-strategy ID, and strategy-version ID.

## Global operating controls

The following controls apply to every operating strategy and need not be redefined inconsistently in each executor.

### G1 — identity and source

- Normalize and deduplicate a person or organization before enrollment.
- Record source type, source URI or provider, external ID, observed timestamp, contact provenance, and freshness.
- Never treat a purchased, unsupported, identity-conflicted, private, or stale record as outreach-ready.

### G2 — permission and suppression

- Store channel-specific consent or documented lawful basis.
- Recheck global suppression, DNC, withdrawal, complaint, bounce, and role-specific restrictions immediately before dispatch.
- Public availability of contact data does not by itself authorize every outreach channel.

### G3 — one CRM and one executor

- The CRM registers every intended contact and its strategy version before dispatch.
- One idempotency key protects one recipient, strategy version, message version, channel, and sequence step.
- One automation owner handles an event. n8n, application jobs, and manual actions may not dispatch the same step independently.

### G4 — human approval

Human approval is required for:

- live-send activation;
- material strategy, audience, offer, or positioning changes;
- financial, credit, underwriting, investment, return, or eligibility claims;
- provider, investor, partner, customer, or opportunity introductions;
- sensitive seller contexts;
- public-sector bid/no-bid and submission decisions;
- commission, affiliate, referral-fee, or compensation terms.

### G5 — communication limits

- Allowed channel vocabulary: `website_notification`, `resend_email`, `outlook_graph`, `buffer_vestblock`, `operator_task`, `manual_phone_task`, and `no_outreach`.
- Buffer is limited to official VestBlock-owned profiles.
- No Twilio, Postiz, PostHog, purchased lists, or unverified mass messaging.
- SMS remains unavailable until consent basis and integration are separately approved.
- Every external message identifies VestBlock LLC, has a relevant next step, and includes required opt-out language.

### G6 — claim boundaries

- No guaranteed funding, approval, credit-score increase, deletion, income, investment return, property availability, deal outcome, or transaction timeline.
- Educational roadmaps are not legal, tax, credit, investment, or underwriting decisions.
- Provider criteria and property/opportunity facts must have a timestamp and source.

### G7 — experiment safety

- Capture results by portfolio, operating strategy, version, segment, source, message, channel, destination, and timing.
- Distinguish facts, observations, hypotheses, and recommendations.
- Material changes are proposals, not autonomous edits.
- Do not declare a winner from opens alone or from a low-volume sample.
- Default to recommendation-only until at least two complete learning windows and a strategy-specific minimum exposure/conversion threshold are satisfied.
- Any complaint, legal/compliance failure, identity conflict, or duplicate send blocks automatic promotion.

### G8 — global stop conditions

Stop or pause a sequence on:

- opt-out, complaint, hard bounce, DNC, or withdrawal;
- reply requiring human handling;
- conversion or successful handoff;
- disqualification or identity conflict;
- stale source or expired criteria;
- missing/invalid consent or lawful basis;
- broken destination or missing message/strategy version;
- capacity, cost, provider, or channel failure;
- duplicate/idempotency conflict;
- kill switch or disabled live-send control.

## Complete operating-strategy registry

The following 17 records cover every lane named in the Gate 2 brief. They are proposed contracts for Gate 3, not claims of present end-to-end operation.

### 1. `capital_readiness_intake`

**Parent:** `capital_funding`
**Status:** Active foundation; incomplete matching and measured learning.

- **Target / problem / value:** Businesses, property operators, acquisition buyers, grant seekers, and sponsors with a defined capital need but incomplete readiness, documents, or provider fit. VestBlock provides structured intake, readiness analysis, document gaps, bounded education, and preparation for provider review.
- **Eligibility / source data:** Verified identity and business/property context, defined use and amount of funds, timing, current capacity, customer-submitted financial/business facts, document state, analysis consent, and separately recorded provider-sharing/marketing permissions. Disqualify fabricated facts, prohibited purpose, identity conflict, or request for a guarantee.
- **Landing / CTA / channels:** Landing: `/capital`. CTA: **Start your capital readiness review.** Primary channels are the intake and transactional website/email confirmation. Secondary channels are operator task and Outlook/Resend only with the appropriate permission. Do not auto-submit to a provider.
- **CRM lifecycle / owner / cadence:** `draft → submitted → needs_information → under_review → readiness_plan → ready_for_provider_review → provider_review → approved | declined | closed | withdrawn`. Application/CRM owns intake and state; operator owns material review; later n8n may dispatch approved notifications. Immediate confirmation, one-business-day review target, then consented reminders at days 3, 7, and 14; stop after three unanswered reminders or any G8 event.
- **Human/compliance:** Human review before provider sharing, underwriting-like language, eligibility representation, or referral compensation. State clearly that VestBlock does not guarantee approval or terms.
- **Indicators / conversion / business value:** Completion rate, document-gap resolution, time to readiness, provider-review acceptance, and provider-confirmed outcome. Primary conversion: completed qualified capital intake accepted for readiness review. Value: qualified service opportunity and permissioned provider-match demand.
- **Learning / unique stop:** Capture path, need type, readiness gaps, provider fit, completion friction, message, timing, stage time, and verified outcome. Pause a provider path when criteria are stale or rejection reasons show a systemic mismatch.

### 2. `seller_options_intake`

**Parent:** `seller_property_acquisition`
**Status:** Active but fragmented and duplicated across newer seller cases, legacy leads, and tactic engines.

- **Target / problem / value:** Owners or authorized representatives who need a credible property sale or transition path. VestBlock provides an options review spanning appropriate cash, listing/referral, seller-finance, creative, novation, hybrid, or no-action paths without manufacturing urgency.
- **Eligibility / source data:** Authority to discuss the property, property identity, occupancy/condition/timing/title/equity context, seller-submitted facts or time-stamped public records, documented lawful basis for any sourced contact, and no suppression/identity conflict.
- **Landing / CTA / channels:** Landing: `/sell`. CTA: **Review my selling options.** Primary channel is the secure intake. Secondary channels are operator task and approved email; manual phone is allowed only when the contact basis is documented. Sensitive legal, probate, foreclosure, bankruptcy, senior, and hardship contexts require human review.
- **CRM lifecycle / owner / cadence:** `draft → submitted → needs_information → under_review → options_ready → qualified → next_step_approved → introduced | offer_review → closed | withdrawn | disqualified`. Seller case service owns customer state; operator owns review; no source script owns outreach. Immediate confirmation, human review within one business day, then consented follow-up at days 2, 7, and 14.
- **Human/compliance:** Review every sourced first contact, all sensitive contexts, property-value representations, offer terms, legal/tax language, and third-party introductions.
- **Indicators / conversion / business value:** Complete-intake rate, qualified conversation rate, options-review completion, review-to-offer or referral progression, and verified close. Primary conversion: qualified seller case accepted for operator review. Value: acquisition, referral, or advisory opportunity with verified provenance.
- **Learning / unique stop:** Capture source/tactic, property context, chosen path, objections, time to contact, appointment, offer/referral outcome, and verified close. Stop on owner-authority conflict, representation, legal dispute, explicit distress sensitivity, stale property evidence, or three unanswered approved attempts.

### 3. `property_opportunity_discovery`

**Parent:** `seller_property_acquisition`
**Status:** Active foundation; fragmented across source orchestrator, ATTOM, public-record scripts, HomeHarvest history, and inactive native DealMachine.

- **Target / problem / value:** Internal operator strategy for finding provenance-backed property signals that may support a seller conversation or verified buyer opportunity. The value is prioritized evidence and review—not a claim that a property is available or an owner is motivated.
- **Eligibility / source data:** Time-stamped public records, approved property intelligence, ATTOM, HomeHarvest where permitted, and later the native DealMachine API when separately activated. Require property identity, source event, observed time, freshness SLA, dedupe key, owner/contact provenance, and suppression/lawful-basis decision.
- **Landing / CTA / channels:** Landing: **N/A — internal/operator only**. CTA: **N/A — no direct external CTA**; after human approval, an owner may be directed to `/sell` with **Review my selling options**, while a verified demand match uses the buyer profile/DealVault review flow. Primary channels are `operator_task` and `no_outreach`. No source system may send directly.
- **CRM lifecycle / owner / cadence:** `source_observed → normalized → deduplicated → evidence_current → contact_review → eligible | held | rejected → seller_case_candidate → match_review`. Strategy source orchestrator may ingest; the CRM owns qualification; operator owns contact review. Source refresh may run daily; external cadence is inherited from `seller_options_intake`, never from the source job.
- **Human/compliance:** Human review before natural-person outreach and for protected/sensitive contexts. Public-record sourcing must not become protected-class targeting or unsupported distress claims.
- **Indicators / conversion / business value:** Fresh-record rate, dedupe rate, evidence completeness, review yield, lawful-contact eligibility, qualified seller case, and operator-approved opportunity match. Primary conversion: provenance-backed record accepted into a customer-safe case or match review.
- **Learning / unique stop:** Learn by provider/source, jurisdiction, freshness, tactic, review reason, contact quality, response, and verified progression. Disable a source/tactic after systemic provenance failure, high suppression/complaint rate, repeated stale data, or no qualified progression across two reviewed windows.

### 4. `buyer_buy_box_activation`

**Parent:** `real_estate_buyers_investors`
**Status:** Incomplete and duplicated across legacy `/buyers`, buyer tables, and participant profiles.

- **Target / problem / value:** Active local, institutional, and specialty buyers who need relevant opportunities without wasting time on poor-fit inventory. VestBlock offers a free, current buy-box profile and operator-reviewed opportunity routing.
- **Eligibility / source data:** Verified role/identity, active participant profile, matching permission, service markets, property types, economics, capacity/proof-of-funds state, preferred structures, no-go criteria, communication preference, and recent verification.
- **Landing / CTA / channels:** Landing: `/workspace/profiles/new?role=buyer`. CTA: **Create your free buyer profile.** Primary channel after activation is a website notification for an approved match. Secondary channels are consented Resend/Outlook notification and operator task. Legacy `/buyers` should become a bridge or read-only legacy path after a migration decision.
- **CRM lifecycle / owner / cadence:** `active_profile → criteria_current → match_review → notified → interested | passed → transaction_review → dormant | withdrawn`. `professional_participant_activation` exclusively owns `draft → pending_review → needs_information → verified → active` and its completion reminders. After the handoff at `active`, the buyer strategy owns criteria refresh every 30 days and relevant match notifications; the operator approves match communication.
- **Human/compliance:** Review capacity/criteria representations, every initial opportunity share, and any investment-return or availability language. Separate matching permission from marketing permission.
- **Indicators / conversion / business value:** Profile completion, verification time, criteria freshness, reviewed-match acceptance, response, diligence progression, and verified transaction stage. Primary conversion: operator-approved match accepted for review by the buyer. Value: demand liquidity, opportunity routing, and potential DealVault usage.
- **Learning / unique stop:** Capture criteria fit, pass reasons, source, asset type, timing, price/structure gap, match quality, and stage progression. Pause profile on stale capacity, repeated irrelevant-match feedback, withdrawn permission, or no criteria refresh by SLA.

### 5. `lender_provider_criteria`

**Parent:** `lenders_capital_providers`
**Status:** Incomplete and duplicated across `/lenders`, Capital provider intake, lender tables, and participant profiles.

- **Target / problem / value:** Verified lenders, CDFIs, brokers, banks, private lenders, and specialty capital providers who need qualified, permissioned demand. VestBlock offers a free provider profile, current criteria capture, and operator-reviewed introductions.
- **Eligibility / source data:** Verified organization/role, active profile, products, geography, amount range, underwriting criteria, exclusions, document needs, capacity, provider-supplied verification date, matching permission, and separate outreach preference.
- **Landing / CTA / channels:** Landing: `/workspace/profiles/new?role=lender`; `/capital?path=capital-provider` should bridge to the same underlying profile. CTA: **Add your lending criteria.** Primary channels are the website and operator review. Secondary channels are Outlook/Resend with documented permission; manual phone task is allowed only where appropriate.
- **CRM lifecycle / owner / cadence:** `active_provider → criteria_refresh_due → match_review → introduction_accepted | declined → paused | dormant | DNC`. `professional_participant_activation` exclusively owns profile draft, verification, and completion reminders. After the handoff at `active_provider`, this strategy owns criteria verification every 30–60 days based on volatility; the operator owns introductions.
- **Human/compliance:** Human review before any borrower/project introduction, compensation disclosure, underwriting claim, or provider recommendation. VestBlock does not represent provider approval.
- **Indicators / conversion / business value:** Verified providers, product completeness, criteria freshness, match precision, accepted introductions, response time, and provider-confirmed outcome. Primary conversion: provider accepts a qualified introduction for review. Value: current capital supply and referral/service opportunity.
- **Learning / unique stop:** Capture eligibility rules, rejection reason, term drift, response time, match outcome, and customer experience. Pause provider when criteria expire, identity/capacity cannot be verified, complaints arise, or outcomes contradict submitted criteria.

### 6. `next_move_free_roadmap`

**Parent:** `next_move_roadmaps`
**Status:** Active customer journey; incomplete activation, retention, and measured learning.

- **Target / problem / value:** People who need a practical starting point across credit, funding, income, business readiness, property, or opportunity. VestBlock offers a free questionnaire, deterministic plan, optional bounded AI refinement, saved actions, and transparent routing.
- **Eligibility / source data:** Customer-submitted questionnaire, analysis consent, attribution, focus, goal, timing, current position, obstacles, credit range as self-reported, time available, and optional marketing/follow-up permissions.
- **Landing / CTA / channels:** Landing: `/next-move`. CTA: **Build my free Next Move roadmap.** Primary channels are the website and immediate transactional roadmap confirmation. Secondary channels are consented Resend progress reminders and operator task when follow-up is requested.
- **CRM lifecycle / owner / cadence:** `started → submitted → roadmap_generated → saved → action_due → progress_reported → completed | rerouted | reengage | deletion_requested`. Next Move service owns generation; CRM owns lifecycle; operator owns requested follow-up. Immediate delivery, then optional checkpoints at days 7, 30, 60, and 90.
- **Human/compliance:** Review any recommendation that could be read as credit, financial, tax, legal, investment, or underwriting advice. Keep transactional analysis consent separate from marketing consent.
- **Indicators / conversion / business value:** Start/completion, roadmap generation, save rate, action completion, return visits, qualified cross-lane intake, and customer-reported progress. Primary conversion: roadmap generated and saved. Value: ecosystem acquisition and qualified routing.
- **Learning / unique stop:** Capture abandonment step, focus/path, action completion, useful/not-useful feedback, cross-lane transition, and progress. Stop optional reminders on no marketing permission, deletion request, completed path, or explicit disengagement.

### 7. `credit_education_support`

**Parent:** `next_move_roadmaps`
**Status:** Partial; education, upload, recommendation, and dispute tooling exist without one governed operating contract.

- **Target / problem / value:** Customers seeking to understand credit reports, errors, utilization, readiness, and appropriate next actions. VestBlock provides education, report organization, action planning, and bounded support—not guaranteed deletion or score improvement.
- **Eligibility / source data:** Customer account, explicit analysis permission, customer-uploaded report/data, date/source of information, stated goals, disputes owned by the customer, and optional follow-up permission. Never ingest data from an unauthorized report.
- **Landing / CTA / channels:** Landing: `/credit-upload`, entered directly or through `/next-move`. CTA: **Review my credit report and build an action plan.** Primary channels are the secure website and transactional notification. Secondary channels are consented Resend progress reminders and operator task.
- **CRM lifecycle / owner / cadence:** `education_requested → data_uploaded → analysis_ready → customer_review → action_plan → action_in_progress → checkpoint → completed | referred | paused`. Credit service owns secure analysis; operator reviews edge cases. Immediate confirmation, then customer-selected checkpoints such as days 7, 30, 60, and 90.
- **Human/compliance:** No deletion, approval, funding, score, timeline, or legal-outcome guarantee. Present dispute tools as customer-directed education and documents; recommend qualified professional review where needed.
- **Indicators / conversion / business value:** Secure completion, report review, action-plan save, action completion, repeat check-in, and appropriate funding/readiness transition. Primary conversion: customer completes and saves a bounded credit action plan. Value: trust, retention, and qualified capital readiness.
- **Learning / unique stop:** Capture confusing sections, action selection, completion, customer feedback, and verified self-reported progress. Stop on identity/data-access concern, deletion request, unsupported legal claim, or need for licensed/legal advice.

### 8. `business_formation_readiness`

**Parent:** `next_move_roadmaps` with governed cross-route to `capital_funding`
**Status:** Incomplete; pages and recommendations exist, but no dedicated CRM contract or outcome loop.

- **Target / problem / value:** Founders and small-business owners who need entity, EIN, banking, recordkeeping, offer-validation, compliance, and operating basics before pursuing capital. VestBlock offers a preparation checklist and readiness roadmap.
- **Eligibility / source data:** Customer request, business stage, jurisdiction, ownership/identity basics, goals, current entity/EIN/banking/records/offer state, and customer-submitted documents. Do not infer legal/tax suitability.
- **Landing / CTA / channels:** Landing: `/business-setup`, with `/next-move?focus=start-business` as the guided entry. CTA: **Build my business readiness plan.** Primary channel is the website roadmap. Secondary channels are transactional/consented Resend and operator task; cross-route to `/capital` only after readiness criteria are met.
- **CRM lifecycle / owner / cadence:** `started → readiness_assessed → gaps_identified → action_plan → milestone_due → ready_for_capital | operating_ready → completed | paused`. Next Move/business-readiness service owns the checklist; operator handles individualized questions. Immediate plan, then optional days 7 and 30 progress prompts.
- **Human/compliance:** No legal, tax, licensing, banking-approval, tradeline, funding, or business-success guarantee. Jurisdiction-specific decisions require qualified professional guidance.
- **Indicators / conversion / business value:** Assessment completion, milestone completion, record/document readiness, qualified Capital transition, and customer-reported operating progress. Primary conversion: readiness plan completed with at least one verified milestone.
- **Learning / unique stop:** Capture gaps, abandonment, milestone difficulty, referral need, Capital eligibility, and completed actions. Stop on jurisdictional/legal uncertainty, identity conflict, or customer request for an unsupported shortcut.

### 9. `dealvault_activation`

**Parent:** `dealvault_opportunities`
**Status:** Product active; adoption, activation, retention, and lifecycle strategy incomplete.

- **Target / problem / value:** Operators, buyers, lenders, partners, and teams that need continuity across agreements, proof, milestones, certificates, and payout references. DealVault provides a documented record layer without implying a deal, asset, outcome, or return.
- **Eligibility / source data:** Authenticated account, permitted opportunity/deal data, role/access rules, accepted diligence boundary, operator-approved records, and signed-proof metadata where applicable.
- **Landing / CTA / channels:** Landing: `/dealvault/demo`, then `/dealvault`. CTA: **See DealVault in action.** Primary channel is the guided demo. Secondary channels are website notifications, transactional Resend, operator task, and approved opportunity communication.
- **CRM lifecycle / owner / cadence:** `visitor → demo_started → demo_completed → account_created → first_record → first_collaboration → activated → retained | dormant | closed`. DealVault application owns product state; CRM owns commercial lifecycle; operator reviews restricted opportunity access. Immediate onboarding, then days 1, 3, 7, and 14 guidance based on actual missing activation steps.
- **Human/compliance:** Review opportunity access, financial/return language, compensation, sensitive documents, and third-party introductions. Never imply availability, performance, closing, or legal enforceability beyond verified facts.
- **Indicators / conversion / business value:** Demo completion, account creation, time to first record, first collaborator, proof/milestone usage, 30-day retained use, and qualified inquiry. Primary conversion: first verified DealVault record with an invited/authorized participant. Value: product adoption, retention, and transaction coordination.
- **Learning / unique stop:** Capture setup friction, unused capabilities, invite acceptance, record completion, churn reason, and assisted downstream outcomes. Stop nurture after activation, explicit no-interest, access conflict, sensitive-document issue, or dormant threshold pending reactivation review.

### 10. `service_provider_network`

**Parent:** `real_estate_professionals_providers`
**Status:** Incomplete; participant-profile foundation exists without contractor/provider-specific sourcing, quality, or outcome loop.

- **Target / problem / value:** Contractors, builders, developers, agents, wholesalers, and transaction/service specialists needing qualified, relevant opportunities. VestBlock offers a private verified profile and operator-reviewed introductions.
- **Eligibility / source data:** Role/identity, service area, capabilities, capacity, credentials/insurance where applicable, references or proof, communication and matching permissions, conflict/disclosure data, and verification timestamp.
- **Landing / CTA / channels:** Landing: `/workspace/profiles/new?role=service_provider`, with builder/developer/agent variants. CTA: **Create your service provider profile.** Primary channels after activation are website notification and operator task. Secondary channels are permissioned Outlook/Resend and manual phone task.
- **CRM lifecycle / owner / cadence:** `active_profile → capacity_current → match_review → introduction_accepted | declined → quality_review → retained | paused | removed`. `professional_participant_activation` exclusively owns draft, verification, and days 3/7 completion prompts. After the handoff at `active_profile`, this strategy owns capacity/credential refresh every 30–90 days; the operator owns qualification/introduction.
- **Human/compliance:** Verify licenses/insurance only where relevant and never represent a provider as endorsed without substantiation. Disclose referral/compensation relationships and obtain customer permission before introduction.
- **Indicators / conversion / business value:** Verified profiles, criteria freshness, match acceptance, completion, customer feedback, complaints, and repeat use. Primary conversion: operator-approved service introduction accepted by both parties. Value: service coordination, partner revenue where lawfully structured, and improved customer outcomes.
- **Learning / unique stop:** Capture service need, fit, response time, completion, quality, dispute, and repeat demand. Pause after credential expiry, unresolved complaint, repeated nonresponse, poor verified quality, capacity failure, or permission withdrawal.

### 11. `partner_referral_network`

**Parent:** `partnerships_referrals`
**Status:** Partial and duplicated; current governed referrals conflict with a legacy affiliate application and scattered embedded links.

- **Target / problem / value:** Organizations and professionals with complementary, verifiable capabilities. VestBlock offers transparent, permissioned referral coordination, measurable service quality, and disclosed economics where approved.
- **Eligibility / source data:** Verified organization/identity, capability, geographic/service fit, customer-service evidence, conflicts, referral terms, compensation/tax/disclosure requirements, and partner/contact permissions.
- **Landing / CTA / channels:** Landing: **Missing — strategy remains inactive until a governed partner-profile destination exists.** Proposed CTA for approval: **Apply to become a VestBlock partner.** Primary channel before that approval is operator-only intake/task; later secondary channels may include Outlook and manual phone task. The legacy affiliate registration path must not be promoted.
- **CRM lifecycle / owner / cadence:** `identified → invited → application → verification → terms_review → approved_test → test_referral → quality_review → active | paused | ended`. CRM owns partner record; operator/legal/business review owns terms; n8n may later dispatch approved steps. Human-first contact, then days 7 and 21 follow-up only when relevant.
- **Human/compliance:** Mandatory review of commissions, referral fees, affiliate disclosures, tax/payment data, customer consent, conflicts, and regulated-service boundaries.
- **Indicators / conversion / business value:** Verified partners, accepted test referrals, completion, customer satisfaction, attributed value, complaint rate, and repeat fit. Primary conversion: approved test referral accepted with all disclosures and permissions. Value: broader capability and attributable referral economics.
- **Learning / unique stop:** Capture referral fit, response, quality, completion, economics, disclosure, complaint, and repeat behavior. Pause on undisclosed compensation, conflict, poor service, complaint, regulatory uncertainty, nonperformance, or attribution dispute.

### 12. `investor_capital_relationships`

**Parent:** `lenders_capital_providers`
**Status:** Incomplete and duplicated; zero profiles coexist with 1,446 historical automation runs. This contract covers cross-sector capital relationships; real-estate investors acting as property buyers remain in `buyer_buy_box_activation`.

- **Target / problem / value:** Verified private-capital participants, funds, family offices, strategic capital partners, acquisition sponsors, builders, and aligned business, real-estate, or opportunity capital relationships needing qualified opportunities or partnerships. VestBlock offers criteria capture, fit scoring, and controlled introductions. Property-acquisition demand belongs to the buyer strategy; capital participation belongs here.
- **Eligibility / source data:** Verified role/entity, sectors, geography, capital/structure fit, capacity, proof path, risk/return preferences as submitted, investment/accreditation boundaries where applicable, matching/outreach permissions, and current verification.
- **Landing / CTA / channels:** Landing: `/workspace/profiles/new?role=investor`. CTA: **Create your capital relationship profile.** Primary channels after activation are operator task and website notification. Secondary channels are permissioned Outlook/Resend and manual phone task. No return-based solicitation or unreviewed opportunity blast.
- **CRM lifecycle / owner / cadence:** `active_capital_profile → relationship_review → opportunity_review → introduction_accepted | declined → diligence → relationship_active | dormant | DNC`. `professional_participant_activation` exclusively owns profile draft, verification, and completion reminders. After the handoff at `active_capital_profile`, this strategy owns relationship review every 30–60 days; the operator owns introductions.
- **Human/compliance:** Review investment, securities, return, suitability, offering, compensation, and opportunity-availability language. No autonomous investment recommendation.
- **Indicators / conversion / business value:** Verified profiles, current criteria, opportunity acceptance, diligence progression, relationship activity, and verified transaction/capital event. Primary conversion: qualified relationship accepts a reviewed introduction. Value: capital/demand network and DealVault adoption.
- **Learning / unique stop:** Capture opportunity fit, decline reason, risk/structure preference, response, diligence stage, and verified outcome. Disable the current empty automation loop until a real sourced profile contract exists; pause any profile on stale capacity, permission withdrawal, or regulatory concern.

### 13. `public_sector_opportunity_readiness`

**Parent:** `public_sector_opportunities`
**Status:** Missing canonical strategy; substantial SAM subsystem exists but is dormant and unscheduled.

- **Target / problem / value:** Qualified small businesses and partners needing help organizing relevant public-sector opportunities and making disciplined bid/no-bid decisions. VestBlock offers cited opportunity intelligence, readiness organization, and operator-reviewed next steps.
- **Eligibility / source data:** Official SAM/government sources, opportunity/agency/NAICS identifiers, posted/update/deadline timestamps, exclusions, customer-submitted capabilities, registrations, certifications, capacity, conflicts, and document status.
- **Landing / CTA / channels:** Landing: **N/A — operator/Command Center only during initial activation.** Public CTA: **Missing — strategy remains externally inactive until a customer destination is approved.** Secondary notifications may use website/Resend/Outlook only for opted-in users with a verified fit.
- **CRM lifecycle / owner / cadence:** `watchlisted → ingested → normalized → fit_screen → bid_no_bid_review → prepare_approved | no_bid → submission_review → submitted → award | lost | archived`. SAM service owns facts; operator owns bid/no-bid and any submission. Daily source refresh, weekly digest for opted-in participants, deadline-driven operator tasks.
- **Human/compliance:** Human approval for every bid/no-bid, capability assertion, certification claim, pricing, teaming, submission, and government contact. Cite the official source and never imply agency endorsement or award likelihood.
- **Indicators / conversion / business value:** Fresh relevant opportunities, verified-fit rate, readiness-gap closure, approved bid decisions, submissions, and verified awards. Primary conversion: qualified participant accepts an operator-reviewed readiness or bid/no-bid action plan. Value: service/readiness opportunity and strategic partner relationships.
- **Learning / unique stop:** Capture fit/no-fit reasons, source accuracy, deadline feasibility, document gaps, submission result, and debrief facts. Stop on expired notice, ineligible entity, conflict, missing registration, insufficient capacity, unsupported claim, or source discrepancy.

### 14. `professional_participant_activation`

**Parent:** `customer_lifecycle_growth` as a shared activation strategy feeding role-specific portfolios
**Status:** Active foundation; production has zero participant profiles and matches.

- **Target / problem / value:** Buyers, investors, lenders, builders, developers, agents, wholesalers, business buyers/sellers, and service providers who need one private, reusable criteria profile. VestBlock offers role-aware onboarding, consent control, verification, matching, and opportunity routing.
- **Eligibility / source data:** Authenticated owner, role, identity/entity, criteria, communication preferences, separate account/matching/outreach/public-display permissions, verification timestamps, provenance, and operator review state.
- **Landing / CTA / channels:** Landing: `/workspace/profiles/new?role={approved_role}`. CTA: **Create your free participant profile.** This shared activation journey owns only secure website submission, transactional confirmation, and consented days 3/7 completion reminders. It does not own post-activation marketing, matching, or opportunity outreach.
- **CRM lifecycle / owner / cadence:** Existing lifecycle: `draft → pending_review → needs_information → verified → active | paused | declined | withdrawn | archived`. Participant profile service exclusively owns this pre-activation state and cadence; the operator owns verification. At `active`, it emits one idempotent handoff to the selected role strategy and permanently relinquishes reminder/dispatch ownership. The receiving strategy owns criteria freshness, matching, and later communication.
- **Human/compliance:** Never auto-claim a legacy record by matching email alone. Keep matching, outreach, public visibility, and marketing permissions independent. Review public fields and introductions.
- **Indicators / conversion / business value:** Start/completion, verification, activation, time to first reviewed match, consent choices, freshness, and cross-lane participation. Primary conversion: verified active profile with explicit matching permission. Value: reusable network supply/demand and cleaner CRM identity.
- **Learning / unique stop:** Capture role-specific abandonment, verification issue, match quality, criteria change, and permission behavior. Stop on identity conflict, ownership dispute, missing verification, permission withdrawal, or stale role criteria.

### 15. `content_authority_intelligence`

**Parent:** `content_visibility`
**Status:** Active but split across AEO, SEO, entity visibility, publishing, indexing, PR, and research systems.

- **Target / problem / value:** Prospective customers and participants seeking accurate, financially literate guidance and relevant VestBlock paths. VestBlock publishes cited, useful education and market/industry intelligence tied to real customer decisions.
- **Eligibility / source data:** Current primary/authoritative source, approved research brief, claim evidence, reviewed audience intent, approved VestBlock destination, content/version metadata, and refresh date.
- **Landing / CTA / channels:** Landing: the cited VestBlock content page, with `/next-move` as the required default conversion destination when no more specific approved path applies. Default CTA: **Build my free Next Move roadmap.** Primary channels are the VestBlock website and `buffer_vestblock` on official VestBlock accounts only. Secondary channels are opted-in Resend digest, PR/operator outreach, and indexing tools. A content version is inactive if it lacks an explicit live destination and CTA.
- **CRM lifecycle / owner / cadence:** `research → brief → drafted → reviewed → approved → published → indexed → qualified_visit → assisted_conversion → refresh_due | retired`. Content service owns artifacts; human editor owns claims/publishing; CRM owns attributed conversion. Daily intelligence intake, weekly editorial review, source-dependent refresh SLA.
- **Human/compliance:** Review financial/credit/investment claims, statistics, case studies, affiliate disclosures, regulated topics, and PR pitches. Do not publish internal strategy language, fabricated proof, or AI-slop.
- **Indicators / conversion / business value:** Qualified visits, CTA engagement, questionnaire/profile/intake starts, completion, assisted conversions, citation/visibility growth, and content freshness. Primary conversion: qualified visitor enters and completes an approved customer path. Value: lower-cost acquisition, trust, authority, and partner demand.
- **Learning / unique stop:** Capture topic, source, format, audience, channel, destination, engagement, assisted progression, and refresh performance. Retire or revise on stale source, broken destination, unsubstantiated claim, sustained zero qualified progression, or brand/compliance regression.

### 16. `customer_lifecycle_orchestration`

**Parent:** `customer_lifecycle_growth`
**Status:** Missing canonical strategy; partial workspace, tasks, reply memory, and lifecycle monitor exist.

- **Target / problem / value:** Customers and participants who started but did not complete a valuable action, have stale criteria, need a next step, or can benefit from an appropriate cross-lane route. VestBlock provides timely, relevant assistance rather than generic nurture.
- **Eligibility / source data:** Registered customer/profile/case, lifecycle event, incomplete or stale state, explicit channel permission, prior contact history, suppression result, destination health, next-best approved action, and owner/task capacity.
- **Landing / CTA / channels:** Landing: **N/A — internal lifecycle control plane.** CTA: **N/A — this controller does not publish or send.** It attaches the exact verified destination/CTA owned by the receiving strategy to a reviewable task; there is no generic homepage fallback.
- **CRM lifecycle / owner / cadence:** `triggered → eligible → owner_assigned → task_proposed → receiving_strategy_accepted → routed | suppressed | closed`. The CRM computes eligibility/caps and creates an idempotent proposal only. The selected active strategy version must accept ownership before any communication; that strategy alone owns message, cadence, destination, dispatch, response, and outcome. This controller cannot call n8n or a channel adapter directly.
- **Human/compliance:** Review cross-lane financial/credit/investment offers, dormant reactivation after long inactivity, and any change in purpose. Transactional notifications cannot be repurposed as marketing.
- **Indicators / conversion / business value:** Completion recovery, stale-profile refresh, reactivation, qualified cross-lane conversion, task closure, complaint/opt-out rate, and incremental verified value. Primary conversion: eligible inactive participant completes the intended action or accepts an appropriate route.
- **Learning / unique stop:** Capture trigger, delay, path, contact history, response, next action, completion, cross-lane fit, and complaint. Stop after path-specific cap, any response needing human handling, completion, suppression, or evidence that reminders reduce trust.

### 17. `business_acquisition_network`

**Parent:** `business_buyers_sellers`
**Status:** Canonical v1 contract exists; executable confidential intake, opportunity model, matching, and destination are missing.

- **Target / problem / value:** Business owners considering a confidential sale and verified prospective buyers seeking appropriate acquisitions. VestBlock offers permissioned confidential intake, qualification, matching, and operator-led introductions; acquisition financing may cross-route to Capital.
- **Eligibility / source data:** Verified role/authority, confidentiality consent, business summary or acquisition criteria, geography/industry/size, timing, capacity/proof path, conflicts, permitted disclosure fields, and separate matching/outreach permissions.
- **Landing / CTA / channels:** Landing: **Missing — strategy remains inactive until an approved confidential business-acquisition intake exists.** Proposed CTA for approval: **Request a confidential business acquisition review.** `/capital?path=business-acquisition` remains a financing route, not the matching destination. Future primary channels are the secure website/operator task; secondary channels are permissioned Outlook/Resend.
- **CRM lifecycle / owner / cadence:** `confidential_intake → identity_verified → qualified → opportunity_prepared → matching → operator_review → introduction_accepted → LOI | diligence → closed | withdrawn | disqualified`. Business opportunity service/CRM must own records; operator owns disclosure and introduction. Human-first review, then consented days 7/21 follow-up.
- **Human/compliance:** Review confidentiality, authority, valuation language, securities/business-broker/licensing issues, financing claims, compensation, conflicts, and every disclosure/introduction.
- **Indicators / conversion / business value:** Qualified confidential intakes, criteria completeness, reviewed matches, accepted introductions, LOI/diligence progression, and verified close. Primary conversion: both parties accept a controlled confidential introduction. Value: advisory/referral opportunity and Capital/DealVault cross-lane usage.
- **Learning / unique stop:** Capture match fit, disclosure stage, decline reason, price/structure gap, capacity, diligence, and verified outcome. Stop on confidentiality conflict, authority dispute, unsupported valuation, identity mismatch, permission withdrawal, or legal/licensing uncertainty.

## Identifier crosswalk required in Gate 3

### Seller execution tactics

The 17 tactic IDs in `lib/admin/strategyExecutionCatalog.ts` must become versioned children or source tactics under `seller_property_acquisition`/`property_opportunity_discovery`:

- `preforeclosure-equity`
- `tax-code-stack`
- `tax-remote-equity-rotation`
- `lien-equity`
- `probate-vacant-equity`
- `portfolio-landlord`
- `small-multifamily-portfolio`
- `builder-infill-teardown`
- `land-wholesale`
- `vacant-equity`
- `seller-finance-free-clear`
- `subject-to-low-equity`
- `hybrid-equity-bridge`
- `novation-retail-equity`
- `absentee-equity-creative`
- `active-stale-creative`
- `active-stale-lowball` (currently disabled)

`lib/dealmachine/v2-strategy-catalog.mjs` duplicates these definitions. The native DealMachine adapter must consume canonical contracts rather than own a second strategy catalog.

### Command Center/autopilot tactics

The 14 private IDs in `lib/admin/autonomousOperatingCore.ts` must crosswalk to the relevant operating strategy and version. They may not remain an independent registry.

### City scenarios

The 33 IDs in `lib/admin/cityScenarioStrategyCatalog.ts` should become recommendation tags/segments. They must not independently enroll, message, or learn without an approved operating-strategy version.

### Customer paths

- Fourteen Next Move focus plans remain journey variants under `next_move_free_roadmap`, `credit_education_support`, or `business_formation_readiness`.
- Six Capital paths remain intake variants under `capital_readiness_intake` or `lender_provider_criteria`.
- Navigation scenarios remain presentation/routing constructs, not CRM strategies.

## Website and CRM decisions for Gate 3

### Preserve the approved platform architecture

The public navigation remains Capital, Real Estate, Opportunity, and DealVault, with Next Move as the broad free entry. Gate 3 must not narrow VestBlock into a real-estate-only company or rebrand the site.

### Canonical journey decisions

- Buyer and lender/provider signup should converge on role-aware participant profiles.
- `/buyers` and `/lenders` require an explicit migration/bridge decision before removal because they write legacy models.
- Next Move recommendations must stop routing users into conflicting old records.
- Capital provider intake should bridge to one provider profile, not create a third identity model.
- The current business-acquisition Capital path is financing-only; it cannot stand in for confidential business matching.
- DealVault needs an activation journey, not only product pages.
- Partner/referral and public-sector strategies need approved destinations before any outreach.

### CRM crosswalk

Gate 3 must define, without deleting history:

- one canonical identity and entity crosswalk;
- customer owner versus operator owner;
- links from legacy `leads`, `buyers`, `lenders`, and investor models to new cases/profiles;
- portfolio ID, operating-strategy ID, strategy-version ID, message version, destination, and attribution on every new enrollment;
- append-only lifecycle events;
- source provenance and freshness;
- channel permission and suppression decisions;
- opportunity/case/match and verified-value attribution.

## Automation conflicts and Gate 4 candidates

These are inventory decisions only. Gate 2 did not stop or delete them.

### Active Mac Pro LaunchAgents

- `io.vestblock.distress-stack` targets the authoritative repository but is failing its primary-host guard.
- `io.vestblock.public-distress-daily` runs from the separate non-git `/Users/mrsanders/VestBlockOps` copy and performs CRM writes.
- `io.vestblock.on-market-creative-daily` also runs from `/Users/mrsanders/VestBlockOps`; sending is disabled, but real ingestion/review writes occur.

The two `/Users/mrsanders/VestBlockOps` jobs are a source-of-truth conflict even where current script hashes match. Gate 4 should capture dependencies, stop schedules safely, and repoint retained behavior to one authoritative application-controlled owner.

### Other cancellation/consolidation candidates

- Empty investor automation loop: 0 profiles but 1,446 historical runs and 625 failures. Disable until a real input/ownership contract exists.
- Duplicate DealMachine strategy catalog: remove after canonical consumers are migrated.
- Legacy affiliate registration: quarantine pending approved commission, disclosure, payout, tax, and governance decisions.
- Broken distress-stack host configuration and stale `config/primary-machine.json`: repair or retire after dependency audit.
- Old routes/models for buyers, lenders, sellers, roadmaps, and funding: bridge/migrate before removal.
- Historical DealMachine export source events: preserve for audit but exclude from freshness and current KPI logic.
- PR and SAM cron routes: remain unscheduled until their strategies and owners are approved.

### Retained scheduled foundations

Vercel currently schedules fourteen jobs. Strategy-source orchestration and ATTOM enrichment perform real writes. Strategy execution and partner-network pipelines are designed to remain dry-run unless explicitly enabled. AEO, entity visibility, publishing, indexing, mailbox sync, and improvement review have active schedules. Gate 4 must inventory exact production environment values and last success before making changes.

No GitHub Actions or database `pg_cron` strategy executors were found.

## Proposed Gate 3 implementation order

Gate 3 should remain completion-gated internally.

### Gate 3A — registry contract and crosswalk

1. Add the two proposed portfolio IDs, pending founder approval.
2. Add a versioned operating-strategy contract with one parent portfolio.
3. Add stable crosswalks for historical tactic/scenario/journey identifiers.
4. Require one website destination, CRM lifecycle, automation owner, and outcome contract per operating version.
5. Add schema/code validation that rejects an unmapped new strategy key.
6. Test version activation, supersession, historical preservation, and fail-closed behavior.

Stop and report 3A evidence before 3B.

### Gate 3B — complete operating contracts

1. Implement the 17 contracts in this report as reviewable versions.
2. Replace generic hypotheses with lane-specific objectives, qualification, cadences, indicators, learning inputs, and stop rules.
3. Define the canonical route/CTA decision for every strategy; unresolved/missing routes remain inactive.
4. Mark missing credentials/integrations without fabricating operation.
5. Keep all external-send caps at zero.

Stop and report 3B evidence before 3C.

### Gate 3C — governed learning design

1. Connect execution/outcome records to strategy-version IDs.
2. Define attribution from source → enrollment → orchestration → delivery/reply → case/match stage → verified value.
3. Generate proposals from evidence without auto-changing material strategy.
4. Establish minimum-sample and two-window safeguards.
5. Project the approved registry into Obsidian with correct metadata/counts.
6. Add focused tests and a before/after registry comparison.

Stop and report Gate 3 completion before any Gate 4 automation cancellation.

## Gate 2 completion evidence

- Authoritative Mac Pro repository inspected at `97a67e6a`.
- Worktree was clean before this documentation commit.
- Ten current versioned portfolio lanes confirmed in repository, production Supabase, and Obsidian.
- All required Gate 2 business areas classified.
- Complete proposed operating contracts supplied for 17 strategies.
- Website destinations, CRM stages, owners, cadences, channels, approvals, compliance, indicators, conversions, value, learning inputs, and stop rules defined.
- Conflicting catalogs and runtime owners identified.
- n8n accurately classified without copying browser cookies or purchasing an upgrade.
- No production data, workflow, send setting, automation, deployment, or outreach changed.

## Approval boundary

Gate 2 ends with this report. Gate 3 must not begin until the founder approves the proposed 12-portfolio hierarchy, 17 operating-strategy contracts, and internally gated Gate 3A → 3B → 3C sequence.
