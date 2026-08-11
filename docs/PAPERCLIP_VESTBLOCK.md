# Paperclip for VestBlock

## Status

Paperclip is installed and running separately from the VestBlock customer application on the MacBook Pro.

- Version: `v2026.722.0`
- Commit: `e55d702916c4d3ddbcac49b697f879808b160f59`
- Source: `/Users/mrsanders/VestBlockOps/paperclip`
- State: `/Users/mrsanders/VestBlockOps/state/instances/vestblock`
- UI/API: `http://127.0.0.1:3212`
- Exposure: loopback only (`127.0.0.1`)
- Database: embedded PostgreSQL
- Backups: hourly, 30-day retention
- Customer app integration: none

The initial doctor run passed all nine checks. Paperclip reported a healthy authenticated local instance. Codex CLI `0.147.0` is installed at `/Users/mrsanders/.local/bin/codex` and uses the MacBook Pro's existing ChatGPT login. The ten VestBlock operating agents explicitly select Paperclip's `cli` engine and the ChatGPT-compatible `gpt-5.4` model so the authenticated host CLI is used instead of the optional ACP lane. The live adapter probe passed, including an authenticated `hello` request. No credential value is stored in the VestBlock repository.

Operation Revenue Engine is recorded in Paperclip as project `734565a6-1627-4a28-958a-f040922d42ce`, led by VestBlock CEO. The governed organization design and its verification evidence are attached to task `VES-1`. The project requires isolated workspaces, a `codex/` branch policy, a pull request, human approval before merge, and forbids production deployment.

## Architecture

```text
Human owner / board
  -> VestBlock CEO
    -> VestBlock Revenue
      -> VestBlock Acquisitions
      -> VestBlock Capital
      -> VestBlock Growth
    -> VestBlock CTO
      -> VestBlock Frontend
      -> VestBlock Backend
      -> VestBlock QA
      -> VestBlock Reviewer
        -> PR-ready work only
          -> human review and production approval
```

Paperclip also provisions its own Reflection Coach and Summarizer. They are system helpers, not members of the initial VestBlock engineering cohort, and remain paused.

Paperclip owns agent goals, hierarchy, budgets, issue assignment, run history, and approvals. Codex remains the coding execution layer. The VestBlock application remains independently deployable and has no runtime dependency on Paperclip.

## Revenue Engine organization

| Agent | Reports to | Monthly ceiling | State | Purpose |
| --- | --- | ---: | --- | --- |
| VestBlock CEO | Human board | $15 | Paused | Company priorities, resource decisions, executive review, and Red-risk escalation |
| VestBlock Revenue | CEO | $12 | Paused | Shared Revenue Engine, funnel health, outreach governance, attribution, and experiments |
| VestBlock Acquisitions | Revenue | $10 | Paused | Property and seller sourcing, qualification, analysis, follow-up, and clean handoff |
| VestBlock Capital | Revenue | $10 | Paused | Readiness, lender criteria, financing matches, packages, and funded attribution |
| VestBlock Growth | Revenue | $8 | Paused | Positioning, SEO/AEO, content, partner growth, conversion, and measurable experiments |
| VestBlock CTO | CEO | $15 | Paused | Architecture, decomposition, risk, sequencing, data, security, and engineering execution |
| VestBlock Frontend | CTO | $10 | Paused | Next.js, UI, accessibility, responsive and performance work |
| VestBlock Backend | CTO | $10 | Paused | APIs, Supabase/Postgres, integrations, secure data flows, and observability |
| VestBlock QA | CTO | $5 | Paused | Independent automated and browser verification |
| VestBlock Reviewer | CTO | $5 | Paused | Independent diff, security, architecture, consent, attribution, and release review |

The company ceiling remains $100/month. These are ceilings, not spend targets. All ten operating agents are deliberately paused, all timer heartbeats are disabled, and no heartbeat or autonomous code run was launched during the Revenue Engine reorganization. Reflection Coach and Summarizer remain paused zero-budget system helpers outside the operating hierarchy.

## Permissions and forbidden actions

Agents can inspect scoped code, create `codex/` branches or isolated worktrees, implement issue-scoped changes, run tests, record evidence, review diffs, and prepare a pull request.

