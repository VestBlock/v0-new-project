import 'server-only'

import type { AgentKey, CommandCenterData } from '@/lib/admin/commandCenter'

/**
 * Boss Agent — the strategy layer above the seven operating agents.
 *
 * It reads the same live command-center data, evaluates a library of revenue
 * playbooks against it, ranks what matters today, and issues concrete
 * directives to each agent lane. Directives can be dispatched as admin tasks
 * so they land on the operator board with full context.
 *
 * Deterministic by design: every "why now" is a real number from live data,
 * never an invented metric.
 */

export type BossDirective = {
  agent: AgentKey
  action: string
  detail: string
  priority: 'urgent' | 'high' | 'normal'
}

export type BossStep = {
  label: string
  command?: string
  href?: string
}

export type BossPlay = {
  key: string
  name: string
  category: 'acquisition' | 'conversion' | 'capital' | 'visibility' | 'hygiene'
  thesis: string
  whyNow: string[]
  score: number
  effort: 'low' | 'medium' | 'high'
  expectedOutcome: string
  directives: BossDirective[]
  steps: BossStep[]
  complianceNote?: string
}

export type BossBriefing = {
  generatedAt: string
  headline: string
  focusKey: string
  plays: BossPlay[]
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildBossBriefing(data: CommandCenterData): BossBriefing {
  const plays: BossPlay[] = []
  const s = data.summary
  const queueByLabel = new Map(data.routingQueue.map((item) => [item.label, item.count]))
  const followupsDue = queueByLabel.get('Follow-ups due') ?? 0
  const openMatches = (queueByLabel.get('Buyer matches open') ?? 0) + (queueByLabel.get('Lender matches open') ?? 0)
  const openFunding = queueByLabel.get('Funding requests open') ?? 0
  const openChecklists = queueByLabel.get('Research checklists open') ?? 0
  const topMarkets = data.marketHeat.slice(0, 3)
  const topMarketNames = topMarkets.map((m) => m.market).join(', ') || 'active markets'
  const staleExports = data.localSignals.dmExports.filter((e) => e.ageDays > 7)
  const freshExports = data.localSignals.dmExports.filter((e) => e.ageDays <= 7)
  const authorityAgent = data.agents.find((a) => a.key === 'authority')
  const published7d = Number(authorityAgent?.kpis.find((k) => k.label === 'Published 7d')?.value ?? 0)

  // ── 1. Stale-listing creative finance (the realtor play) ──────────────────
  plays.push({
    key: 'stale-listing-creative-finance',
    name: 'Stale Listings → Creative Finance Offers',
    category: 'acquisition',
    thesis:
      'Listings sitting 90+ days are priced wrong for cash buyers but often perfect for creative terms. Harvest high days-on-market listings, run each through the deal calculator, and hand the listing agent a specific seller-finance or flexible-terms structure they can take to their seller.',
    whyNow: [
      s.replySignals7d < 5 ? `Only ${s.replySignals7d} reply signals this week — this lane talks to agents who answer email.` : `${s.replySignals7d} replies this week; agents are the warmest cold audience.`,
      `Top heat markets ready: ${topMarketNames}.`,
      'Realtor outreach is B2B — cleaner compliance posture than cold homeowner contact.',
    ],
    score: clampScore(62 + (s.replySignals7d < 5 ? 14 : 0) + (s.newLeads24h < 10 ? 10 : 0)),
    effort: 'medium',
    expectedOutcome: 'A new agent-referred deal lane: listing agents bring you their stuck inventory instead of you chasing owners.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Harvest 90+ DOM listings in the top heat markets',
        detail: `Run the stale-listing finder for ${topMarketNames}. Outscraper Zillow source, or --input-csv for a manual export.`,
        priority: 'high',
      },
      {
        agent: 'underwriting',
        action: 'Run every harvested listing through the opportunity analyzer',
        detail: 'The finder calls /api/property-analyzer per listing — review the creative offers (seller finance, subject-to) it attaches before anything sends.',
        priority: 'high',
      },
      {
        agent: 'outreach',
        action: 'Review and send agent-facing creative-terms drafts',
        detail: 'Drafts are agent-to-agent, no homeowner contact, CAN-SPAM footer included. Dry-run first, read the .txt, then --send.',
        priority: 'normal',
      },
      {
        agent: 'qa',
        action: 'Spot-check 5 drafts for compliance language',
        detail: 'No guarantees, no funding promises to sellers, unsubscribe present, numbers match the analyzer output.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Dry-run the finder', command: 'npm run boss:stale-listings -- --market="Milwaukee, WI" --min-dom=90 --limit=25' },
      { label: 'Review drafts in tmp/outreach/', href: '/admin/leads' },
      { label: 'Send after review', command: 'npm run boss:stale-listings -- --market="Milwaukee, WI" --min-dom=90 --limit=25 --send' },
    ],
    complianceNote:
      'Outreach targets listing agents (business contacts), not owners. Offers are presented as structures to review, never guaranteed purchases.',
  })

  // ── 2. Fresh-city DealMachine expansion ────────────────────────────────────
  const dmBlocked = freshExports.length === 0
  plays.push({
    key: 'fresh-city-dealmachine',
    name: 'Fresh-City DealMachine Loop',
    category: 'acquisition',
    thesis:
      'Philadelphia, Kansas City, and New Orleans have 14k+ DealMachine-ready addresses queued but zero contact exports. One Atlas session per city (build list → skip-trace → export) unlocks the whole automated outreach loop.',
    whyNow: [
      dmBlocked
        ? 'No fresh contact exports on disk — the entire fresh-city lane is blocked on a 15-minute manual step.'
        : `${freshExports.length} fresh export(s) ready to work.`,
      staleExports.length ? `${staleExports.length} export(s) older than 7 days should be re-pulled.` : 'Export hygiene is clean.',
    ],
    score: clampScore(dmBlocked ? 78 : 40),
    effort: 'low',
    expectedOutcome: 'Three untouched metros enter the outreach loop with skip-traced owner contacts.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Build + skip-trace DealMachine lists for Philadelphia and Kansas City',
        detail: 'Atlas → List Builder with the saved filters, convert to static, Export Contacts, drop in data/dm-exports/.',
        priority: dmBlocked ? 'urgent' : 'normal',
      },
      {
        agent: 'outreach',
        action: 'Ingest and launch owner outreach per market',
        detail: 'npm run distress:dealmachine:ingest-export:apply, then export-outreach dry-run → review → send.',
        priority: 'high',
      },
    ],
    steps: [
      { label: 'Ingest latest export', command: 'npm run distress:dealmachine:ingest-export:apply' },
      { label: 'Open the operating doc', href: '/admin/market-expansion' },
    ],
  })

  // ── 3. Reply resurrection ──────────────────────────────────────────────────
  plays.push({
    key: 'reply-resurrection',
    name: 'Reply & Follow-Up Resurrection',
    category: 'conversion',
    thesis:
      'Replies and due follow-ups are the highest-probability revenue in the system. Working them beats sending anything new.',
    whyNow: [
      `${followupsDue} follow-ups marked due across leads and partners.`,
      `${s.replySignals7d} live reply signals in the last 7 days.`,
      `${openChecklists} research checklists still block outreach on queued contacts.`,
    ],
    score: clampScore(30 + followupsDue * 2 + s.replySignals7d * 6),
    effort: 'low',
    expectedOutcome: 'Conversations advance to offers; nothing warm goes cold.',
    directives: [
      {
        agent: 'outreach',
        action: `Clear all ${followupsDue} due follow-ups before new sends`,
        detail: 'Sort by last reply, answer every live thread, then re-queue cold ones for the next sequence step.',
        priority: followupsDue > 10 ? 'urgent' : 'high',
      },
      {
        agent: 'operator',
        action: 'Triage replies into route/park/drop',
        detail: 'Anything route-worthy gets a buyer/lender match or analyzer run the same day.',
        priority: 'high',
      },
    ],
    steps: [
      { label: 'Open lead queue', href: '/admin/leads' },
      { label: 'Open partner follow-ups', href: '/admin/buyers' },
    ],
  })

  // ── 4. Buyer depth in hot markets ─────────────────────────────────────────
  plays.push({
    key: 'buyer-depth-hot-markets',
    name: 'Buyer Depth in Hot Markets',
    category: 'conversion',
    thesis:
      'Lead momentum without buyer depth means contracts you cannot move. Recruit cash buyers and operators specifically where the lead heat is.',
    whyNow: [
      topMarkets.length
        ? `${topMarkets[0]?.market} leads the heat board with ${topMarkets[0]?.recent7d ?? 0} new leads in 7 days.`
        : 'No market heat yet — buyer recruiting can wait for inflow.',
      `${s.activePartners} active partner conversations network-wide.`,
      `${openMatches} open matches still waiting for routing.`,
    ],
    score: clampScore((topMarkets[0]?.heat ?? 0) * 0.55 + (openMatches > 5 ? 18 : 6)),
    effort: 'medium',
    expectedOutcome: 'Two to three new verified buy boxes per hot market; faster disposition on every contract.',
    directives: [
      {
        agent: 'routing',
        action: 'Route every open match or mark why not',
        detail: `${openMatches} matches are sitting. Each one either moves to a partner conversation or records a disqualifier.`,
        priority: 'high',
      },
      {
        agent: 'acquisition',
        action: 'Pull buyer prospect lists for the top heat market',
        detail: 'Recent cash purchases + active landlords in that metro become the recruiting list.',
        priority: 'normal',
      },
      {
        agent: 'outreach',
        action: 'Run buyer-criteria recruiting sequence',
        detail: 'npm run buyers:kimi-send-preview → review → buyers:kimi-send-approved.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Open buyer matches', href: '/admin/buyer-matches' },
      { label: 'Buyer recruiting preview', command: 'npm run buyers:kimi-send-preview' },
    ],
  })

  // ── 5. Capital desk activation ────────────────────────────────────────────
  plays.push({
    key: 'capital-desk-activation',
    name: 'Capital Desk Activation',
    category: 'capital',
    thesis:
      'Open funding requests and lender matches are the shortest path to fee revenue. Every analyzer run that shows a funding gap should become a lender conversation.',
    whyNow: [
      `${openFunding} funding requests open; ${s.paidFundingRequests} already paid.`,
      `Revenue gap to target: $${Math.max(0, s.revenueTarget - s.revenue30d).toLocaleString()}.`,
    ],
    score: clampScore(28 + openFunding * 6 + (s.revenue30d === 0 ? 12 : 0)),
    effort: 'medium',
    expectedOutcome: 'Funding requests move to strategy-ready; lender matches turn into program fits.',
    directives: [
      {
        agent: 'underwriting',
        action: 'Advance every open funding request one stage',
        detail: 'Missing docs requested, readiness scored, or strategy delivered — no request sits untouched.',
        priority: 'high',
      },
      {
        agent: 'routing',
        action: 'Match funding-gapped deals to lender programs',
        detail: 'Use the lender-programs fit boxes; log every match attempt.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Open funding pipeline', href: '/admin/funding' },
      { label: 'Open lender programs', href: '/admin/lender-programs' },
    ],
  })

  // ── 6. Authority city push ────────────────────────────────────────────────
  plays.push({
    key: 'authority-city-push',
    name: 'Authority Push for Heat Markets',
    category: 'visibility',
    thesis:
      'Publish proof-backed market pages and answers for the exact cities where leads are flowing, so sellers and agents who search find VestBlock already standing there.',
    whyNow: [
      `${published7d}/5 weekly publish target.`,
      topMarkets.length ? `Heat cities to target: ${topMarketNames}.` : 'Pick cities once lead heat exists.',
    ],
    score: clampScore(published7d >= 5 ? 22 : 48),
    effort: 'medium',
    expectedOutcome: 'City-level AEO coverage compounds while outreach runs — inbound starts to supplement outbound.',
    directives: [
      {
        agent: 'authority',
        action: `Publish city-specific assets for ${topMarkets[0]?.market || 'the top market'}`,
        detail: 'Seller-options FAQ, creative-finance explainer, and a market snapshot — all proof-backed, no hype.',
        priority: 'normal',
      },
      {
        agent: 'qa',
        action: 'Verify indexing on everything published this week',
        detail: 'Run the AEO scorecard and indexing push after publishing.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'AEO scorecard', command: 'npm run visibility:aeo-scorecard' },
      { label: 'Open SEO opportunities', href: '/admin/seo-opportunities' },
    ],
  })

  // ── 7. Ad creative sprint ─────────────────────────────────────────────────
  plays.push({
    key: 'ad-creative-sprint',
    name: 'Ad Creative Sprint',
    category: 'visibility',
    thesis:
      'A batch of compliant social creatives keeps the brand warm for every agent, buyer, and seller the outreach lanes touch. Outreach + retargeting-style presence beats outreach alone.',
    whyNow: [
      `${s.outreach24h}/${s.outreachTarget} outreach sends in 24h — creatives amplify whatever is running.`,
      'Facebook content calendar pipeline already exists; it just needs a fresh batch.',
    ],
    score: clampScore(s.outreach24h > 0 ? 34 : 20),
    effort: 'low',
    expectedOutcome: 'Two weeks of scheduled, compliant social proof content across the network roles.',
    directives: [
      {
        agent: 'authority',
        action: 'Generate and schedule the next content calendar batch',
        detail: 'npm run buffer:facebook-calendar → review angles → buffer:facebook-schedule to push 6.',
        priority: 'normal',
      },
      {
        agent: 'qa',
        action: 'Compliance pass on every creative',
        detail: 'No income claims, no guaranteed funding, no fabricated testimonials.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Build calendar', command: 'npm run buffer:facebook-calendar' },
      { label: 'Schedule 6 posts', command: 'npm run buffer:facebook-schedule' },
    ],
  })

  // ── 8. Distress stack refresh ─────────────────────────────────────────────
  plays.push({
    key: 'distress-stack-refresh',
    name: 'Distress Stack Refresh',
    category: 'hygiene',
    thesis:
      'The free public-records stack is the cost-zero lead engine. Keep it running daily and keep feeding the best rows into DealMachine.',
    whyNow: [
      data.localSignals.distressStackRows != null
        ? `${data.localSignals.distressStackRows.toLocaleString()} rows in the master stack.`
        : 'Master stack not visible from this environment.',
      `${s.newLeads24h} new leads in 24h across all sources.`,
    ],
    score: clampScore(s.newLeads24h < 5 ? 44 : 26),
    effort: 'low',
    expectedOutcome: 'Fresh stacked distress rows every morning with zero data cost.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Confirm the daily stack agent ran and advance 2 areas per market',
        detail: 'Check launchd log; run distress:stack:daily manually if it missed.',
        priority: 'normal',
      },
      {
        agent: 'qa',
        action: 'Review failed source runs before raising volume',
        detail: 'A failing adapter quietly starves the whole acquisition lane.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Run the daily stack', command: 'npm run distress:stack:daily' },
      { label: 'Open scrape runs', href: '/admin/scrape-runs' },
    ],
  })

  // ── 9. Partner follow-up sweep ────────────────────────────────────────────
  const partnerDue = followupsDue
  plays.push({
    key: 'partner-follow-up-sweep',
    name: 'Partner Relationship Sweep',
    category: 'hygiene',
    thesis:
      'Buyers and lenders who registered and never heard back become someone else’s network. A weekly sweep keeps the partner graph alive.',
    whyNow: [
      `${s.activePartners} partners in active conversation stages.`,
      partnerDue > 0 ? `${partnerDue} follow-ups flagged due.` : 'No flagged follow-ups right now.',
    ],
    score: clampScore(18 + (partnerDue > 0 ? 22 : 0)),
    effort: 'low',
    expectedOutcome: 'Every active partner has a next touch scheduled; stale relationships get a revival message.',
    directives: [
      {
        agent: 'routing',
        action: 'Tag every active partner with their next concrete send',
        detail: 'A deal, a market note, or a criteria check-in — relationship touches need a reason.',
        priority: 'normal',
      },
      {
        agent: 'operator',
        action: 'Schedule the weekly partner sweep',
        detail: 'Recurring Friday review of buyers/lenders with no touch in 14 days.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Open buyer network', href: '/admin/buyers' },
      { label: 'Open lender network', href: '/admin/lenders' },
    ],
  })

  plays.sort((a, b) => b.score - a.score)
  const focus = plays[0]

  return {
    generatedAt: new Date().toISOString(),
    headline: focus
      ? `Focus: ${focus.name} — ${focus.whyNow[0] || focus.thesis}`
      : 'No strategy signals available yet.',
    focusKey: focus?.key || '',
    plays,
  }
}
