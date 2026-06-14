import 'server-only'

import { getOpenAIClient } from '@/lib/openai-server'

/**
 * Renovation Agent — rehab scope and budget engine for the underwriting lane.
 *
 * Deterministic core: scope level × square footage × regional cost factor
 * produces a line-item rehab budget, trade checklist, and timeline. If an
 * OpenAI key is configured and condition notes are provided, the agent
 * refines line items from the notes (flagging roof/HVAC/electrical/etc.).
 * Without a key it stays fully deterministic — never fake, always labeled
 * as planning-grade estimates.
 */

export type RenovationScope = 'cosmetic' | 'moderate' | 'full' | 'structural'

export type RenovationInput = {
  squareFeet: number
  scope: RenovationScope
  state?: string
  bedrooms?: number
  bathrooms?: number
  yearBuilt?: number
  conditionNotes?: string
  arv?: number
  askingPrice?: number
}

export type RenovationLineItem = {
  key: string
  label: string
  low: number
  high: number
  included: boolean
  note?: string
}

export type RenovationEstimate = {
  scope: RenovationScope
  scopeLabel: string
  squareFeet: number
  regionFactor: number
  regionLabel: string
  budgetLow: number
  budgetHigh: number
  perSqftLow: number
  perSqftHigh: number
  timelineWeeksLow: number
  timelineWeeksHigh: number
  lineItems: RenovationLineItem[]
  trades: string[]
  dealMath: {
    arv: number | null
    mao70: number | null
    askingPrice: number | null
    spreadAtAsking: number | null
    verdict: string
  }
  aiRefined: boolean
  aiNotes: string[]
  disclaimer: string
}

const SCOPE_CONFIG: Record<
  RenovationScope,
  { label: string; perSqftLow: number; perSqftHigh: number; weeksLow: number; weeksHigh: number }
> = {
  cosmetic: { label: 'Cosmetic refresh', perSqftLow: 12, perSqftHigh: 25, weeksLow: 2, weeksHigh: 5 },
  moderate: { label: 'Moderate rehab', perSqftLow: 25, perSqftHigh: 55, weeksLow: 6, weeksHigh: 12 },
  full: { label: 'Full gut renovation', perSqftLow: 55, perSqftHigh: 110, weeksLow: 12, weeksHigh: 24 },
  structural: { label: 'Structural + full rehab', perSqftLow: 90, perSqftHigh: 180, weeksLow: 20, weeksHigh: 40 },
}

// Rough regional labor/material multipliers vs national average
const REGION_FACTORS: Record<string, number> = {
  WI: 0.96, OH: 0.92, MI: 0.95, MO: 0.93, PA: 1.0, LA: 0.94, GA: 0.95,
  IL: 1.05, IN: 0.92, KY: 0.9, TN: 0.94, AL: 0.88, MS: 0.86, AR: 0.87,
  TX: 0.98, FL: 1.02, NY: 1.32, NJ: 1.22, CA: 1.38, WA: 1.18, MA: 1.25,
  CO: 1.08, AZ: 1.02, NV: 1.05, NC: 0.95, SC: 0.93, VA: 1.02, MD: 1.1,
}

type LineSeed = {
  key: string
  label: string
  share: number // share of total budget
  scopes: RenovationScope[]
  trade: string
}

const LINE_SEEDS: LineSeed[] = [
  { key: 'kitchen', label: 'Kitchen', share: 0.18, scopes: ['cosmetic', 'moderate', 'full', 'structural'], trade: 'GC / cabinet installer' },
  { key: 'bathrooms', label: 'Bathrooms', share: 0.13, scopes: ['cosmetic', 'moderate', 'full', 'structural'], trade: 'Plumber / tile' },
  { key: 'flooring', label: 'Flooring', share: 0.1, scopes: ['cosmetic', 'moderate', 'full', 'structural'], trade: 'Flooring crew' },
  { key: 'paint', label: 'Paint (interior/exterior)', share: 0.08, scopes: ['cosmetic', 'moderate', 'full', 'structural'], trade: 'Painters' },
  { key: 'roof', label: 'Roof', share: 0.1, scopes: ['moderate', 'full', 'structural'], trade: 'Roofer' },
  { key: 'hvac', label: 'HVAC', share: 0.09, scopes: ['moderate', 'full', 'structural'], trade: 'HVAC contractor' },
  { key: 'electrical', label: 'Electrical', share: 0.08, scopes: ['full', 'structural'], trade: 'Licensed electrician' },
  { key: 'plumbing', label: 'Plumbing (re-pipe)', share: 0.08, scopes: ['full', 'structural'], trade: 'Licensed plumber' },
  { key: 'windows', label: 'Windows & doors', share: 0.07, scopes: ['moderate', 'full', 'structural'], trade: 'Window installer' },
  { key: 'foundation', label: 'Foundation / structural', share: 0.12, scopes: ['structural'], trade: 'Structural engineer + foundation crew' },
  { key: 'exterior', label: 'Siding / exterior', share: 0.06, scopes: ['moderate', 'full', 'structural'], trade: 'Siding crew' },
  { key: 'landscaping', label: 'Landscaping / curb appeal', share: 0.03, scopes: ['cosmetic', 'moderate', 'full', 'structural'], trade: 'Landscaper' },
  { key: 'contingency', label: 'Contingency (10%)', share: 0.1, scopes: ['cosmetic', 'moderate', 'full', 'structural'], trade: '—' },
]

