# VestBlock Reusable Skill Authoring

Use this skill when a repeated VestBlock workflow should become a reusable operator skill instead of another one-off prompt.

## When To Create Or Update A Skill

Create or update a skill when the same work has been repeated at least twice, has safety rules, or requires knowing VestBlock-specific files, routes, commands, claims, or business priorities.

## Required Sections

- Use when
- Goal
- Start here
- Key files or commands
- Guardrails
- Verification
- Output format

Keep the skill short. Link to existing docs instead of duplicating long context.

## Naming

Use lowercase hyphenated names under `.agents/skills/vestblock/`, such as `gmail-triage-operator.md` or `dealvault-revenue-operator.md`.

## Do Not Duplicate

Before creating a new skill, check `docs/CODEX_FAST_CONTEXT.md` and `.agents/skills/vestblock/`. Extend an existing operator when the job fits an existing lane.

## Verification

Docs-only skill changes do not require TypeScript. If a skill points to code commands or files, verify those paths still exist with `rg --files`.
