# VestBlock GitHub Discipline Operator

Use this skill when preparing VestBlock changes for commit, PR, review, CI fixes, or handoff.

## Branch Rule

Use `codex/` branch names unless Rob requests a different branch. Keep branches scoped to one business outcome where possible.

## Dirty Worktree Rule

- Inspect `git status --short` before editing.
- Do not revert unrelated user or prior-agent work.
- Group changes by revenue area: outreach, visibility, public website, DealVault, funding, admin, security, docs.
- If a file has unrelated edits, read it carefully and patch around existing work.

## Commit Grouping

Prefer small reviewable groups:

- Revenue Command Center and admin visibility
- Outreach source/approval/send logic
- Visibility/AEO/indexing assets
- Public website/service conversion
- DealVault proof/demo work
- Docs and operator playbooks

## PR Checklist

- Summary explains business impact, not just files changed.
- Tests/checks are listed with pass/fail.
- Risky actions are clearly called out.
- No secrets, private keys, sensitive customer docs, or live-send artifacts are included.
- Screenshots are attached when UI changed.

## CI / Review

Use GitHub tools for PR comments and failing checks when available. Fix CI from the failing command outward, not by broad refactors.
