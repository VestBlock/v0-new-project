# VestBlock Strategy Brain

Status: schema v2 release candidate
Updated: 2026-08-11

## Purpose

The Strategy Brain compares every VestBlock business lane using the same evidence, cost, compliance, approval, and attribution model. It recommends the smallest useful move; it does not silently grant itself authority to send, publish, spend, deploy, charge, alter data, or make regulated claims.

## Nine business verticals

The canonical registry lives in `lib/autopilot/verticalRegistry.ts`:

1. Business capital
2. Real-estate capital
3. Capital partners
4. Seller opportunities
5. Buyers and investors
6. Development partners: wholesalers, acquisition teams, builders, contractors, and developers
7. Opportunity and service partners
8. DealVault
9. Growth and visibility services

Business vertical, acquisition channel, and strategy type are separate fields. Email, SEO, AI search, social, partnerships, referrals, paid media, events, direct, and in-product are channels—not businesses. Research, acquisition, activation, conversion, partner development, retention, reactivation, and content are strategy types—not customer lanes.

Each registry entry defines the offer, ideal customer and decision-maker, problem and buying moment, triggers, qualifications, disqualifiers, approved proof, claim limits, offer ladder, primary and secondary CTAs, lawful lead sources and required lineage, channel mix, content pillars, outreach angles, objections, KPIs, cost boundaries, compliance rules, approval mode, and kill criteria.

## Evidence contract

Every observation has:

- a system/source name;
- a metric;
- a value;
- an observation time;
- quality of `verified`, `partial`, or `missing`;
- a caveat when the source is a proxy or attribution is incomplete.

The strategy receives one of three evidence states:

- `sufficient`: at least one relevant source is verified;
- `partial`: evidence exists, but a proxy or connection still needs confirmation;
- `research_required`: the vertical-specific baseline is absent.

Missing evidence creates a research task with a system-of-record, lineage, baseline, and outcome requirement. It must not produce an invented claim, audience, result, or launch plan.

## Portfolio rule

The score remains explainable:

`impact × 30% + confidence × 25% + speed × 15% + inverse cost × 10% + inverse difficulty × 10% + inverse risk × 10%`

Only two eligible strategies are promoted at once:

- `focus`: highest score;
- `challenger`: next-highest score.

Other eligible strategies remain `backlog`. Missing-evidence work remains `research`. Scoring does not override approval or compliance.

## Strategy object and authority

Schema v2 stores:

- vertical, strategy type, and channels;
- hypothesis, audience, problem, tactic, expected outcome, and score;
- structured evidence and research requirements;
- portfolio role;
- draft outreach angles and suppression requirement;
- claims, lineage, and human-review state;
- next actions, owner, estimated cost, and cost boundary;
- primary/secondary KPIs, attribution keys, evaluation window, and kill criteria;
- results, lessons, and next iteration.

Every generated strategy starts with:

- `approval.mode = human_required`;
- `approval.status = draft`;
- `launch = false`;
- `send = false`;
- `publish = false`;
- `spend = false`;
- `launchAuthority = not_granted`.

Approving a strategy allows creation of a planned campaign record only. The campaign keeps `cost_guardrail_status = approval_required` and does not grant provider execution.

## Current evidence behavior

The weekly builder produces one record for all nine verticals. The current Command Center can ground seller replies, buyer/lender matches, partner counts, builder counts, deal-pipeline proxies, and content/search readiness. Business-capital and real-estate-capital vertical-specific aggregates are missing in the current snapshot, so those lanes correctly produce research tasks.

## Learning loop

Measured results keep strategy ID, campaign-run ID, source, opportunity/conversion counts, revenue, lesson, and next iteration linked in experiment memory. The Boss retrospective now creates a valid `improvement_runs` parent, uses supported severity values, and checks insert/update failures instead of silently discarding lessons.

Obsidian remains a read-only projection. Strategy notes include evidence state and portfolio role, while value-level email, phone, SSN, street-address, and credential patterns are redacted before any generated file is written. The export never receives launch or publishing authority.