// Keyword → line-item flags for deterministic note parsing (works without LLM)
const NOTE_FLAGS: Array<{ pattern: RegExp; key: string; note: string }> = [
  { pattern: /roof|shingle|leak/i, key: 'roof', note: 'Condition notes mention roof issues — verify with inspection.' },
  { pattern: /hvac|furnace|boiler|ac unit|air condition/i, key: 'hvac', note: 'HVAC called out in notes.' },
  { pattern: /knob.?and.?tube|wiring|electrical|panel|fuse/i, key: 'electrical', note: 'Electrical work flagged in notes.' },
  { pattern: /plumb|pipe|galvanized|sewer|water damage/i, key: 'plumbing', note: 'Plumbing flagged in notes.' },
  { pattern: /foundation|crack|settl|structural|joist|beam/i, key: 'foundation', note: 'Structural concern in notes — engineer review required.' },
  { pattern: /window/i, key: 'windows', note: 'Windows mentioned in notes.' },
  { pattern: /mold|asbestos|lead paint/i, key: 'contingency', note: 'Environmental hazard mentioned — raise contingency and get testing.' },
]

function round100(value: number) {
  return Math.round(value / 100) * 100
}

export function buildRenovationEstimate(input: RenovationInput): RenovationEstimate {
  const config = SCOPE_CONFIG[input.scope]
  const sqft = Math.max(300, Math.min(20000, Math.round(input.squareFeet || 0)))
  const state = String(input.state || '').trim().toUpperCase()
  const regionFactor = REGION_FACTORS[state] ?? 1
  const regionLabel = state ? `${state} (${regionFactor}x national)` : 'National average'

  // Age premium: pre-1950 builds carry hidden-systems risk
  const ageFactor = input.yearBuilt && input.yearBuilt < 1950 ? 1.08 : 1

  const budgetLow = round100(sqft * config.perSqftLow * regionFactor * ageFactor)
  const budgetHigh = round100(sqft * config.perSqftHigh * regionFactor * ageFactor)

  const applicable = LINE_SEEDS.filter((seed) => seed.scopes.includes(input.scope))
  const shareTotal = applicable.reduce((sum, seed) => sum + seed.share, 0)

  const noteHits = NOTE_FLAGS.filter((flag) => flag.pattern.test(input.conditionNotes || ''))
  const flaggedKeys = new Set(noteHits.map((hit) => hit.key))

  const lineItems: RenovationLineItem[] = applicable.map((seed) => {
    const normalizedShare = seed.share / shareTotal
    const flagged = flaggedKeys.has(seed.key)
    // Items explicitly flagged in notes get pushed toward the high end
    const itemLow = round100(budgetLow * normalizedShare * (flagged ? 1.15 : 1))
    const itemHigh = round100(budgetHigh * normalizedShare * (flagged ? 1.2 : 1))
    return {
      key: seed.key,
      label: seed.label,
      low: itemLow,
      high: itemHigh,
      included: true,
      note: noteHits.find((hit) => hit.key === seed.key)?.note,
    }
  })

  // Items outside the scope but flagged by notes get added (e.g. roof on a cosmetic job)
  for (const hit of noteHits) {
    if (!applicable.some((seed) => seed.key === hit.key)) {
      const seed = LINE_SEEDS.find((item) => item.key === hit.key)
      if (seed) {
        lineItems.push({
          key: seed.key,
          label: seed.label,
          low: round100(budgetHigh * 0.06),
          high: round100(budgetHigh * 0.14),
          included: true,
          note: `${hit.note} Added beyond the base ${config.label.toLowerCase()} scope.`,
        })
      }
    }
  }

  const adjustedLow = lineItems.reduce((sum, item) => sum + item.low, 0)
  const adjustedHigh = lineItems.reduce((sum, item) => sum + item.high, 0)

  const trades = [...new Set(applicable.map((seed) => seed.trade).filter((trade) => trade !== '—'))]

  const arv = Number.isFinite(input.arv) && (input.arv || 0) > 0 ? Number(input.arv) : null
  const askingPrice = Number.isFinite(input.askingPrice) && (input.askingPrice || 0) > 0 ? Number(input.askingPrice) : null
  const repairsMid = Math.round((adjustedLow + adjustedHigh) / 2)
  const mao70 = arv ? round100(arv * 0.7 - repairsMid) : null
  const spreadAtAsking = mao70 != null && askingPrice != null ? mao70 - askingPrice : null

  const verdict =
    mao70 == null
      ? 'Add an ARV to compute the max allowable offer.'
      : spreadAtAsking == null
        ? `MAO (70% rule, mid-budget repairs): $${mao70.toLocaleString()}.`
        : spreadAtAsking >= 0
          ? `Asking price sits $${spreadAtAsking.toLocaleString()} UNDER the 70%-rule MAO — worth underwriting seriously.`
          : `Asking price is $${Math.abs(spreadAtAsking).toLocaleString()} over the 70%-rule MAO — needs a discount or creative structure.`

  return {
    scope: input.scope,
    scopeLabel: config.label,
    squareFeet: sqft,
    regionFactor,
    regionLabel,
    budgetLow: adjustedLow,
    budgetHigh: adjustedHigh,
    perSqftLow: Math.round(adjustedLow / sqft),
    perSqftHigh: Math.round(adjustedHigh / sqft),
    timelineWeeksLow: config.weeksLow,
    timelineWeeksHigh: config.weeksHigh,
    lineItems,
    trades,
    dealMath: { arv, mao70, askingPrice, spreadAtAsking, verdict },
    aiRefined: false,
    aiNotes: noteHits.map((hit) => hit.note),
    disclaimer:
      'Planning-grade estimate from regional cost ranges — not a contractor bid. Verify with local walkthroughs and at least two written quotes before underwriting a final number.',
  }
}

