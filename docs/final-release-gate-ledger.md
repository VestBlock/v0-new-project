# VestBlock final release gate ledger

Authoritative execution ledger for Gate 4E.3 through the final production release. Resume here after context compaction. Do not record secrets, customer data, or disposable-user credentials.

## Release identity

- Legal business: Vestblock LLC
- Customer brand: VestBlock
- Host: `vestblock-pro` (`MacBookPro.lan` verified)
- Repository: `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`
- Branch: `codex/operation-rebrand-final`
- Starting commit: `8fc75c27cbfb5a6262171b269b9d0a3e5a74598b` — `feat: complete Gate 4E.2 participant profiles`
- Starting worktree: clean
- Git remote: `https://github.com/VestBlock/v0-new-project.git`
- Production domain: `https://vestblock.io`
- Vercel project requested in brief: `v0-vest-block-rebuild`
- Production Vercel project: `v0-vest-block-rebuild` (`prj_7AKwdS8YpRSPASbFjXTlQ050u41h`) under the existing `robert-sanders-projects-f3e473a9` team.
- Stale local Vercel association found during Gate A: `v0-new-project-1pbiazadvt4` in the separate `vest-block` team. It does not own `vestblock.io` and must not receive this release.
- Domain proof: Vercel project listing identifies `https://vestblock.io` as the production URL for `v0-vest-block-rebuild`; account domains and aliases show both `vestblock.io` and `www.vestblock.io` on that existing project. No duplicate was created.

## Gate 4E.3A — release truth audit and configuration

Status: **PASS**

Evidence:

- Host, repository, branch, starting commit/message, remote, and initially clean worktree verified over SSH.
- Gate 4E.1 seller-case and Gate 4E.2 participant-profile migrations, routes, tables, and commit are present.
- Supabase dry run reports the remote migration history current through Gate 4E.2 before this release migration.
- Saved local PostgreSQL pooler hostname corrected from `aws-0-us-east-2.pooler.supabase.com` to `aws-1-us-east-2.pooler.supabase.com` without printing the credential.
- Vercel Production, Preview, and Development environment names inspected without printing secret values. The real production project is `v0-vest-block-rebuild`; its production environment contains the required Supabase, OpenAI, Resend, Outlook/Graph, Buffer, n8n, cron, and platform configuration.
- Twilio variables removed from the existing Vercel project. PostHog variables removed locally and absent in Vercel. Runtime searches found no required Twilio, Postiz, or PostHog dependency.
- Buffer authentication tested. The configured Facebook channel resolves to VestBlock. Because the Buffer organization also contains unrelated ShoeGlitch channels, the scheduling script now rejects every channel ID outside the code-owned VestBlock allowlist.
- OpenAI models endpoint, Resend account/domain, Outlook/Graph mailbox access, Supabase, and Vercel authentication tested successfully.
- Resend reports `vestblock.io` verified. Outlook/Graph read access for `acquisitions@vestblock.io` tested successfully.
- n8n URL/secret are configured on an HTTPS `*.n8n.cloud` endpoint; pre-release status was configured but not operationally proven. Gate 4E.3D owns import and signed no-send proof.
- GitHub CLI is not authenticated on the Mac Pro. Existing Git transport authentication will be tested at the final push; owner authentication is a release blocker only if safe recovery fails.
- Platform capability audit: 9 healthy, 1 manual-only, 2 configured-but-unverified/partially implemented. ATTOM has a production credential configured but its enrichment path is not yet operationally proven; DealMachine contact ingestion is also unproven. Neither is falsely represented as operational.
- Supabase security audit found one service-only public RPC using `SECURITY DEFINER`. The release migration changes it to `SECURITY INVOKER`, preserving the explicit `service_role` grant and revocations from public, anon, and authenticated.
- Obsidian desktop CLI/vault status: 14 files and no app errors. The missing guarded repository wrapper is restored in this release before refresh.

Integration classification:

| Integration | Truth status | Release use |
| --- | --- | --- |
| Supabase | Operational and tested | Authoritative database, auth, CRM, profiles, strategies, matches, audit |
| OpenAI | Operational and tested | Bounded proposal/analysis features; no autonomous external action |
| Resend | Operational and tested | Approved transactional/permissioned email only |
| Outlook / Microsoft Graph | Operational and tested | `acquisitions@vestblock.io` operator communication and reply handling |
| Buffer | Operational with enforced restriction | VestBlock-owned allowlisted channel only |
| n8n | Operational and tested in fail-closed no-send mode | Existing `x-vestblock-secret` Header Auth credential and signed HMAC contract verified; external outreach remains disabled |
| Vercel | Operational; production project/domain proven | Deploy only to `v0-vest-block-rebuild` in `robert-sanders-projects-f3e473a9` |
| GitHub | Remote configured; CLI unauthenticated | Final push authentication remains to be proven |
| Obsidian | App/vault healthy; guarded wrapper restored | Derived strategy memory only; Supabase/Command Center stay authoritative |
| DealMachine | Partially implemented / ingestion unproven | Do not claim active contact ingestion until evidence exists |
| ATTOM | Configured but unverified | Production credential exists; do not claim enrichment is operational until a controlled provider test succeeds |
| LinkedIn | Manual-only | Operator task; no autonomous publishing |
| Twilio, Postiz, PostHog | Intentionally excluded | No runtime dependency or environment configuration |

Release manifest — genuinely remaining after Gate A:

1. Apply and verify the Gate 4E.3 database migration.
2. Verify ten active versioned strategy contracts, evidence/proposal review, and immutable promotion behavior.
3. Verify permissioned match creation, operator review, customer-safe filtering, dedupe, and denial paths.
4. Import or update the n8n workflow, run signed no-send/idempotency/suppression/kill-switch tests, and record activity.
5. Finish customer/operator copy and journey QA without changing the locked visual direction.
6. Complete security, legal/privacy, browser, accessibility, responsive, build, migration, and disposable-user cleanup checks.
7. Commit, push, deploy the exact verified build to the proven existing Vercel project, and run production smoke tests.

## Gate 4E.3B — intelligence and self-improving strategies

Status: **PASS**

Evidence:

- Migration `20260814110000_gate4e3_strategy_matching_orchestration.sql` is applied in production Supabase and the remote migration history is current.
- Ten active versioned strategy contracts contain objective, target customer, qualification, sources, customer path, outreach methods, lawful-basis/consent, exclusions, conversion event, KPIs, cost/capacity, failure states, human review, hypothesis, learning window, and version-decision rule.
- Active strategy versions are immutable. QA proved that sourced facts and AI inferences require explicit approve then apply actions, create a new version, retire rather than overwrite the predecessor, and preserve history.
- Command Center exposes lane versions, evidence/outcomes, proposal review, match review, and guarded n8n no-send control.
- `scripts/vestblock-obsidian-agent.mjs` enforces path/command boundaries. Obsidian refresh projected all ten active strategies into the local Strategy Vault without copying credentials or customer data. Supabase remains authoritative.

## Gate 4E.3C — opportunity, matching, and CRM foundation

Status: **PASS**

Evidence:

- Persistent stable-key matching and activity history are applied with RLS and service-role-only grants. Retries return the original match instead of creating duplicates.
- Only active, matching-consented, verified-within-180-days profiles are eligible. Paused, declined, withdrawn, archived, stale, or non-consented profiles are denied.
- Matching and outreach permissions are separate. Match creation and every operator decision keep `outreach_eligible=false`.
- Admin review displays target context, score rationale, exclusions, provenance, source observation time, profile verification time, uncertainty, and consent boundaries before a decision.
- Information requests require an explicit customer-facing question. Approved matches and information requests appear in the owning customer workspace with safe limitations and a profile action; other accounts receive nothing.
- Customer responses exclude stable keys, target IDs, raw scoring/provenance, operator IDs, CRM IDs, tasks, and outreach control fields.

## Gate 4E.3D — outreach and n8n orchestration

Status: **PASS**

Implemented and verified:

- Signed HTTPS allowlisted n8n dispatch and callback contracts.
- Timestamp/replay/idempotency controls, persisted audit runs, operator tasks, safe retry semantics, approved channel allowlist, kill switch, and live-send dual control.
- Default mode remains no-send. External live outreach is not approved and must remain disabled.
- The existing three-node bridge now has published fail-closed `vestblock.n8n.v1` validation for allowlisted events, modes, channels, freshness, signature envelope, idempotency header, operator-task reference, and no-send policy. No downstream send node exists.
- Browser inspection proved the existing credential contract expects `x-vestblock-secret`; the application was corrected from an incompatible Authorization header to that existing contract. No credential was changed, read, or exposed.
- Gate 4E.3 release QA proves a real signed no-send execution, idempotent retry reuse, live-send denial, kill-switch enforcement, invalid-signature rejection, and cross-site mutation denial. The accepted request appears in n8n execution history and the published workflow governance note records the verified no-send state.
- No live send or external campaign has been launched.

