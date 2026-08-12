# VestBlock toolbelt matrix

This is the operating inventory for the approved unified platform. A tool is only active when its credential, owner, purpose, data boundary, and approval gate are documented.

| Lane | Tool | Status | Credential / owner action | Boundary |
| --- | --- | --- | --- | --- |
| Hosting | Vercel | Connected to canonical project | Keep project and environment linkage | Deploy only after release approval |
| Product intelligence | OpenAI | Configured in Vercel | Rotate any client-exposed key; server-only `OPENAI_API_KEY` | No autonomous external action |
| CRM / database | Supabase | Connected | Add `CRM_IDENTITY_HASH_SECRET`; apply CRM migration only with approval | RLS, HMAC identifiers, audit log |
| Email | Resend | Configured | Verify sending domain, webhook secret, and from address | Permissioned, suppression-checked sends |
| Inbox | Outlook / Graph | Operator setup required | Graph app registration, tenant consent, client secret/certificate | Draft-first; no send without approval |
| Workflow | n8n | Operator setup required | Signed workspace and scoped webhook credentials | Preview and approval gates |
| Social | Buffer | Use VestBlock socials only | Connect only VestBlock-owned profiles | No unrelated brand accounts |
| Knowledge | Obsidian | Vault operator available | Keep vault path and backup policy documented | No raw PII in notes |
| Security | Strix / CI checks | Available | GitHub Actions permissions and review owner | Scan, report, fix; no blind auto-merge |
| Payments | PayPal | Configured | Verify webhook and production mode before launch | Reconcile against server-side events |
| Observability | Vercel logs / Sentry | Verify before release | Sentry DSN and auth token if retained | Never log secrets or raw PII |
| Retired | PostHog, Twilio, Postiz | Removed from active runtime | Revoke stale production credentials after approval | Do not reintroduce without decision record |

Required before outreach pilot: CRM hash secret, verified sending domain, Outlook/Graph consent, n8n webhook scopes, Buffer VestBlock accounts, suppression data, and a human approver.
