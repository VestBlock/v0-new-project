# SaaS Conversion Prompt

Use this prompt when you want Codex or another strong coding model to turn VestBlock into a more out-of-the-box software/SaaS product.

## Prompt

```text
You are my senior product engineer, SaaS operator, growth strategist, and conversion-focused UX lead.

I need you to turn my current platform into something that feels as close to right-out-of-the-box software/SaaS as possible, while preserving the existing business lanes that matter:

- service businesses buying visibility expansion
- service businesses buying AI receptionist / booking automation
- business owners seeking funding readiness
- lenders and buyers using deal-flow or partner workflows
- home sellers submitting property opportunities

Important business context:

- Credit repair is low priority and should not be the front-door story.
- The product should feel modern, productized, self-serve, and easy to start.
- I still want small businesses, lenders, buyers, and sellers to feel like they are in the right place.
- The product can still include done-with-you or higher-touch services, but the experience should move toward software first, services second.

Your mission:

Audit the existing product and systematically convert it from “request-based service business” into “as close to real self-serve SaaS as possible.”

What I want from you:

1. Start by auditing the codebase and current user journeys.
2. Identify what already exists that can support true SaaS behavior:
   - self-serve onboarding
   - account creation/login
   - dashboards
   - saved outputs
   - progress tracking
   - recurring usage
   - deliverables users can view inside the app
   - anything that can become immediate product value after signup
3. Identify what still makes the product feel like a service intake business instead of software:
   - request forms with no instant value
   - weak activation
   - no post-signup guided workflow
   - unclear product boundaries
   - generic or mixed homepage messaging
   - hidden or non-existent client onboarding
4. Propose the fastest path to a stronger SaaS experience without rewriting everything.

Priorities:

1. Make the first-time user experience feel product-led.
2. Give users immediate value right after signup or first form completion.
3. Turn each core business lane into a clearer software flow:
   - Visibility Expansion
   - AI Receptionist / Booking
   - Funding Readiness
   - Buyer / Lender / Seller deal flow
4. Reduce reliance on “wait for follow-up” wherever possible.
5. Keep the brand broad enough for small businesses, lenders, buyers, and sellers, but make the UX feel focused and intentional.

Deliverables I want from you:

1. A blunt product audit:
   - what feels like SaaS already
   - what still feels like a manual service business
   - what is hurting conversions the most
2. A concrete SaaS conversion roadmap:
   - immediate fixes
   - short-term productization changes
   - medium-term self-serve feature upgrades
3. A recommended product architecture for the front door:
   - homepage positioning
   - primary CTAs
   - role/lane routing
   - how to present visibility, receptionist, funding, buyers/lenders, and sellers without confusion
4. A recommended activation flow for each lane.
5. Actual implementation work in the codebase, not just ideas.

Execution rules:

- Do not give me vague advice.
- Do not stop at analysis if there are obvious product improvements you can implement.
- Reuse what already exists in the repo whenever possible.
- Prefer shipping real improvements over proposing giant rewrites.
- Keep the product compliant and avoid guaranteed-result language.
- Preserve important existing flows unless they clearly hurt the new SaaS direction.
- Treat this like a conversion and productization sprint.

Specific things to look for and improve:

- homepage hero and first-scroll positioning
- pricing structure and package framing
- signup/login friction
- dashboard usefulness after login
- what users see immediately after requesting a service
- whether deliverables can be shown in-app instantly
- whether forms can generate instant plans, audits, scorecards, or next-step outputs
- whether there should be a lane selector or guided onboarding at the top
- whether “request” flows can become “generate my plan” flows
- whether the app can give a sample deliverable or preview before asking for contact info

Output format:

1. Start with the most important conversion and SaaS blockers.
2. Then give the exact implementation plan.
3. Then make the highest-leverage code changes.
4. Then verify the new flows and explain what changed.

If you need a framing assumption, use this:

VestBlock is becoming a productized operating system for:
- growth systems for service businesses
- capital readiness for operators
- partner and deal-flow routing for lenders, buyers, and sellers

The product should feel like software first, services second.
```

## Recommended Usage

Paste the prompt above into Codex after opening the repo, then add one short instruction like:

- `Start with the fastest path to a product-led onboarding experience.`
- `Focus on visibility expansion and AI receptionist first.`
- `Convert request-based flows into self-serve plan-generation flows where possible.`
- `Make the homepage and post-signup experience feel like real SaaS.`

## Best Follow-Up Prompt

After the first pass, use:

```text
Keep going. Do not broaden the scope. Stay focused on making the app feel more like immediate-use SaaS. Prioritize activation, dashboard usefulness, guided onboarding, and instant output after signup or form completion.
```
