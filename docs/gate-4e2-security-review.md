# Gate 4E.2 security and privacy review

Date: 2026-08-13 (America/Chicago)

Scope: the participant-profile tables, customer/public/admin routes, workspace and operator UI, AI-normalization path, migrations, and the dedicated Gate 4E.2 QA suite. This review does not expand the gate into matching, sourcing, outreach, advertising, n8n execution, or provider actions.

## Result

PASS. No unresolved critical, high, or medium-severity finding was identified in the Gate 4E.2 scope. The production build, focused static checks, adversarial API checks, browser journey, direct database authorization checks, visibility tests, and cleanup proof pass.

## Controls reviewed

- **Authentication and ownership:** customer routes derive the user from the server-verified session and constrain every read or mutation to the owned customer-origin profile. Cross-account reads and writes return no record. Imported and discovered records cannot be claimed by matching an email address.
- **Authorization:** admin routes require the existing administrator check. Operator assignment accepts an authorized directory email instead of a client-supplied UUID. Legacy links require an authorized admin action, a supported table, a stable record ID, and a reason.
- **Database boundary:** `participant_profiles`, `participant_profile_events`, and `participant_profile_normalizations` enable RLS, revoke privileges from `PUBLIC`, `anon`, and `authenticated`, and grant access only to `service_role`. The AI-approval function has a fixed blank search path, performs an owned atomic update, and is executable only by `service_role`.
- **Input and concurrency:** request bodies and filters use strict bounded Zod schemas. Role-specific criteria and public fields use allowlists. Optimistic `profile_version` checks reject stale writes, while an owner-and-role unique constraint and idempotency key make duplicate retries safe.
- **Mutation protection:** customer and admin mutations use the existing same-origin and scoped rate-limit guard. The QA suite proves a malicious origin and abusive request sequence are rejected.
- **Privacy and cache behavior:** private responses use `private, no-store`; the public route uses `no-store`. Customer responses strip ownership, CRM, task, assignment, legacy, actor, and internal metadata fields. Public responses are constructed from a fixed baseline plus customer-selected role fields.
- **Visibility revocation:** only approved, active, customer-origin, opted-in profiles with a public slug are visible. Private, paused, declined, withdrawn, archived, and imported profiles return 404. Revocation removes access immediately.
- **Consent:** account communication, marketing, future matching, future outreach, and public visibility remain separate values with independent consent timestamps and versions. Public consent copy identifies the baseline fields before opt-in.
- **AI boundary:** AI output is stored as a proposal beside the original text, model/provider identifier, corrections, decision, and failure state. It cannot mutate criteria until explicit owner approval. Approval merges reviewed values without deleting unrelated criteria and sends an active material change back to operator review. Provider secrets, prompts, and private reasoning are not returned.
- **Failure safety:** profile persistence precedes review-task routing. A controlled task-routing failure leaves a saved, nonactive, recoverable state and supports an idempotent retry. No failure path starts matching or outreach.
- **Action boundary:** the suite snapshots relevant operational tables and proves this gate creates no matching, sourcing, outreach, advertising, n8n, email, SMS, social, direct-mail, or provider action.

## Evidence

- Schema and privilege controls: `supabase/migrations/20260814025700_create_participant_profiles.sql`
- Review-boundary hardening: `supabase/migrations/20260814032907_harden_participant_profile_review_boundaries.sql`
- Shared validation and allowlists: `lib/participant-profiles/config.ts`, `lib/participant-profiles/schemas.ts`
- Ownership, event, task, public filtering, and operator utilities: `lib/participant-profiles/server.ts`
- Customer, public, and admin endpoints: `app/api/participant-profiles`, `app/api/public/participant-profiles`, `app/api/admin/participant-profiles`
- End-to-end and adversarial proof: `scripts/qa-gate4e2-participant-profiles.mjs`
- Final QA run: `1786682411707-0uphbc`, 32 checks passed, 14 profiles and 3 disposable users removed

The database model follows Supabase guidance to protect application tables with RLS and to keep the service-role key on trusted servers only:

- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/api/securing-your-api>
- <https://supabase.com/docs/guides/auth/managing-user-data>

## Residual operational items

- The saved `POSTGRES_URL` pooler hostname uses the retired `aws-0-us-east-2.pooler.supabase.com` endpoint. Migrations succeeded against the current `aws-1-us-east-2.pooler.supabase.com` endpoint without writing or exposing the credential. The owner should update the saved hostname before the next migration operation. This is an availability/configuration issue, not an authorization bypass.
- OpenAI availability is external. Manual structured profile completion remains the complete fallback, and AI failure remains persisted without partial approval.
- A public profile intentionally includes the consent-screen baseline of role, profile name, optional organization and summary, plus selected role criteria. Contact and internal data remain excluded.
