import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = 'lib/matching/opportunity-matches.ts'
const source = readFileSync(resolve(process.cwd(), file), 'utf8')

assert.match(source, /function stableEventId\(evidenceKey: string\)/)
assert.match(source, /id: expected\.eventId/)
assert.match(source, /if \(inserted\.error\.code !== '23505'\) throw inserted\.error/)
assert.match(source, /return assertExactMatchEvent\(concurrent\.event, expected\)/)

const createStart = source.indexOf('export async function createOpportunityMatch(')
const reviewStart = source.indexOf('export async function reviewOpportunityMatch(')
const createBlock = source.slice(createStart, reviewStart)
assert.ok(createBlock.includes('await ensureProposedMatchEvidence({ match: existing.data, binding })'))
assert.ok(createBlock.includes('await ensureProposedMatchEvidence({ match, binding })'))
assert.doesNotMatch(
  createBlock,
  /await admin\.from\('participant_opportunity_match_events'\)\.insert/,
  'creation must use the checked, deterministic event writer'
)

const reviewEnd = source.indexOf('export async function listAdminOpportunityMatches(', reviewStart)
const reviewBlock = source.slice(reviewStart, reviewEnd)
const eventIndex = reviewBlock.indexOf('const event = priorEvent.event')
const updateIndex = reviewBlock.indexOf(".from('participant_opportunity_matches').update({")
const activityIndex = reviewBlock.indexOf('await recordOperatingStrategyActivity({')
assert.ok(eventIndex !== -1 && updateIndex !== -1 && activityIndex !== -1)
assert.ok(eventIndex < updateIndex && updateIndex < activityIndex)
assert.ok(reviewBlock.includes('const alreadyApplied = existing.data.status === input.status'))
assert.ok(reviewBlock.includes('const priorEvent = await findMatchEvent(evidenceKey)'))
assert.ok(reviewBlock.includes('reviewed_at: event.created_at'))
assert.ok(reviewBlock.includes('activityKey: event.id'))
assert.ok(reviewBlock.includes('occurredAt: event.created_at'))
assert.ok(reviewBlock.includes('idempotencyKey: `opportunity-match-review:${binding.operatingStrategyVersionId}:${event.id}`'))
assert.doesNotMatch(reviewBlock, /idempotencyKey: `[^`]*\$\{now\}/)

console.log('Gate 3C opportunity-match retry guards passed.')
