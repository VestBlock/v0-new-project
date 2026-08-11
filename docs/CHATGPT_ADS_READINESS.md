# ChatGPT Ads readiness

## Current state

- Business: Vestblock LLC.
- Website: `https://vestblock.io`.
- Advertiser category: Financial Services.
- Country, currency, and timezone selected in Ads Manager: United States, USD, and Chicago/Central.
- Advertiser type: business advertising only for itself, not an agency.
- Advertiser account `adacct_6a7aa3a3b07c819cb32b76dc60a2233e` has been created after the founder explicitly authorized acceptance of OpenAI's Advertising Terms.
- The `VestBlock reporting` account-scoped API key is stored in the ignored Mac Pro env file and as a Sensitive Vercel production variable. A live read-only request authenticated and returned the active advertiser account.
- The restricted financial-services review currently reports `rejected`; this blocks launch readiness even though reporting authentication works.
- Ads Manager is paused at the first-campaign ad-group step. The displayed default $4 maximum CPC bid was not accepted or changed.
- No campaign, budget, bid, payment method, ad spend, or published creative has been created by this integration.

## Production integration

VestBlock has a read-only Ads API adapter for account status, review status, and 30-day campaign insights. It intentionally has no campaign creation, bid, budget, billing, or spend mutation method.

Required environment variables:

- `OPENAI_ADS_API_KEY` — configured and live-proven account-scoped reporting key.
- `OPENAI_ADS_PIXEL_ID` — optional measurement identifier after the consent and event plan are approved.
- `OPENAI_ADS_CONVERSIONS_API_KEY` — optional server-side conversions credential after the consent and event plan are approved.

## Launch gates

1. OpenAI approves Vestblock LLC for the restricted financial-services category and any requested verification is completed.
2. Landing page and creative pass the claim guardrails in `.agents/product-marketing.md`.
3. Attribution, consent, UTM naming, conversion definitions, and suppression rules are reviewed.
4. Founder separately approves campaign objective, audience, creative, landing page, total budget, bid/cost controls, dates, and launch.

## Policy-safe first direction

Lead with the VestBlock platform or an educational journey: organizing a buy box, understanding funding-review readiness, submitting property context, or joining a partner network. Do not advertise credit repair or debt settlement, promise financial outcomes, or promote a named individual property listing. Keep all capital claims subject to review and underwriting.

## Attribution plan

Use a dedicated landing journey, campaign/ad-group/ad UTMs, first-party lead source fields, and consent-aware browser/server events. Tie qualified leads and downstream outcomes back to campaign identifiers in the founder cockpit. Report first; automate optimization only after sufficient clean data and a founder-approved policy.
