# VestBlock Credential and Account Checklist

**Checked:** 2026-08-11 from Robert's MacBook Air against the primary Mac Pro and linked Vercel production project  
**Rule:** Never paste credentials into Codex chat, GitHub, Obsidian, screenshots, or documentation. Store local values in `.env.local` and deployment values in Vercel's encrypted environment settings.

Run the non-secret inventory at any time:

```bash
pnpm run credentials:check
```

## Completed and live-proven

- **Resend:** API authentication passed; two domains are verified. The existing `vestblock.io` webhook is enabled, its signing secret is stored in the ignored Mac Pro env file, and it subscribes to delivery, reply (`email.received`), and suppression events.
- **Gmail:** OAuth was reauthorized for only `gmail.readonly` and `gmail.send`. Mailbox metadata is readable, and the replacement refresh token is stored locally and updated as a Sensitive Vercel production variable.
- **Search Console:** OAuth passed, one property is visible, and it matches the configured VestBlock property.
- **Sentry:** API authentication passed.
- **Vercel:** The Mac Pro is linked to the correct production project and its saved CLI authentication works through `pnpm dlx vercel`.
- **Outlook / Microsoft Graph:** a separate `VestBlock local agent mailbox sync` client secret was created for the existing `VestBlock Mailbox Automation` app. The Mac Pro and Sensitive Vercel production variables are configured, and a live client-credentials proof read `contact@vestblock.io` inbox metadata (15,417 items reported). The prior production secret was retained for rollback; neither secret was printed.
- **OpenAI:** the Mac Pro key authenticated and completed a minimal live generation request with HTTP 200. Vercel retains its existing multi-environment key; no deployment was triggered.
- **ChatGPT Ads reporting:** the `VestBlock reporting` account-scoped key authenticated to active advertiser account `adacct_6a7aa3a3b07c819cb32b76dc60a2233e`. It is stored in the ignored Mac Pro env file and as a Sensitive Vercel production variable. The financial-services review is rejected, so launch remains blocked; no campaign, billing, or spend was authorized.
- **n8n:** workflow `wyi6LMTPGkhZCYYa` is published with `x-vestblock-secret` Header Auth. Mac Pro and Sensitive Vercel production values are configured, and one signed live request returned HTTP 202 in preview mode with no downstream write.
- **GitHub CLI on the MacBook Air:** authenticated as `VestBlock` with `gist`, `read:org`, `repo`, and `workflow` scopes. Read-only verification confirmed `ADMIN` access to `VestBlock/v0-new-project`.

## Do these next

1. **Replace PayPal REST credentials.** Both the local and Vercel production client pair return `invalid_client` against sandbox and live. Create a new PayPal REST app, decide sandbox versus live, then replace `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and set `PAYPAL_MODE`.
2. **Finish ChatGPT Ads eligibility.** Advertiser account `adacct_6a7aa3a3b07c819cb32b76dc60a2233e` is created for `Vestblock LLC` with `https://vestblock.io` and Financial Services, and read-only API reporting is live. The restricted-category review currently reports `rejected`. Resolve that review before adding billing or preparing a launch. Add `OPENAI_ADS_PIXEL_ID` and `OPENAI_ADS_CONVERSIONS_API_KEY` only after measurement consent and the conversion plan are approved.
3. **Keep Buffer approval-gated.** The active key named `vestblock socials` is stored securely with the connected VestBlock Facebook channel. Do not use the Shoe Glitch channels. Drafting and internal calendar work may run automatically; scheduling and publishing still require approval.
4. **Repair Google Ads verification and reporting.** The Google account shows an existing campaign but says advertiser verification is required before ads can restart. Then add `GOOGLE_ADS_CUSTOMER_ID` and `GOOGLE_ADS_DEVELOPER_TOKEN`; run only the report preview before any account mutation.
5. **Protect the n8n continuity window.** The n8n trial showed 14 days remaining when the bridge was activated. Select a paid plan or export the reviewed workflow before the trial ends. Do not add downstream write nodes without a separate review and approval.

## Next, only for lanes you plan to activate

| Lane | Needed | Current state |
| --- | --- | --- |
| ChatGPT Ads reporting | `OPENAI_ADS_API_KEY` | Configured and live-proven against the Vestblock LLC advertiser account; restricted-category launch review remains rejected. |
| ChatGPT Ads conversion measurement | `OPENAI_ADS_PIXEL_ID`, `OPENAI_ADS_CONVERSIONS_API_KEY` | Configure only after consent, event definitions, and account approval. |
| Social distribution | `BUFFER_API_KEY`, `BUFFER_FACEBOOK_CHANNEL_ID` | Configured for VestBlock Facebook only; no post was scheduled or published during setup. |
| High-volume outreach | `INSTANTLY_API_KEY` | Missing; optional until a campaign is approved. |
| DealMachine webhook | `DEALMACHINE_WEBHOOK_SECRET` | Present as Sensitive in Vercel production; unavailable to local scripts unless separately provisioned. |
| Video rendering | Select one approved provider, account, API key, spend cap, and output/storage policy | No provider selected. |
| Google Ads API manager access | Manager customer ID plus OAuth access to the client account | Only required for direct API automation; keep report-only initially. |

## Already present by environment name

- Supabase URL, anonymous key, and service role key
- Resend outbound key and sender
- Google OAuth client, correctly scoped Gmail refresh token, Workspace sender, and verified Search Console property URL
- DealMachine API/web token
- Outscraper, Apify, Google Places, Hunter, RentCast, and SAM.gov discovery keys
- PayPal client, secret, and webhook ID (present but invalid; replace them)
- PostHog and Sentry configuration
- OpenAI key (live generation verified)
- OpenAI Ads reporting key (live account authentication verified)
- Microsoft Graph app credentials and acquisitions mailbox (live mailbox metadata verified)

“Present” means a non-empty environment name was detected; it does not prove that a token is valid, correctly scoped, unexpired, or connected to the intended production account.

## Account and non-secret setup

- Obsidian requires no cloud credential. Its CLI is enabled locally and agents should use `pnpm run obsidian:agent -- ...`.
- GitHub CLI on the MacBook Air is authenticated as `VestBlock`; the Mac Pro CLI remains unauthenticated. Do not copy the Air token to the Pro—run a separate least-privilege device authorization there only when Mac Pro repository automation is approved.
- Vercel does not need a global install: `pnpm dlx vercel` is authenticated and linked. Sensitive Vercel variables cannot be read back or pulled locally; rotate/provision a separate local credential rather than copying a placeholder.
- n8n is connected through a reviewed TLS webhook, Header Auth, and a signed envelope. Keep execution history observable, export backups, rotate the shared secret through both Mac Pro and Vercel together, and retain preview-only behavior until downstream actions are separately approved.
- Twilio has been removed from the seller-lead API and the active credential plan. Provider-neutral manual phone follow-up may remain, but VestBlock has no live SMS sender.
- Set explicit budgets, daily caps, and alert recipients before enabling OpenAI auto-recharge, ads, enrichment, or video spend.
- Rotate the `vestblock socials` Buffer key before its displayed September 9, 2026 expiration, then update both the Mac Pro and the Sensitive Vercel production variable.
