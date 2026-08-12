# VestBlock API and Integration Risk Matrix

Status: release-candidate control map
Updated: 2026-08-11

## Decision rules

- Public calculators may return a result, but they may not write operator memory or another user’s records.
- Account-specific and cost-bearing routes require an authenticated user, same-origin mutation, bounded input, and server-derived identity.
- Admin routes require a configured administrator identity or trusted Supabase Auth `app_metadata.role`; `user_profiles.role` is not an authorization source.
- Provider callbacks must be verified before parsing them into a privileged action.
- Live send, publish, spend, deployment, contract, payment, refund, and destructive data actions fail closed and require separate approval.

| Surface | Exposure | Cost or write | Release-candidate control | Remaining production requirement |
|---|---|---|---|---|
| `/api/create-order` | Signed-in user | Creates PayPal order; links profile/request | Same-origin; identity derived from session; product and request validated; `vb2` binding records user, product, request, amount, and currency | Verify PayPal merchant configuration in preview; do not use a real charge |
| `/api/capture-order` | Signed-in user | Captures payment; grants entitlement; writes payment/task | Fetches original order; verifies ownership, custom binding, amount, currency, profile/request link, capture, and idempotency; ignores capture-time product override | Apply reviewed unique-index migration after duplicate precheck; run provider sandbox test |
| `/api/property-analyzer` | Public calculation | Optional service-role Command Center write | Public analysis is read-only; persistence requires administrator access; source/lead attachment stays operator-only | Add distributed rate limiting before high-volume production promotion |
| `/api/biz-credit` | Signed-in user | PDF/storage/database | Middleware auth and same-origin; server replaces caller `user_id` with session user | Add per-user daily budget and job timeout telemetry |
| `/api/generate-pdf` | Signed-in user | PDF.co spend and document write | Middleware auth and same-origin; server derives document owner; HTML/file limits and 20-second timeout; provider details not returned | Add per-user and per-IP distributed budget |
| `generate-roadmap`, `generate-letter`, `side-hustle-chat` | Signed-in user | OpenAI spend | Middleware auth and same-origin | Add shared distributed rate/cost limiter and route-specific payload ceilings |
| `/api/webhooks/dealmachine` POST | Verified provider | Local artifacts and internal ingest | Existing production-secret and signature verification remain; response contains processing metadata | Add download destination allowlist and response-size ceiling |
| `/api/webhooks/dealmachine` GET | Administrator | Reads webhook summary | Now admin-only and returns counters instead of payloads, paths, URLs, or signature material | Confirm administrator app metadata before relying on direct Supabase RLS access |
| `/api/webhook` PayPal | Verified provider | Payment mutations | Existing PayPal webhook verification occurs before mutation | Exercise sandbox replay/idempotency tests |
| `/api/webhooks/resend` | Verified provider | Email event updates | Existing Svix raw-body verification | Monitor verification failure rate |
| `/api/admin/*` | Administrator | Broad privileged reads/writes | Same-origin; configured administrator or trusted app metadata; client-editable profile role removed from authorization | Apply `057-protect-profile-privileges.sql` after review |
| `/api/health` | Public | Read-only dependency probe | Returns coarse `configured`, `misconfigured`, `disabled`, `reachable`, or `degraded` states; no credentials or internal errors in production | Add a separate admin-only deep provider health screen |

## Integration readiness

| Integration | Current release-candidate state | Required credential or action |
|---|---|---|
| Product analytics | First-party Vercel Analytics plus sanitized server events in Supabase | Keep event payloads coarse and PII-free; review retention and access through the existing admin controls. |
| Supabase | Connected; privileged profile migration is versioned but not applied | Review duplicate/payment and admin-role prechecks, set trusted admin app metadata, then apply migration 057 through the normal database process. |
| PayPal | Binding and idempotency logic implemented | Confirm sandbox client/secret and optional merchant identifier; complete preview-only $0/sandbox verification. |
| Sentry | Next.js client, server, edge, request-error, router-transition, and global-error instrumentation are wired; it fails closed without a DSN and excludes default PII | Verify the project/org variables, source-map upload token, preview event receipt, alert ownership, and retention settings. |
| Resend/Outlook | Existing provider paths remain; no live message was sent | Verify sender domain, reply mailbox, inbound webhook, and suppression behavior with an approved test recipient. |
| Buffer | Approval-gated; VestBlock-owned social channels only | Confirm `BUFFER_API_KEY` and VestBlock Facebook/channel identifiers; do not connect unrelated profiles. |
| n8n | Signed bridge is intended; no live workflow was invoked | Confirm the approved webhook URL/secret and dry-run workflow ownership. VestBlock remains the source of truth. |
| Google Ads / ChatGPT Ads | Human-approved only | Resolve advertiser review/policy status, then provide account-scoped reporting credentials. Campaign creation and spend remain separately approved. |

## Database migration prechecks

Before applying `057-protect-profile-privileges.sql`:

```sql
select paypal_transaction_id, count(*)
from public.payments
where paypal_transaction_id is not null
group by paypal_transaction_id
having count(*) > 1;
```

The result must be empty before the unique index is created. Confirm that the founder/operator has trusted Supabase Auth `app_metadata.role = "admin"` or remains listed in the server’s configured administrator emails. Apply the migration in preview/staging first and prove that a normal authenticated user can edit allowed profile fields but cannot change `role`, `is_subscribed`, `paypal_order_id`, or `paypal_order_product`.