Agents cannot create other agents or skills, deploy production, merge a pull request, push a production branch, expose secrets, modify environment values blindly, reset Supabase, delete tables, weaken RLS or authentication, disable tests, or use unsafe blanket workarounds. New agent creation requires board approval. Payments, contracts, bulk sends, secret changes, and destructive data/schema operations are Red-risk actions and require human approval.

The Operation Rebrand project enforces an isolated-workspace policy with a `codex/` branch prefix. Its stored policy requires a pull request, human approval before merge, and forbids production deployment.

## Task flow

1. The human owner creates or approves a concrete objective and acceptance criteria.
2. CEO ranks the objective against company constraints and assigns either Revenue or CTO ownership.
3. Revenue decomposes commercial work across Acquisitions, Capital, and Growth while preserving shared pipeline, activity, scoring, outreach, and attribution rules.
4. CTO decomposes implementation into bounded engineering issues and assigns specialists.
5. Frontend or Backend works in an isolated `codex/` worktree.
6. QA verifies acceptance criteria and records browser/test evidence.
7. Reviewer inspects the diff, downstream impact, data safety, consent/suppression, attribution, and release risk.
8. Work stops at PR-ready state.
9. The human owner decides whether to merge and deploy.

No agent should be resumed merely to “find work.” Resume an agent only after an issue is assigned, scoped, and budgeted.

## Authentication and secrets

The instance runs in Paperclip's `local_trusted/private` mode and listens only on loopback. Paperclip created its agent JWT secret and encrypted-secret master key inside its state directory. Those files must not be copied into the application repository.

The Codex adapter uses Paperclip-managed per-agent Codex homes. With no per-agent API key configured, Paperclip can seed them from the host's existing ChatGPT subscription login. Never print or copy `auth.json`; rotate the host login if the machine or state directory is compromised.

No OpenAI API key, Supabase key, payment key, or production credential was added during setup.

## Cost controls

- Company monthly ceiling: $100.
- The ten operating-agent ceilings total exactly $100.
- Agents begin paused.
- Fast mode is disabled.
- Heartbeats are not manually invoked during setup.
- New agents require board approval.
- Expand the organization only through a board-approved hire with a scoped source task, role-specific instructions, least privilege, and an updated budget plan.

Paperclip's budget records should be reviewed before every new objective. Provider-side usage limits remain a separate safeguard and should not be assumed from Paperclip's internal budget alone.

## Local operation

Start or resume the local control plane from the MacBook Pro:

```bash
ops/paperclip/start-local.sh
```

The script uses explicit source and state paths, adds the user-local Codex binary to `PATH`, disables telemetry signals, and binds Paperclip to loopback on port `3212`. It does not resume agents.

The current setup is a local operator process, not an unattended production service. Stop it with `Ctrl+C` in its terminal. After a restart, run the start script and verify `http://127.0.0.1:3212/api/health` before resuming any agent.

## Security review before the first real task

1. Confirm the issue targets only the VestBlock repository and contains acceptance criteria.
2. Confirm the agent is paused until assignment and has an appropriate remaining budget. Resume only the smallest accountable chain needed for the issue.
3. Confirm the worktree and branch are isolated from production.
4. Confirm no production data or credentials are required.
5. Require QA and Reviewer completion before a human evaluates the pull request.

Strix and other toolbelt applications are not automatically available to Paperclip agents. Each external tool needs separate authorization, data-boundary review, and a scoped task. No external tool access or new skill was granted during the Revenue Engine organization change.

## Backup and rollback

Paperclip writes automatic database backups to the instance backup directory. Before material org or policy changes, verify that a recent `.sql.gz` backup exists.

To roll back safely:

1. Pause all VestBlock agents.
2. Stop the local Paperclip process.
3. Preserve the current state directory for investigation.
4. Restore the selected embedded PostgreSQL backup into a separate recovery instance.
5. Run `paperclipai doctor` against the recovery instance before switching operators to it.

Do not delete the source checkout, state directory, or company record as a rollback shortcut. Agent configuration revisions and project history are part of the audit trail.