## Gate 4E.3E — customer experience and final touches

Status: **PASS**

Evidence:

- DealVault was brought into the approved editorial black/off-white/lime Material Ledger system; the older cyan card grid and defensive product copy were removed without changing its functional contract, pricing, verification references, sample certificate, or demo intake.
- Customer-facing implementation language was removed from Next Move, Capital, seller, profiles, workspace, roadmaps, FAQs, and status history.
- Matching-consent language now describes the active reviewed matching behavior accurately and keeps outreach separate.
- Privacy Policy and Terms of Use are published, linked globally, added to sitemap/crawler access, and use the exact legal/customer identities.
- Gate 4C public journey: 12/12 Playwright tests pass.
- Authenticated workspace persistence: 5/5 checks pass.
- Capital lifecycle: 19/19 checks pass.
- Seller/Real Estate lifecycle: 20/20 checks pass and disposable records were removed.
- Independent public design review: PASS after corrections.
- Independent strict mobile review: PASS at 390 and 768 pixels on `/`, `/capital`, `/sell`, `/dealvault`, `/privacy`, and `/terms`. All 12 route/width combinations return 200, have zero horizontal overflow, no visible text below 14px, no interactive targets below 44px, visible primary CTAs, passing lane-label contrast, and zero running animations under reduced-motion.

## Gate 4E.3F — security, privacy, legal, and release QA

Status: **PASS**

Evidence completed:

- Supabase live audit: healthy; project binding matches; 176 public tables and 145 referenced tables checked; no missing schema/RPCs; no disabled RLS, anonymous exposure, public security-definer functions, anonymous executable functions, metadata authorization policies, or privileged authenticated profile writes; zero missing user profiles; 17 migrations current through `20260814110000`.
- Production dependency audit: no known vulnerabilities. The broader development-tool audit reports newly published high-severity advisories in transitive Hardhat/ESLint dependencies; they are not included in the production runtime and remain a separate toolchain-maintenance item rather than being hidden or described as zero-risk.
- Secret scan found no committed live credentials; the only match was historical placeholder/configuration documentation. No `.env` file is tracked.
- Security headers on the production-mode server include CSP, frame denial, content-type protection, strict referrer policy, restricted permissions policy, COOP/CORP, DNS prefetch control, and no-store/private caching on protected APIs.
- Production build, typecheck, focused changed-file lint, `git diff --check`, and production dependency audit pass. The final changed-file lint has zero errors or warnings. Full-build output retains pre-existing warnings outside this release surface; no build error is present.
- Supabase pooler migration dry run reports the remote database is up to date.
- Gate 4C public journey passes 12/12; authenticated workspace passes 5/5; Capital passes 19/19; Seller/Real Estate passes 20/20. Every suite removed its disposable users, cases, CRM rows, tasks, histories, and test records.
- Gate 4E.3 release QA passes 10/10 checks: strategy governance, immutable promotion, stable matching/dedupe, paused-profile exclusion, customer ownership/safe filtering, database denial, signed n8n no-send/idempotency, live-send/kill-switch denial, invalid-signature/cross-site denial, and responsive operator review at 1440, 1024, 768, and 390 pixels.
- The successful run cleanup removed its disposable strategy, match, orchestration, task, profile, and three user records. A preceding transient login-timeout run also completed the same cleanup before the clean rerun.
- Cross-account, unauthenticated, direct-RLS, invalid signature, cross-site mutation, dedupe, safe-failure, and cleanup paths are included in the release QA suites.

Remaining release-only work:

- Exact deployment smoke test and rollback capture.

Attorney/compliance review remains required for legal sufficiency, financial/underwriting disclosures, referral arrangements, outreach lawful basis, and jurisdiction-specific requirements. This release can verify implementation and clarity but does not claim legal certification.

## Final release gate

Status: **PENDING**

- Starting production rollback deployment: pending capture immediately before deployment.
- Final commit(s), push, deployment ID/URL, production smoke results, and clean-worktree proof: pending.
