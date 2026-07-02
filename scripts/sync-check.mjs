#!/usr/bin/env node
// Sync discipline gate: run before every push/deploy, by every agent, on every machine.
//
// Enforces the rules from docs/VESTBLOCK_SYNC_DISCIPLINE.md:
//   1. Deploys come from main only
//   2. Deploys come from a committed tree only
//   3. Never deploy while behind origin/main (someone else's work would be clobbered)
//   4. Surface unmerged agent branches (codex/*, claude/*) so parallel work is visible
//
// Wired as the first step of deploy:web:prod. Escape hatches exist but are loud:
//   --allow-branch --allow-dirty --skip-fetch

import { execSync } from "node:child_process"

const args = process.argv.slice(2)
const has = (flag) => args.includes(`--${flag}`)

function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  } catch (error) {
    return { error: String(error.stderr || error.message || error).trim() }
  }
}

const problems = []
const warnings = []

// 1. Branch check
const branch = git("branch --show-current")
if (typeof branch === "object") {
  problems.push(`Cannot read git branch: ${branch.error}`)
} else if (branch !== "main" && !has("allow-branch")) {
  problems.push(`On branch "${branch}" — deploys ship from main only (merge first, or pass --allow-branch intentionally).`)
}

// 2. Clean tree check
const dirty = git("status --porcelain")
if (typeof dirty === "string" && dirty && !has("allow-dirty")) {
  const count = dirty.split("\n").length
  problems.push(`${count} uncommitted change(s) — commit (or stash) before deploying so production matches a real commit. First few:\n${dirty.split("\n").slice(0, 5).map((l) => `    ${l}`).join("\n")}`)
}

// 3. Fetch + behind/ahead check
if (!has("skip-fetch")) {
  const fetched = git("fetch origin --quiet")
  if (typeof fetched === "object") {
    warnings.push(`Could not fetch origin (offline?): ${fetched.error.split("\n")[0]}. Behind/ahead status may be stale.`)
  }
}
const counts = git("rev-list --left-right --count origin/main...HEAD")
if (typeof counts === "string" && /^\d+\s+\d+$/.test(counts)) {
  const [behind, ahead] = counts.split(/\s+/).map(Number)
  if (behind > 0) {
    problems.push(`HEAD is ${behind} commit(s) BEHIND origin/main — pull/merge first or you will clobber someone else's shipped work.`)
  }
  if (ahead > 0) warnings.push(`HEAD is ${ahead} commit(s) ahead of origin/main — remember to push after deploying.`)
} else {
  warnings.push("Could not compare against origin/main (no upstream ref?).")
}

// 4. Unmerged agent branches
const unmerged = git('branch -r --no-merged HEAD')
if (typeof unmerged === "string" && unmerged) {
  const agentBranches = unmerged
    .split("\n")
    .map((line) => line.trim())
    .filter((name) => /origin\/(codex|claude|agent)\//i.test(name))
  if (agentBranches.length) {
    warnings.push(`Unmerged agent branch(es) with work not in this deploy: ${agentBranches.join(", ")}. Merge or consciously defer them.`)
  }
}

for (const warning of warnings) console.warn(`⚠ ${warning}`)
if (problems.length) {
  console.error("\n✗ Sync check FAILED — fix before deploying:")
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error("\nRules: docs/VESTBLOCK_SYNC_DISCIPLINE.md")
  process.exit(1)
}
console.log(`✓ Sync check passed${warnings.length ? ` (${warnings.length} warning(s) above)` : ""} — branch ${typeof branch === "string" ? branch : "?"}, clean tree, not behind origin/main.`)
