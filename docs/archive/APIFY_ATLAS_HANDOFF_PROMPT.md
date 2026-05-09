You are helping wire Apify into the VestBlock codebase.

Important context:

- VestBlock already has a working lead engine in Next.js + Supabase.
- It already uses source-specific connectors and daily automation flows.
- Business lead scraping currently prefers Outscraper in `/Users/mrsanders/Downloads/Codex Folder/lib/leads/dailyAutomation.ts`.
- We do NOT want to replace Outscraper for Google Maps if it is already working well.
- We want Apify to expand coverage for harder sources that benefit from browser/session-aware crawling, multi-page crawling, or durable actor runs.
- We want Apify to feed the existing normalized lead pipeline, not create a second lead system.

Your task is to give Codex exactly what it needs to wire Apify cleanly.

Please provide:

1. Apify account/env details
- the exact environment variable name we should use for the token
- confirmation that the token is active
- any proxy/geolocation settings we should use by default
- any monthly usage or run-budget limits we should respect

2. Which Apify actors we should use first
Rank the top 3-5 actors we should use for VestBlock by ROI.

Prioritize actors that help with:
- local business directories
- niche directories
- public business listing sites
- harder real-estate / buyer / lender discovery sources
- multi-page business discovery where simple fetch scripts are brittle

Do NOT prioritize actors that duplicate our current Outscraper Google Maps flow unless they are clearly better for a specific use case.

For each suggested actor, provide:
- actor name / store URL
- what source it covers
- why it is a good fit for VestBlock
- whether it needs login/session/proxy handling
- the expected output fields
- the best use case inside VestBlock

3. Recommended first integration target
Choose the single best first Apify integration target for VestBlock.

Pick something that:
- expands lead volume or lead quality
- fits the current codebase
- does not require a giant rewrite
- maps cleanly into our normalized lead structure

Explain why it should be first.

4. Input/output examples
For the best first actor, provide:
- a sample actor input JSON
- a sample output record
- any notes on pagination, deduping, geotargeting, or rate limits

5. Mapping guidance for VestBlock
Map the actor output into this normalized lead shape:

{
  source,
  category,
  externalId,
  name,
  businessName,
  propertyAddress,
  mailingAddress,
  phone,
  email,
  website,
  city,
  state,
  zip,
  languageSignal,
  painSignal,
  contactInfo,
  formData,
  metadata
}

Call out:
- which fields are usually reliable
- which fields are often missing
- what enrichment should still happen after ingest

6. Safe implementation notes
Tell us:
- whether the actor should run synchronously or as a background run + dataset fetch
- whether results come back in dataset items or another shape
- whether dedupe should key on URL, business name + city, external ID, or something else
- what failure cases Codex should guard against

7. Keep the recommendation practical
Do not suggest a large architecture rewrite.
Do not recommend replacing the current lead engine.
Do not recommend using Apify everywhere.
Recommend the smallest high-value integration first.

Output format:

- short summary
- recommended first actor
- ranked actor list
- exact env/config needed
- sample input/output
- VestBlock mapping notes
- implementation cautions