/**
 * Optional LLM refinement: reads free-text condition notes and adjusts the
 * deterministic estimate (scope sanity check + extra risk notes). Falls back
 * silently to the deterministic estimate when no OpenAI key is configured.
 */
export async function refineEstimateWithAi(
  estimate: RenovationEstimate,
  input: RenovationInput
): Promise<RenovationEstimate> {
  const notes = String(input.conditionNotes || '').trim()
  if (!notes) return estimate

  const client = getOpenAIClient()
  if (!client) return estimate

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_RENOVATION_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You are a conservative residential rehab estimator reviewing a budget for a real estate investor. ' +
            'Given property details and condition notes, return STRICT JSON: ' +
            '{"scopeCheck":"ok"|"consider_upgrade"|"consider_downgrade","riskNotes":["..."],"missedItems":["..."]}. ' +
            'riskNotes: max 4 short strings about cost risks implied by the notes. ' +
            'missedItems: max 3 short strings naming work the notes imply that a base budget might miss. ' +
            'Never invent specifics not implied by the notes. No markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            scope: estimate.scopeLabel,
            squareFeet: estimate.squareFeet,
            yearBuilt: input.yearBuilt || null,
            state: input.state || null,
            budgetLow: estimate.budgetLow,
            budgetHigh: estimate.budgetHigh,
            conditionNotes: notes.slice(0, 1200),
          }),
        },
      ],
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, ''))
    const aiNotes: string[] = []

    if (parsed.scopeCheck === 'consider_upgrade') {
      aiNotes.push(`AI scope check: the notes suggest more than a ${estimate.scopeLabel.toLowerCase()} — consider the next scope tier.`)
    } else if (parsed.scopeCheck === 'consider_downgrade') {
      aiNotes.push(`AI scope check: the notes may support a lighter scope than ${estimate.scopeLabel.toLowerCase()}.`)
    }
    for (const note of Array.isArray(parsed.riskNotes) ? parsed.riskNotes.slice(0, 4) : []) {
      if (typeof note === 'string' && note.trim()) aiNotes.push(note.trim())
    }
    for (const item of Array.isArray(parsed.missedItems) ? parsed.missedItems.slice(0, 3) : []) {
      if (typeof item === 'string' && item.trim()) aiNotes.push(`Possible missed item: ${item.trim()}`)
    }

    if (!aiNotes.length) return estimate
    return { ...estimate, aiRefined: true, aiNotes: [...estimate.aiNotes, ...aiNotes] }
  } catch {
    return estimate
  }
}
