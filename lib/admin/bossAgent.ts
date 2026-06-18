import 'server-only'

import type { AgentKey, CommandCenterData } from '@/lib/admin/commandCenter'
import { HIGH_VALUE_BUYER_LANES } from '@/lib/investors/builderStrategy'

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
  appliedWeight?: number
  effort: 'low' | 'medium' | 'high'
  expectedOutcome: string
  directives: BossDirective[]
  steps: BossStep[]
  complianceNote?: string
}

export type BossLessonSummary = {
  playKey: string
  playName: string
  summary: string
  adjustment: number
  completedAt: string
}

export type BossBriefing = {
  generatedAt: string
  headline: string
  focusKey: string
  plays: BossPlay[]
  lessons: BossLessonSummary[]
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export type BossLearningInput = {
  weights: Record<string, number>
  lessons: BossLessonSummary[]
}

export function buildBossBriefing(data: CommandCenterData, learning?: BossLearningInput): BossBriefing {
  const plays: BossPlay[] = []
  const s = data.summary
  const queueByLabel = new Map(data.routingQueue.map((item) => [item.label, item.count]))
  const leadFollowupsDue = queueByLabel.get('Lead follow-ups due') ?? 0
  const partnerFollowupsDue = queueByLabel.get('Partner follow-ups due') ?? 0
  const followupsDue = leadFollowupsDue + partnerFollowupsDue
  const openMatches = (queueByLabel.get('Buyer matches open') ?? 0) + (queueByLabel.get('Lender matches open') ?? 0)
  const openFunding = queueByLabel.get('Lender matches open') ?? 0
  const openChecklists = queueByLabel.get('Research checklists open') ?? 0
  const topMarkets = data.marketHeat.slice(0, 3)
  const topMarketNames = topMarkets.map((m) => m.market).join(', ') || 'active markets'
  const staleExports = data.localSignals.dmExports.filter((e) => e.ageDays > 7)
  const freshExports = data.localSignals.dmExports.filter((e) => e.ageDays <= 7)
  const authorityAgent = data.agents.find((a) => a.key === 'authority')
  const published7d = Number(authorityAgent?.kpis.find((k) => k.label === 'Published 7d')?.value ?? 0)
  const builderPartners = data.summary.builderPartners
  const dmAlignedPartners = data.summary.dealMachineAlignedPartners
  const partnerResearchReady = data.summary.partnerResearchReady
  const partnerOutreachReady = data.summary.partnerOutreachReady
  const partnerBuyBoxesConfirmed = data.summary.partnerBuyBoxesConfirmed
  const outreachGap = Math.max(0, s.outreachTarget - s.outreach24h)
  const remainingOutboundCapacity = Math.max(0, data.outboundControl.remainingToday)
  const sendReady = data.outboundControl.emailReady
  const needsReview = data.outboundControl.needsReview

  // ── 0. Daily autonomous strategy lab ──────────────────────────────────────
  plays.push({
    key: 'daily-autonomous-strategy-lab',
    name: 'Daily Autonomous Strategy Lab',
    category: 'acquisition',
    thesis:
      'VestBlock should not wait for an operator to rediscover the next move. Every morning the Boss chooses one focus strategy and one challenger strategy, pushes safe outreach toward the configured cap, and records what the market taught us.',
    whyNow: [
      `${s.outreach24h}/${s.outreachTarget} outreach touches in 24h leaves ${outreachGap} touches of target gap.`,
      `${remainingOutboundCapacity} configured outbound slot${remainingOutboundCapacity === 1 ? '' : 's'} remain today; ${sendReady} email-ready lead${sendReady === 1 ? '' : 's'} and ${needsReview} draft${needsReview === 1 ? '' : 's'} need review.`,
      topMarkets.length
        ? `Current market board points to ${topMarketNames}; use one as focus and one as challenger.`
        : 'No dominant heat market yet — use fresh DealMachine exports and reply data as the first selector.',
      `${s.replySignals7d} reply signal${s.replySignals7d === 1 ? '' : 's'} in 7 days; winner selection should optimize for real replies, not send volume alone.`,
    ],
    score: clampScore(74 + (outreachGap > 0 ? 10 : 0) + (remainingOutboundCapacity > 0 ? 6 : 0) + (s.replySignals7d < 5 ? 6 : 0)),
    effort: 'low',
    expectedOutcome:
      'A daily closed-loop growth run: one primary acquisition/outreach play, one challenger play, sends or queued tasks inside guardrails, and a lesson that changes tomorrow’s ranking.',
    directives: [
      {
        agent: 'operator',
        action: 'Choose today’s focus and challenger strategy',
        detail:
          'Compare yesterday’s replies, fresh exports, market heat, suppressions, and overdue follow-ups. Pick one lead source/market/offer angle as the focus and one challenger to test next.',
        priority: 'urgent',
      },
      {
        agent: 'acquisition',
        action: 'Refresh the lead source before increasing send volume',
        detail:
          'Prefer fresh DealMachine contact exports, portfolio/out-of-state landlord filters, stale-listing creative terms, builder buy-box sourcing, or public-record distress stacks. Do not scrape stale websites just to create activity.',
        priority: 'high',
      },
      {
        agent: 'outreach',
        action: 'Push safe seller outreach toward the configured daily cap',
        detail:
          'Use acquisitions@vestblock.io, enforce dedupe and opt-out suppressions, send only email-ready records, and keep SMS in review-only mode until the SMS lane is approved.',
        priority: 'high',
      },
      {
        agent: 'qa',
        action: 'Record the before/after KPI lesson',
        detail:
          'Snapshot sends, replies, new leads, partner criteria, and revenue movement. Boost strategies that create replies or real routing opportunities; decay ones that only create volume.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Preview seller cap run', command: 'npm run sellers:outreach:to-cap' },
      { label: 'Send to safe configured cap', command: 'npm run sellers:outreach:to-cap -- --send' },
      { label: 'Run portfolio landlord strategy', command: 'npm run sellers:outreach:portfolio-landlords -- --send' },
      { label: 'Open command center', href: '/admin/command-center' },
    ],
    complianceNote:
      'The daily lab may execute configured email sends, but it cannot ignore opt-outs, send SMS, send contracts, spend money, or make guaranteed offer/funding claims without explicit human approval.',
  })

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
        detail: `Run the stale-listing finder for ${topMarketNames} from the HomeHarvest/public listing source first. Keep paid scraping disabled until revenue justifies it.`,
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
      { label: 'Dry-run public listings', command: 'npm run boss:stale-listings -- --source=homeharvest --market="Milwaukee, WI" --min-dom=90 --limit=25' },
      { label: 'Review drafts in tmp/outreach/', href: '/admin/leads' },
      { label: 'Send after review', command: 'npm run boss:stale-listings -- --source=homeharvest --market="Milwaukee, WI" --min-dom=90 --limit=25 --send' },
    ],
    complianceNote:
      'Outreach targets listing agents (business contacts), not owners. Offers are presented as structures to review, never guaranteed purchases.',
  })

  // ── 1B. On-market as-is cash sweep ────────────────────────────────────────
  plays.push({
    key: 'on-market-lowball-agent-sweep',
    name: 'Fresh On-Market Agent Cash Review',
    category: 'acquisition',
    thesis:
      'Some public on-market listings are sitting because condition, price, or seller constraints do not fit retail buyers. Source fresh listing inventory, contact the listing agent, and position a 50-60% cash-review range as conditional on photos, access, title, representation, and real condition.',
    whyNow: [
      `Milwaukee, Toledo, and nearby value markets can be pulled from fresh on-market listing inventory without using the off-market DealMachine seller queue.`,
      `${remainingOutboundCapacity} configured outbound slot${remainingOutboundCapacity === 1 ? '' : 's'} remain today; this lane should only send agent-facing emails with opt-out and non-binding language.`,
      s.replySignals7d < 5
        ? `Only ${s.replySignals7d} reply signal${s.replySignals7d === 1 ? '' : 's'} this week — agent-facing low-cash reviews are a sharper challenger than more generic seller copy.`
        : `${s.replySignals7d} reply signals this week give the Boss enough feedback to test a more direct agent offer angle.`,
    ],
    score: clampScore(58 + (remainingOutboundCapacity >= 100 ? 12 : remainingOutboundCapacity > 0 ? 6 : 0) + (s.replySignals7d < 5 ? 8 : 0)),
    effort: 'medium',
    expectedOutcome:
      'One hundred agent-facing as-is cash-review emails across Milwaukee and Toledo when a listing source with agent emails is available; replies identify condition-heavy listings where a fast cash number is welcome.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Source fresh on-market distressed listings',
        detail:
          'Use HomeHarvest/Realtor-style active listing inventory, not the off-market DealMachine owner queue. Required fields: address, list price, DOM, listing URL, agent name, and agent email or phone.',
        priority: 'high',
      },
      {
        agent: 'underwriting',
        action: 'Attach a condition-dependent cash range to each listing',
        detail:
          'Use 50-60% of list price as the initial as-is review band, then let photos, access, title, liens, tenancy, and condition decide whether the number can move up or should be passed.',
        priority: 'high',
      },
      {
        agent: 'outreach',
        action: 'Send agent-facing cash-review emails from acquisitions@vestblock.io',
        detail:
          'Language must say non-binding, condition-dependent, representation-respecting, and open to improving the range if photos/access/condition support it.',
        priority: 'high',
      },
      {
        agent: 'qa',
        action: 'Verify the batch before live send',
        detail:
          'Confirm no opt-outs, no protected-class targeting, no guaranteed closings, no contract language, and no duplicate blast to the same listing without a property-specific reason.',
        priority: 'normal',
      },
    ],
    steps: [
      {
        label: 'Dry-run Milwaukee + Toledo',
        command: 'npm run sellers:on-market-lowball',
      },
      {
        label: 'Review generated drafts',
        href: '/admin/leads?source=on_market_listing_import',
      },
      {
        label: 'Send 100 after source + drafts are ready',
        command: 'npm run sellers:on-market-lowball:send',
      },
    ],
    complianceNote:
      'This is agent-facing outreach from fresh public listing inventory. Treat 50-60% as a conditional indication only, not a binding purchase offer. Include opt-out language, protect the agent relationship, and never imply VestBlock is a brokerage, lender, title company, or guaranteed buyer.',
  })

  // ── 2. Fresh-city DealMachine expansion ────────────────────────────────────
  const dmBlocked = freshExports.length === 0
  plays.push({
    key: 'fresh-city-dealmachine',
    name: 'Fresh-City DealMachine Loop',
    category: 'acquisition',
    thesis:
      'Philadelphia, Kansas City, and New Orleans have 14k+ DealMachine-ready addresses queued but zero contact exports. One Atlas session per city (build exact list → export Contacts with DNC fields → ingest) unlocks the whole automated outreach loop without making skip tracing the default.',
    whyNow: [
      dmBlocked
        ? 'No fresh contact exports on disk — the entire fresh-city lane is blocked on a 15-minute manual step.'
        : `${freshExports.length} fresh export(s) ready to work.`,
      staleExports.length ? `${staleExports.length} export(s) older than 7 days should be re-pulled.` : 'Export hygiene is clean.',
    ],
    score: clampScore(dmBlocked ? 78 : 40),
    effort: 'low',
    expectedOutcome: 'Three untouched metros enter the outreach loop with verified DealMachine contact exports and DNC visibility.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Build exact DealMachine contact-export lists for Philadelphia and Kansas City',
        detail: 'Generate the export request package, build the exact saved/static list in Atlas, Export Contacts with phone type and DNC columns, then drop the CSV in data/dm-exports/. Do not run DealMachine skip tracing unless explicitly approved.',
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
      { label: 'Build export request package', command: 'npm run distress:dealmachine:export-request:all' },
      { label: 'Ingest latest export', command: 'npm run distress:dealmachine:ingest-export:apply' },
      { label: 'Open the operating doc', href: '/admin/market-expansion' },
    ],
  })

  // ── 3. Tax delinquent + code violation stack ───────────────────────────────
  plays.push({
    key: 'tax-delinquent-code-violation-stack',
    name: 'Tax Delinquent + Code Violation Stack',
    category: 'acquisition',
    thesis:
      'The sharpest off-market seller list is not generic distress. Start with DealMachine tax-delinquent owners, then stack county/city code violations so outreach focuses on owners with both a financial problem and a property-condition problem.',
    whyNow: [
      'New test markets: Cleveland, Columbus, Indianapolis, and Louisville.',
      data.localSignals.distressStackRows != null
        ? `${data.localSignals.distressStackRows.toLocaleString()} public-record distress rows are already available for markets with adapters.`
        : 'The public-record stack is not visible in this environment.',
      freshExports.length
        ? `${freshExports.length} fresh DealMachine export${freshExports.length === 1 ? '' : 's'} can be overlaid with public code rows.`
        : 'Fresh DealMachine tax-delinquent exports are the current bottleneck.',
      'This gives Boss a different source/intent profile than on-market agents or portfolio landlords.',
    ],
    score: clampScore(66 + (dmBlocked ? 8 : 0) + (s.replySignals7d < 5 ? 8 : 0) + (remainingOutboundCapacity > 0 ? 4 : 0)),
    effort: 'medium',
    expectedOutcome:
      'A fresh ranked owner list for four new markets where tax delinquency and code/condition pressure overlap, ready for review before outreach.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Run the VestBlock tax/code stack play for new markets',
        detail:
          'Use the single VestBlock runner so DealMachine harvest, public-record code overlay, missing-city export planning, and stack output stay in one repeatable lane. Keep this separate from on-market listing-agent data.',
        priority: 'high',
      },
      {
        agent: 'acquisition',
        action: 'Overlay county/city code-violation rows',
        detail:
          'Use MASTER-distress-stack.csv where an adapter exists, or drop a market CSV into data/code-violations/ with address, city, state, violation, and violation_date columns.',
        priority: 'high',
      },
      {
        agent: 'outreach',
        action: 'Preview seller-options outreach for the double-stack only',
        detail:
          'Use the tax-code-stack strategy internally, but first-touch copy should not name tax delinquency, preforeclosure, code violations, liens, or dollar amounts. Keep public-record pressure as scoring/context only, avoid threats, honor suppressions, and never send SMS automatically.',
        priority: 'normal',
      },
      {
        agent: 'qa',
        action: 'Spot-check public-record match quality before sending',
        detail:
          'Verify 10 addresses manually for address joins, current tax/code status, owner identity, and no duplicate outreach before live email.',
        priority: 'normal',
      },
    ],
    steps: [
      {
        label: 'Run VestBlock tax/code play',
        command:
          'npm run vestblock:tax-code-stack -- --markets="Kansas City,MO|Omaha,NE|Des Moines,IA|Wichita,KS" --per-city=30',
      },
      {
        label: 'Run and build missing DealMachine lists',
        command:
          'npm run vestblock:tax-code-stack:build -- --markets="Kansas City,MO|Omaha,NE|Des Moines,IA|Wichita,KS" --per-city=30',
      },
      {
        label: 'Preview outreach from stack',
        command:
          'npm run distress:dealmachine:export-outreach -- --strategy=tax-code-stack --market=kansas-city-mo --queue-csv=data/distress-leads/dealmachine-tax-code-stack-<stamp>.csv --export-csv=data/dm-exports/kansas-city-mo-<date>.csv --limit=30',
      },
    ],
    complianceNote:
      'Use public-record signals internally only on first touch. Do not name tax delinquency, preforeclosure, code violations, liens, or dollar amounts unless a human approves that context for a reply. Do not shame, threaten, imply government affiliation, promise legal/tax relief, or send texts without an approved consent lane. Email only after suppression and match-quality review.',
  })

  // ── 3B. Pre-auction distress routing ───────────────────────────────────────
  plays.push({
    key: 'pre-auction-distress-routing-layer',
    name: 'Pre-Auction Distress Routing Layer',
    category: 'acquisition',
    thesis:
      'Foreclosure and distress leads should not all receive the same cash-buyer pitch. Route each property into cash, assignment, novation, short sale, subject-to, seller finance, buyer match, lender referral, attorney referral, or surplus follow-up before outreach.',
    whyNow: [
      data.foreclosureCommand.summary,
      `${data.foreclosureCommand.countySources.length} starter county lanes are configured: ${data.foreclosureCommand.countySources
        .map((source) => `${source.market} ${source.state}`)
        .join(', ')}.`,
      `Sample route is ${data.foreclosureCommand.sampleRoute.urgency} with best exit ${data.foreclosureCommand.sampleRoute.bestExit.replace(/_/g, ' ')}.`,
      freshExports.length
        ? `${freshExports.length} fresh DealMachine export${freshExports.length === 1 ? '' : 's'} can be stacked with public distress evidence now.`
        : 'Fresh DealMachine exports are still the bottleneck before this can send at scale.',
    ],
    score: clampScore(
      70 +
        (data.foreclosureCommand.status === 'green' ? 8 : data.foreclosureCommand.status === 'yellow' ? 2 : -6) +
        (remainingOutboundCapacity > 0 ? 4 : 0) +
        (openMatches > 0 ? 4 : 0)
    ),
    effort: 'medium',
    expectedOutcome:
      'Distress leads enter the right lane before contact, which should raise reply quality, protect compliance, and create bigger assignment opportunities than generic lowball outreach.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Run the county source checklist before outreach',
        detail:
          'Prioritize Milwaukee, Toledo, Cleveland, Detroit, and Waukesha. Attach foreclosure/tax/code/vacancy/auction evidence to the lead record for scoring and routing, but keep that evidence out of first-touch copy unless a human approves it.',
        priority: 'high',
      },
      {
        agent: 'underwriting',
        action: 'Route every distress lead through the exit-option stack',
        detail:
          'Score cash offer, assignment, novation, short sale, subject-to, seller finance, buyer match, lender referral, attorney referral, and surplus follow-up. Use the best exit to determine copy and next action.',
        priority: 'high',
      },
      {
        agent: 'outreach',
        action: 'Keep distress copy separated by exit bucket',
        detail:
          'Do not mix foreclosure, tax-code, on-market, portfolio landlord, buyer-match, or referral language. Each lane needs its own subject line, ask, and compliance footer, and sensitive source signals stay internal on first touch.',
        priority: 'high',
      },
      {
        agent: 'qa',
        action: 'Gate sensitive foreclosure paths',
        detail:
          'Owner-occupant foreclosure, subject-to, short sale, probate, and bankruptcy dismissal need attorney/housing-counselor guardrails before anything sends.',
        priority: 'urgent',
      },
    ],
    steps: [
      {
        label: 'Build fresh DealMachine lists',
        command: 'pnpm run distress:dealmachine:website-list-builder:build -- --max-builds=30 --max-count=250',
      },
      { label: 'Request export package', command: 'pnpm run distress:dealmachine:export-request:all' },
      { label: 'Ingest latest export', command: 'pnpm run distress:dealmachine:ingest-export:apply' },
      { label: 'Open command center', href: '/admin/command-center' },
    ],
    complianceNote:
      'No foreclosure-stop promises, no upfront foreclosure-rescue fees, no legal/tax advice, no bank/government impersonation, and no subject-to or owner-occupant foreclosure paperwork without attorney-reviewed language.',
  })

  // ── 4. Reply resurrection ──────────────────────────────────────────────────
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

  // ── 5. High-fee buyer lanes ──────────────────────────────────────────────
  plays.push({
    key: 'high-fee-assignment-lanes',
    name: 'High-Fee Assignment Lanes',
    category: 'conversion',
    thesis:
      'Bigger assignment fees come from sharper buyer lanes: builders, multifamily operators, BTR/SFR buyers, commercial operators, and disclosed novation partners. The Boss should source sellers only after the matching buyer criteria are real.',
    whyNow: [
      `${HIGH_VALUE_BUYER_LANES.length} premium buyer lanes are defined for strategy selection.`,
      `${builderPartners} builder/developer profile${builderPartners === 1 ? '' : 's'} in the engine; ${partnerBuyBoxesConfirmed} confirmed buy box${partnerBuyBoxesConfirmed === 1 ? '' : 'es'} across all partners.`,
      topMarkets.length ? `Use ${topMarketNames} first unless fresh exports point elsewhere.` : 'Use fresh DealMachine exports first until market heat is clearer.',
      `${remainingOutboundCapacity} outbound slot${remainingOutboundCapacity === 1 ? '' : 's'} remain today; keep premium lanes separated from generic seller outreach.`,
    ],
    score: clampScore(62 + Math.min(18, builderPartners * 2) + Math.min(12, partnerBuyBoxesConfirmed * 2) + (remainingOutboundCapacity > 0 ? 8 : 0)),
    effort: 'medium',
    expectedOutcome: 'Premium seller plays run with a matching buyer lane, a fee thesis, and a qualification gate before any offer language is used.',
    directives: [
      {
        agent: 'outreach',
        action: 'Recruit high-value buyers by lane',
        detail:
          'Run builder/developer, multifamily operator, BTR/SFR, commercial/small-bay, and novation-friendly buyer criteria outreach as separate lanes.',
        priority: 'high',
      },
      {
        agent: 'acquisition',
        action: 'Source seller lists that match premium buyer lanes',
        detail:
          'Do not mix generic off-market leads into this lane. Use DealMachine tax/code, portfolio, property type, vacancy, lot, and value filters that match the selected buyer lane.',
        priority: 'high',
      },
      {
        agent: 'underwriting',
        action: 'Require a premium-lane qualification gate',
        detail:
          'Before quoting numbers, confirm the lane-specific facts: zoning/lot rules for builders, rent roll for multifamily, buy-box bands for BTR, use/leases for commercial, and seller consent for novation.',
        priority: 'high',
      },
      {
        agent: 'operator',
        action: 'Keep high-fee batches separate in the command center',
        detail:
          'Track strategy key, buyer lane, fee thesis, qualification gate, reply rate, appointment rate, and contract/dispo result so the Boss can learn which lane deserves more volume.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Discover builder partners', command: 'npm run investors:builders:discover' },
      { label: 'Builder infill seller batch', command: 'npm run sellers:high-fee:builder-infill -- --market="milwaukee-wi|toledo-oh" --limit=100' },
      { label: 'Land wholesale seller batch', command: 'npm run sellers:high-fee:land-wholesale -- --market="milwaukee-wi|toledo-oh|columbus-oh|cincinnati-oh" --limit=100 --cash-min-pct=0.30 --cash-max-pct=0.50' },
      { label: 'Multifamily seller batch', command: 'npm run sellers:high-fee:small-multifamily -- --market="cleveland-oh|toledo-oh" --limit=100' },
      { label: 'Commercial seller batch', command: 'npm run sellers:high-fee:commercial-distress -- --market="milwaukee-wi|cleveland-oh" --limit=100' },
    ],
    complianceNote:
      'Premium-lane fees still require clean contracts, disclosure, suppression checks, and state/local compliance review. Novation and assignment language must be especially explicit.',
  })

  // ── 5. Buyer depth in hot markets ─────────────────────────────────────────
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

  // ── 5. Builder buy-box lane ──────────────────────────────────────────────
  plays.push({
    key: 'builder-buybox-disposition-lane',
    name: 'Builder Buy-Box Disposition Lane',
    category: 'conversion',
    thesis:
      'Builders, developers, and construction groups can move deals that normal cash-buyer lists ignore. Collect their real build criteria first, then route teardown, infill, and heavy-rehab opportunities with an MAO-backed assignment plan.',
    whyNow: [
      topMarkets.length ? `Best first markets: ${topMarketNames}.` : 'Start in the best current lead markets.',
      freshExports.length
        ? `${freshExports.length} fresh DealMachine export(s) can feed builder-fit seller outreach once buy boxes are clear.`
        : 'Builder recruiting should start before the next DealMachine export lands.',
      builderPartners > 0
        ? `${builderPartners} builder/developer profile${builderPartners === 1 ? '' : 's'} in the engine · ${partnerOutreachReady} outreach ready · ${partnerBuyBoxesConfirmed} confirmed.`
        : 'No builder criteria confirmed yet — this lane still needs partner-side sourcing.',
      dmAlignedPartners > 0
        ? `${dmAlignedPartners} partner profile${dmAlignedPartners === 1 ? '' : 's'} already overlap active DealMachine markets.`
        : 'DealMachine market overlap still needs more partner coverage.',
      `${openMatches} open matches and ${openChecklists} open checklists mean there is already deal-routing work to sharpen.`,
    ],
    score: clampScore(34 + (freshExports.length > 0 ? 16 : 6) + (openMatches > 4 ? 10 : 0) + Math.min(16, builderPartners * 2) + Math.min(8, partnerResearchReady)),
    effort: 'medium',
    expectedOutcome: 'A real builder lane with verified criteria, builder packets, and assignment drafts ready when a seller file fits.',
    directives: [
      {
        agent: 'acquisition',
        action: 'Discover builder and construction partners in active VestBlock markets',
        detail: 'Use the builder-specific investor discovery pass so developers, builders, and construction groups enter the partner engine with builder-lane tags and DealMachine market alignment.',
        priority: 'high',
      },
      {
        agent: 'outreach',
        action: 'Collect builder buy boxes before sending deals',
        detail: 'Ask for neighborhoods, lot rules, teardown vs rehab preference, max all-in basis, close speed, and hard no-go items before anything reaches outreach-ready.',
        priority: 'high',
      },
      {
        agent: 'underwriting',
        action: 'Run builder packet math on every likely rehab or infill file',
        detail: 'Use the analyzer builder lane to size MAO, seller-offer target, assignment fee, and contract defaults before outreach.',
        priority: 'normal',
      },
      {
        agent: 'routing',
        action: 'Move seller files into builder-fit assignment packets',
        detail: 'Once a builder says yes, prep the assignment draft immediately and confirm earnest money, close window, and assignee entity.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Discover builder partners', command: 'npm run investors:builders:discover' },
      { label: 'Open partner engine', href: '/admin/investor-partnerships' },
      { label: 'Open property analyzer', href: '/property-analyzer' },
    ],
    complianceNote:
      'Treat all builder math as planning-grade until title, access, zoning, scope, and local contract review are confirmed.',
  })

  // ── 6. Capital desk activation ────────────────────────────────────────────
  plays.push({
    key: 'capital-desk-activation',
    name: 'Capital Desk Activation',
    category: 'capital',
    thesis:
      'Open lender matches are the shortest path to fee revenue. Every analyzer run that shows a funding gap should become a lender conversation with a clear next step.',
    whyNow: [
      `${openFunding} lender matches open; ${s.partnerBuyBoxesConfirmed} partner criteria confirmed.`,
      `Revenue gap to target: $${Math.max(0, s.revenueTarget - s.revenue30d).toLocaleString()}.`,
    ],
    score: clampScore(28 + openFunding * 6 + (s.revenue30d === 0 ? 12 : 0)),
    effort: 'medium',
    expectedOutcome: 'Funding-gap deals move into lender conversations and clearer underwriting paths.',
    directives: [
      {
        agent: 'underwriting',
        action: 'Advance every lender-fit deal one stage',
        detail: 'Request missing docs, sharpen assumptions, and turn each viable file into a lender-ready packet.',
        priority: 'high',
      },
      {
        agent: 'routing',
        action: 'Match funding-gapped deals to confirmed lenders',
        detail: 'Use the confirmed criteria in the lender network and log every route attempt.',
        priority: 'normal',
      },
    ],
    steps: [
      { label: 'Open lender matches', href: '/admin/lender-matches' },
      { label: 'Open lender network', href: '/admin/lenders' },
    ],
  })

  // ── 7. Authority city push ────────────────────────────────────────────────
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
      { label: 'Open research queue', href: '/admin/research' },
    ],
  })

  // ── 8. Ad creative sprint ─────────────────────────────────────────────────
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

  // ── 9. Distress stack refresh ─────────────────────────────────────────────
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

  // ── 10. Partner follow-up sweep ───────────────────────────────────────────
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

  // ── 11. Renovation spread check (rehab budgets → real MAO spreads) ───────
  plays.push({
    key: 'renovation-spread-check',
    name: 'Repair Budget Check',
    category: 'capital',
    thesis:
      'Stale and distressed inventory usually needs work — the spread is only real after a rehab budget. Run a repair-budget pass on every analyzed property so offers, buyer packets, and lender asks carry a defensible range instead of a guess.',
    whyNow: [
      `${openFunding} lender matches and ${openMatches} open matches could carry rehab-backed numbers.`,
      'The analyzer can attach rough repair ranges and MAO math before a packet goes out.',
    ],
    score: clampScore(24 + openMatches * 2 + (openFunding > 0 ? 8 : 0)),
    effort: 'low',
    expectedOutcome: 'Every routed deal ships with a budget range, trade checklist, and MAO spread — fewer renegotiations.',
    directives: [
      {
        agent: 'underwriting',
        action: 'Run repair-budget estimates on all active deals',
        detail: 'Use the analyzer with sqft, scope, state, and condition notes so each packet carries a repair range and MAO.',
        priority: 'normal',
      },
      {
        agent: 'routing',
        action: 'Attach rehab budgets to buyer packets before routing',
        detail: 'Buyers move faster on deals with a credible repair range and trade checklist.',
        priority: 'normal',
      },
    ],
    steps: [{ label: 'Open the command center analyzer', href: '/admin/command-center' }],
  })

  // Apply learned weights from completed-play retrospectives
  const weights = learning?.weights || {}
  for (const play of plays) {
    const weight = Math.round(weights[play.key] || 0)
    if (weight !== 0) {
      play.appliedWeight = weight
      play.score = clampScore(play.score + weight)
    }
  }

  plays.sort((a, b) => b.score - a.score)
  const focus = plays[0]

  return {
    generatedAt: new Date().toISOString(),
    headline: focus
      ? `Focus: ${focus.name} — ${focus.whyNow[0] || focus.thesis}`
      : 'No strategy signals available yet.',
    focusKey: focus?.key || '',
    plays,
    lessons: learning?.lessons || [],
  }
}
