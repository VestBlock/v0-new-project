# Gate 4E.2 participant-profile data contract

## Decision

VestBlock uses one shared, authenticated participant profile account layer for customer-controlled role profiles. It does not replace the existing buyer, lender, investor, CRM, task, workspace, authentication, or partner systems.

The shared layer is required because the existing buyer, lender, and investor profile datasets contain a mix of operator-created, imported, discovered, public-signup, partner, and legacy records. Those records are operational network records, not proof of authenticated ownership. An email match therefore cannot safely grant customer controls.

## Ownership and origin

- Every customer profile has a stable UUID and an authenticated owner reference.
- A single account may hold one profile per role without duplicate accounts.
- The unique owner-and-role rule makes retries and duplicate submissions fail safely.
- Origin distinguishes customer, operator, imported, discovered, and legacy records.
- Customer routes only read and mutate customer-origin rows owned by the server-verified session.
- Imported and discovered buyer, lender, or investor records are never auto-claimed from an email match.
- A legacy link requires an admin-authorized action, a supported table name, a stable UUID, a reason, and an append-only event. The operator remains responsible for secure external verification.

## Lifecycle

Statuses are draft, pending review, active, paused, needs information, declined, withdrawn, and archived.

- Customers may save a draft, submit for review, pause, reactivate, or withdraw through validated transitions.
- A paused profile returns to active only if an operator previously activated it; otherwise it returns to pending review.
- Editing material criteria while paused clears the prior verification basis, so reactivation returns the profile to pending review and keeps it nonpublic until a new approval.
- A declined profile remains customer-editable and may be corrected and resubmitted; decline is not a dead end.
- Operators may assign, request information, approve, decline with a reason, pause, archive, or explicitly link a verified legacy record.
- Optimistic profile-version checks prevent stale clients from overwriting a newer edit.
- A safe failure state records recoverable operator-task or AI-routing failures.

## Data shape

Common identity, account contact, consent, visibility, lifecycle, assignment, and linkage columns remain typed. Role-specific criteria are stored in validated structured data; keys are allowlisted by the selected role and bounded by runtime schemas.

The roles are real estate buyer, investor, lender or capital provider, builder, developer, real estate agent, wholesaler, business buyer, business seller, and service provider.

## Consent and visibility

Marketing, matching, outreach, and public visibility are independent permissions with their own timestamps. Account creation and case-related service messages are not consent.

Every profile is private by default. Public display requires:

1. customer origin
2. active status
3. explicit public-visibility consent and timestamp
4. a nonempty public slug
5. explicit customer-selected keys from the role-specific criteria allowlist

The fixed public-profile allowlist contains role, profile name, optional organization name and summary, verification/update context, the applicable boundary disclosure, and customer-selected role criteria. The permission screen names that baseline before consent. Public responses never include contact details, owner IDs, internal IDs, CRM or task links, notes, scores, suppression data, assignment data, internal history, or operator metadata. Revoking visibility immediately makes the public route return 404. Visibility does not start matching or outreach.

## AI normalization

AI may propose a structured interpretation of customer free text. The original text, proposed structure, provider and model identifier, timestamp, corrections, decision, approved version, and failure state are stored separately.

AI never overwrites criteria or changes profile status without explicit customer approval. Only an authenticated owner may approve a proposal. Approval merges the reviewed proposal into existing criteria rather than replacing unrelated fields, and the customer sees current and proposed values before deciding. An approval changes the owned structured criteria atomically; if the profile was already active, it returns to pending review and becomes nonpublic until an operator reviews the material change. Manual form completion remains fully operational when AI is unavailable.

## Existing-system links

- Authentication and account identity remain in Supabase Auth and the existing user profile table.
- The account-profile reference links the participant profile to the existing account record when present.
- The CRM lead reference is optional and may link an existing CRM lead after operator review.
- Review work uses the existing admin task table; no duplicate task system is created.
- Customer-safe and internal append-only history use participant profile events.
- Existing buyer, lender, investor, and partner records remain operator datasets and may be linked only after verification.

## Authorization and failure behavior

The three Gate 4E.2 tables enable RLS, revoke all browser-role privileges, and grant only the service role, matching the Gate 4E.1 server-mediated pattern. Authenticated same-origin routes validate every request, enforce ownership or admin authorization, apply rate limits, return private no-store responses, and filter sensitive fields.

Profile persistence occurs before operator task routing. A downstream task or AI failure leaves a saved record with an explicit recoverable state and event instead of losing or partially activating the profile.

Gate 4E.2 stores matching and outreach preferences only. It does not run sourcing, matching, scoring, distribution, email, SMS, social, direct mail, advertising, or n8n workflows.
