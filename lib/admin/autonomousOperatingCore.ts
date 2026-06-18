export type CommandStatus = 'green' | 'yellow' | 'red'

export type SourceCostLane = {
  provider: string
  label: string
  status: string
  canRun: boolean
  costTier: string
  reason: string
}

export type AutopilotJobType =
  | 'daily_strategy_plan'
  | 'source_rotation'
  | 'seller_outreach_batch'
  | 'reply_memory_sync'
  | 'suppression_sync'
  | 'followup_router'
  | 'deal_routing_sync'

export type AutopilotJobDefinition = {
  jobKey: string
  jobType: AutopilotJobType
  title: string
  cadence: string
  priority: number
  strategyKey?: string | null
  sourceProvider?: string | null
  market?: string | null
  config: Record<string, unknown>
}

export type AutopilotJobRow = {
  id?: string
  job_key?: string
  job_type?: AutopilotJobType | string
  title?: string
  status?: string
  cadence?: string
  priority?: number
  strategy_key?: string | null
  source_provider?: string | null
  market?: string | null
  next_run_at?: string | null
  last_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  config_json?: Record<string, unknown> | null
  metrics_json?: Record<string, unknown> | null
}

export type AutopilotRunRow = {
  id?: string
  strategy_key?: string
  strategy_name?: string
  status?: string
  source_provider?: string
  market?: string | null
  target_email_count?: number
  target_sms_count?: number
  lead_count?: number
  draft_count?: number
  approved_count?: number
  sent_count?: number
  sms_review_count?: number
  suppression_blocked_count?: number
  cost_guardrail_status?: string
  artifact_path?: string | null
  created_at?: string | null
  completed_at?: string | null
  metadata_json?: Record<string, unknown> | null
}

export type AutopilotReplyMemoryRow = {
  id?: string
  strategy_key?: string | null
  mailbox?: string | null
  from_email?: string | null
  subject?: string | null
  property_address?: string | null
  market?: string | null
  classification?: string | null
  received_at?: string | null
  next_step?: string | null
  reply_summary?: string | null
}

export type StrategyBatchPlan = {
  strategyKey: string
  strategyName: string
  sourceProvider: 'dealmachine' | 'homeharvest' | 'public_records' | 'manual_csv' | 'instantly'
  feeThesis: string
  targetBuyerLane: string
  qualificationGate: string
  status: CommandStatus
  markets: string[]
  targetEmailCount: number
  targetSmsReviewCount: number
  blockedReason: string | null
  command: string
  copyGuardrail: string
}

export type SourceDoctrineLane = {
  key: 'seller_stacking' | 'network_capture' | 'dispatch'
  label: string
  primarySources: string[]
  useFor: string[]
  doNotUseFor: string[]
  dailyLoopRule: string
  commandHints: string[]
}

export type AutopilotSnapshotInput = {
  now?: Date
  remainingToday: number
  sentToday: number
  emailReady: number
  needsReview: number
  followupsDue: number
  replySignals7d: number
  partnerBuyBoxesConfirmed: number
  sellerLeads: number
  activeSuppressionCount: number
  missingSuppressionDb: boolean
  sourceLanes: SourceCostLane[]
  marketHeat: { market: string; heat?: number; leads?: number; replied?: number }[]
  nextRefreshMarkets: string[]
  campaigns: {
    key: string
    label: string
    sent: number
    failed: number
    blocked: number
    replies: number
    lastEventAt: string | null
  }[]
  jobs?: AutopilotJobRow[]
  strategyRuns?: AutopilotRunRow[]
  replyMemory?: AutopilotReplyMemoryRow[]
  suppressionDecisions?: { decision?: string | null; created_at?: string | null }[]
}

export type AutopilotSnapshot = {
  status: CommandStatus
  enabled: boolean
  mode: 'plan_only' | 'dispatch_ready' | 'send_ready' | 'blocked'
  summary: string
  nextMove: string
  lastRunAt: string | null
  nextRunAt: string | null
  durable: {
    jobsConfigured: number
    jobsDue: number
    activeJobs: number
    strategyRuns7d: number
    replyMemories7d: number
    suppressionBlocks7d: number
  }
  sourceDoctrine: SourceDoctrineLane[]
  batches: StrategyBatchPlan[]
  guardrails: {
    label: string
    value: string | number
    status: CommandStatus
    detail: string
  }[]
}

const DEFAULT_MARKETS = ['Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Detroit, MI']

export const SOURCE_DOCTRINE: SourceDoctrineLane[] = [
  {
    key: 'seller_stacking',
    label: 'Seller stacking and public-record evidence',
    primarySources: ['DealMachine', 'DataPipe/Outscraper', 'county/public records', 'HomeHarvest/on-market sweeps'],
    useFor: [
      'motivated seller lists',
      'tax delinquent + code violation stacks',
      'vacant/absentee/landlord owner signals',
      'on-market stale/condition-heavy listings',
      'county record source maps and checklist evidence',
    ],
    doNotUseFor: [
      'generic buyer network building',
      'lender list building',
      'national acquisition-manager prospecting',
    ],
    dailyLoopRule:
      'Use DataPipe/Outscraper only when a stack, county source, map/local operator, builder, or public-record lane needs company/location evidence; do not spend it on generic network prospecting.',
    commandHints: [
      'distress:dealmachine:export-request:all',
      'outscraper:county-records',
      'outscraper:fire-damage',
      'outscraper:land',
    ],
  },
  {
    key: 'network_capture',
    label: 'Buyer, lender, builder, and operator lead capture',
    primarySources: ['Instantly SuperSearch/Lead Finder', 'Instantly campaigns', 'manual CSV import'],
    useFor: [
      'cash buyers and real estate investors',
      'hard money, private money, DSCR, bridge, and construction lenders',
      'builders and developers',
      'wholesalers and disposition managers',
      'acquisition managers and property operators',
    ],
    doNotUseFor: [
      'motivated seller discovery',
      'tax delinquent source creation',
      'foreclosure/probate/code source evidence',
      'county record scraping',
    ],
    dailyLoopRule:
      'Use Instantly as the default network-building source. Capture buy boxes, lending criteria, acquisition criteria, markets served, and referral/JV fit; route replies into buyer/lender/builder memory.',
    commandHints: [
      'instantly:doctor',
      'instantly:demand',
      'instantly:push',
      'instantly:campaign',
    ],
  },
  {
    key: 'dispatch',
    label: 'Outbound dispatch and learning',
    primarySources: ['Instantly campaigns', 'acquisitions@vestblock.io', 'command-center reply memory'],
    useFor: [
      'network outreach dispatch',
      'warm-start buyer/lender campaigns',
      'reply classification',
      'suppression learning',
      'buy-box and lender-criteria memory',
    ],
    doNotUseFor: [
      'unreviewed SMS sending',
      'mixing seller and network copy in the same campaign',
      'sending from contact@vestblock.io unless explicitly approved',
    ],
    dailyLoopRule:
      'Keep seller campaigns, buyer/lender/builder campaigns, and follow-up campaigns separated. Stop on reply, learn the criteria, and update the next source decision before adding volume.',
    commandHints: [
      'outlook acquisitions monitor',
      'instantly:campaign',
      'lead source shootout after each new source test',
    ],
  },
]

const STRATEGY_DEFINITIONS: Array<Omit<StrategyBatchPlan, 'status' | 'markets' | 'targetEmailCount' | 'targetSmsReviewCount' | 'blockedReason' | 'command'>> = [
  {
    strategyKey: 'buyer-demand-capture',
    strategyName: 'Buyer demand capture',
    sourceProvider: 'instantly',
    feeThesis: '$15k-$50k+ when seller outreach is aimed at buyers whose buy boxes are already verified.',
    targetBuyerLane: 'Cash buyers, dispo managers, acquisition managers, landlords, and local investor operators',
    qualificationGate: 'Instantly/contact source + real estate role + market served + buy-box or acquisition criteria captured',
    copyGuardrail:
      'Ask for buy-box criteria and partnership fit; do not send property claims, guaranteed deal flow, or seller-style copy.',
  },
  {
    strategyKey: 'capital-desk-lender-capture',
    strategyName: 'Capital desk lender capture',
    sourceProvider: 'instantly',
    feeThesis: '$10k-$40k referral/JV upside when deals with funding gaps can be routed to lenders fast.',
    targetBuyerLane: 'Hard money, private money, DSCR, bridge, construction, and transactional lenders',
    qualificationGate: 'Lender role + states served + product type + minimum deal size + borrower/deal no-go rules',
    copyGuardrail:
      'Collect lending criteria only; do not promise borrower volume, approvals, rates, terms, or closings.',
  },
  {
    strategyKey: 'developer-builder-demand-capture',
    strategyName: 'Developer / builder demand capture',
    sourceProvider: 'instantly',
    feeThesis: '$25k-$100k+ when land, fire damage, teardown, or infill seller leads are matched to builders before offer follow-up.',
    targetBuyerLane: 'Developers, infill builders, general contractors, land buyers, and construction company owners',
    qualificationGate: 'Builder/developer role + markets served + asset appetite + lot/rehab/fire-damage tolerance captured',
    copyGuardrail:
      'Ask what they buy/build and where; do not imply a specific property is available unless a real packet is ready.',
  },
  {
    strategyKey: 'creative-finance-buyer-capture',
    strategyName: 'Creative finance buyer capture',
    sourceProvider: 'instantly',
    feeThesis: '$15k-$60k+ when lowball cash offers can be followed by subject-to, seller-finance, or hybrid terms for buyers who actually understand them.',
    targetBuyerLane: 'Subject-to buyers, seller-finance buyers, wrap buyers, rental operators, and creative acquisition managers',
    qualificationGate: 'Creative finance role/keywords + proof of activity + markets served + minimum cash-flow criteria',
    copyGuardrail:
      'Keep it criteria-first; do not discuss due-on-sale, legal conclusions, or specific seller terms until attorney-reviewed property facts exist.',
  },
  {
    strategyKey: 'tax-code-stack',
    strategyName: 'Tax delinquent + code violation',
    sourceProvider: 'dealmachine',
    feeThesis: '$12k-$25k when the stack creates real urgency and the buyer packet is clean.',
    targetBuyerLane: 'Local cash buyers, landlords, and heavy-rehab operators',
    qualificationGate: 'Tax delinquent signal + code/condition signal + suppression-safe owner match',
    copyGuardrail:
      'Reference property updates and a simple cash/terms review without shaming the owner, threatening tax consequences, or implying government affiliation.',
  },
  {
    strategyKey: 'senior-out-of-state-landlord',
    strategyName: 'Senior / out-of-state landlord portfolio',
    sourceProvider: 'dealmachine',
    feeThesis: '$15k-$40k+ when one seller controls multiple doors or wants a clean portfolio exit.',
    targetBuyerLane: 'Portfolio landlords, DSCR buyers, and small multifamily operators',
    qualificationGate: 'Absentee/out-of-state or senior signal + portfolio/landlord pattern',
    copyGuardrail:
      'Keep copy low-pressure: ask whether simplifying one or more rentals is useful, and offer cash or flexible terms depending on condition.',
  },
  {
    strategyKey: 'builder-infill-teardown',
    strategyName: 'Builder infill / teardown lane',
    sourceProvider: 'dealmachine',
    feeThesis: '$20k-$75k+ when the land, teardown, or infill value is worth more to a builder than to a normal flipper.',
    targetBuyerLane: 'Infill builders, developers, construction companies, and land buyers',
    qualificationGate: 'Vacant/code/teardown/lot signal + builder-fit market + zoning/access review before offer',
    copyGuardrail:
      'Ask for condition and timing details without overpromising; disclose that builder pricing depends on access, title, zoning, and scope.',
  },
  {
    strategyKey: 'land-wholesale',
    strategyName: 'Land wholesale / developer activity',
    sourceProvider: 'dealmachine',
    feeThesis: '$15k-$60k+ when a vacant lot, land parcel, or teardown/infill file is worth more to a developer than the owner-facing value signal implies.',
    targetBuyerLane: 'Infill developers, builders, land buyers, lot assemblers, and construction companies',
    qualificationGate: 'Vacant/land/lot signal + developer activity score + title/access/utilities/zoning review before final price',
    copyGuardrail:
      'Use only a conditional 30-50% first-pass review range based on public value/listing signals; never present it as a final offer before buildability, utilities, access, survey, title, and liens are checked.',
  },
  {
    strategyKey: 'small-multifamily-portfolio',
    strategyName: 'Small multifamily / portfolio breakup',
    sourceProvider: 'dealmachine',
    feeThesis: '$25k-$100k when the opportunity is two to twenty doors or a tired-landlord package.',
    targetBuyerLane: 'Multifamily operators, 1031 buyers, rental aggregators, and DSCR-ready landlords',
    qualificationGate: 'Duplex/multifamily/portfolio signal + rent/occupancy unknowns captured before underwriting',
    copyGuardrail:
      'Keep the ask around simplifying management or reviewing multiple properties; do not imply tenants, age, or distance are a problem unless the owner says so.',
  },
  {
    strategyKey: 'institutional-btr-buybox',
    strategyName: 'Institutional / BTR buy-box lane',
    sourceProvider: 'dealmachine',
    feeThesis: '$20k-$60k+ when several SFR, lot, or build-ready opportunities match a verified institutional buy box.',
    targetBuyerLane: 'Build-to-rent groups, SFR aggregators, and institutional rental buyers',
    qualificationGate: 'Market + price band + property type match against a confirmed buyer buy box before seller pressure',
    copyGuardrail:
      'Never name-drop institutional buyers as guaranteed demand; say we are reviewing whether the property fits active buyer criteria.',
  },
  {
    strategyKey: 'on-market-lowball-agent-sweep',
    strategyName: 'On-market agent cash review',
    sourceProvider: 'dealmachine',
    feeThesis: '$8k-$20k when the agent has stale/condition-heavy inventory and the spread survives dispo.',
    targetBuyerLane: 'Cash buyers, rehabbers, and agent-friendly investors',
    qualificationGate: 'Active/pending/on-market signal + condition discount + agent-safe communication path',
    copyGuardrail:
      'Position the low cash range as condition-dependent review room, never as a final take-it-or-leave-it insult.',
  },
  {
    strategyKey: 'novation-retail-spread',
    strategyName: 'Novation / retail-spread lane',
    sourceProvider: 'homeharvest',
    feeThesis: '$20k-$80k+ net spread when retail demand exists but a cash MAO is too low.',
    targetBuyerLane: 'Retail buyers, agent partners, and novation-friendly operators',
    qualificationGate: 'Seller consent + attorney/contract review + clear disclosure of resale path before marketing',
    copyGuardrail:
      'Use only disclosed market-assisted language; do not hide resale price, fee structure, agency status, or buyer/seller obligations.',
  },
  {
    strategyKey: 'commercial-small-bay-distress',
    strategyName: 'Commercial / small-bay distress',
    sourceProvider: 'dealmachine',
    feeThesis: '$30k-$150k+ when a commercial, mixed-use, storage, or small-bay asset has a specialized operator buyer.',
    targetBuyerLane: 'Small-bay industrial buyers, storage operators, mixed-use investors, and local developers',
    qualificationGate: 'Commercial/mixed-use signal + title/use/zoning facts collected before quoting any number',
    copyGuardrail:
      'Keep the message exploratory and fact-finding; commercial pricing must stay conditional on use, leases, environmental, zoning, and access.',
  },
  {
    strategyKey: 'failed-landlord-exit',
    strategyName: 'Failed landlord exit',
    sourceProvider: 'dealmachine',
    feeThesis: '$15k-$50k+ when a tired landlord has taxes, liens, vacancy, evictions, distance, or management friction and wants one property or a small group off the board.',
    targetBuyerLane: 'Local landlords, DSCR buyers, small multifamily operators, and cash-flow investors',
    qualificationGate: 'Landlord/portfolio signal + absentee/out-of-state/tax/lien/vacancy friction + contact export with DNC fields',
    copyGuardrail:
      'Use low-pressure simplification language; never shame the owner, claim tenant problems without proof, or imply tax/legal consequences.',
  },
  {
    strategyKey: 'insurance-damage-event',
    strategyName: 'Insurance / damage event',
    sourceProvider: 'dealmachine',
    feeThesis: '$20k-$75k+ when fire, storm, boarded, shell, or insurance-delay sellers can be matched to heavy-rehab buyers before retail repairs are attempted.',
    targetBuyerLane: 'Fire-damage buyers, restoration contractors, heavy-rehab investors, and builders',
    qualificationGate: 'Damage/condition proxy + owner contact export + buyer lane confirmed for fire/structural/heavy-rehab risk',
    copyGuardrail:
      'Ask for photos/details; keep all pricing conditional on access, title, insurance status, scope, utilities, and safety.',
  },
  {
    strategyKey: 'zombie-rehab',
    strategyName: 'Zombie rehab / stalled project',
    sourceProvider: 'dealmachine',
    feeThesis: '$20k-$80k+ when another owner or investor has an unfinished project, stalled permit, lien, or capital gap and needs an exit.',
    targetBuyerLane: 'Heavy rehabbers, contractor-buyers, builders, and private-money-backed operators',
    qualificationGate: 'Vacant/rehab/lien/tax/code/permit proxy + title and access diligence before any number',
    copyGuardrail:
      'Do not accuse the owner of failing a project; frame it as a clean as-is review if the project is paused or no longer worth the time.',
  },
  {
    strategyKey: 'senior-downsizer',
    strategyName: 'Equity-rich downsizer',
    sourceProvider: 'dealmachine',
    feeThesis: '$10k-$35k when a high-equity owner wants a simple as-is exit, downsizing path, or flexible sale without retail prep.',
    targetBuyerLane: 'Cash buyers, creative buyers, and local owner-occupant/landlord buyers depending on condition',
    qualificationGate: 'High-equity/long-hold proxy + soft outreach + no age/protected-class assumptions in copy',
    copyGuardrail:
      'Do not mention age unless the owner introduced it. Keep the message respectful, optional, and focused on simplifying or understanding options.',
  },
  {
    strategyKey: 'rent-gap-multifamily',
    strategyName: 'Small multifamily rent-gap lane',
    sourceProvider: 'dealmachine',
    feeThesis: '$25k-$100k+ when a duplex, fourplex, or small portfolio has below-market rents or operational upside that cash-flow buyers will pay for.',
    targetBuyerLane: 'Small multifamily investors, DSCR buyers, 1031 buyers, and portfolio landlords',
    qualificationGate: 'Small multifamily/portfolio signal + rent roll or rent estimate range needed before buyer packet',
    copyGuardrail:
      'Do not claim rents are below market until verified; ask for rent roll/occupancy and present ranges only after analysis.',
  },
  {
    strategyKey: 'probate-vacant-equity',
    strategyName: 'Probate + vacant + equity',
    sourceProvider: 'dealmachine',
    feeThesis: '$15k-$60k when estate, inherited, vacant, or cleanout-heavy properties can sell as-is without heirs managing repairs.',
    targetBuyerLane: 'Cash buyers, landlords, cleanout-friendly rehabbers, and local operators',
    qualificationGate: 'Estate/probate/vacancy/equity proxy + owner/heir identity verification before outreach scale',
    copyGuardrail:
      'Use sensitive language. Do not imply death, probate, or family status unless the source data is explicit and verified.',
  },
  {
    strategyKey: 'tired-airbnb-midterm',
    strategyName: 'Tired Airbnb / midterm rental',
    sourceProvider: 'dealmachine',
    feeThesis: '$15k-$45k when short-term or midterm rental operators are tired of occupancy, regulations, reviews, or furnishing costs.',
    targetBuyerLane: 'Furnished rental buyers, landlords, creative buyers, and local cash-flow investors',
    qualificationGate: 'Rental/STR/operator proxy + performance pain confirmed by owner or public listing signal before strong claims',
    copyGuardrail:
      'Do not claim poor occupancy or bad performance without owner confirmation. Ask if the rental plan changed.',
  },
  {
    strategyKey: 'utility-lien-water-shutoff',
    strategyName: 'Utility / water lien pressure',
    sourceProvider: 'dealmachine',
    feeThesis: '$12k-$35k when water, utility, nuisance, municipal, tax, or lien friction shows distress before foreclosure.',
    targetBuyerLane: 'Local cash buyers, code-repair operators, and landlords comfortable with municipal issues',
    qualificationGate: 'Municipal/lien/tax proxy + current public-record check before referencing any specific item',
    copyGuardrail:
      'Never threaten consequences or imply government affiliation. If a municipal signal may be stale, say so clearly.',
  },
  {
    strategyKey: 'contractor-distress-flip',
    strategyName: 'Contractor distress buyer-seller flip',
    sourceProvider: 'dealmachine',
    feeThesis: '$20k-$75k+ when damaged/heavy-rehab sellers can be matched to contractors and restoration buyers already comfortable with scope risk.',
    targetBuyerLane: 'Restoration companies, contractor-buyers, fire-damage buyers, structural rehabbers, and builders',
    qualificationGate: 'Heavy-repair signal + buyer criteria captured + photos/scope requested before pricing',
    copyGuardrail:
      'Ask for photos/details first; pricing must stay conditional on scope, permits, title, utilities, safety, and access.',
  },
  {
    strategyKey: 'small-commercial-owner-exit',
    strategyName: 'Small commercial owner exit',
    sourceProvider: 'dealmachine',
    feeThesis: '$30k-$150k+ when mixed-use, small-bay, retail, office, or storage owners need a specialized operator instead of a generic residential buyer.',
    targetBuyerLane: 'Small-bay industrial buyers, mixed-use operators, storage buyers, developers, and local business-owner investors',
    qualificationGate: 'Use/zoning/lease/vacancy facts gathered before quote; environmental and title risk flagged',
    copyGuardrail:
      'Keep outreach fact-finding only; commercial terms must stay conditional on leases, zoning, access, environmental, title, and use.',
  },
  {
    strategyKey: 'portfolio-fragmentation',
    strategyName: 'Portfolio fragmentation',
    sourceProvider: 'dealmachine',
    feeThesis: '$20k-$80k+ when one weak door inside a 3-10 property owner file can be bought separately or start a portfolio conversation.',
    targetBuyerLane: 'Portfolio landlords, small multifamily buyers, DSCR buyers, and local operators',
    qualificationGate: 'Multi-property owner + at least one tax/lien/vacancy/code/rent-gap signal + owner contact export',
    copyGuardrail:
      'Ask whether one property, a subset, or the whole group is worth reviewing. Do not imply the owner must sell the entire portfolio.',
  },
  {
    strategyKey: 'buyer-reverse-engineering',
    strategyName: 'Buyer reverse-engineering',
    sourceProvider: 'dealmachine',
    feeThesis: '$25k-$100k+ when seller outreach starts from verified buyer demand instead of generic distress.',
    targetBuyerLane: 'Whatever buyer segment recently bought or explicitly requested the asset type: cash buyers, landlords, builders, land buyers, or creative buyers',
    qualificationGate: 'Known buyer pattern + matching market/property type + no seller outreach until the buyer lane is named',
    copyGuardrail:
      'Do not claim a buyer is guaranteed. Say the property may fit criteria we are reviewing and confirm facts before routing.',
  },
  {
    strategyKey: 'permit-spike-developer-land',
    strategyName: 'Permit spike developer / land',
    sourceProvider: 'dealmachine',
    feeThesis: '$25k-$125k+ when permit activity, demolitions, rezonings, or new builds reveal land/infill demand before the owner sees it.',
    targetBuyerLane: 'Infill builders, developers, land buyers, lot assemblers, and construction companies',
    qualificationGate: 'Permit/developer activity source + land/lot/teardown proxy + zoning/access/utilities review',
    copyGuardrail:
      'Do not overstate buildability. Pricing and buyer fit depend on zoning, utilities, access, title, survey, and permit context.',
  },
  {
    strategyKey: 'judgment-lien-pressure',
    strategyName: 'Judgment / lien pressure',
    sourceProvider: 'dealmachine',
    feeThesis: '$15k-$50k when liens, judgments, taxes, or title friction make a normal retail process too slow.',
    targetBuyerLane: 'Cash buyers, title-savvy investors, legal-review operators, and local landlords',
    qualificationGate: 'Lien/judgment/tax proxy + current source verification + no legal/tax claims in outreach',
    copyGuardrail:
      'Do not provide legal/tax advice or threaten consequences. Say the public-record signal may be outdated and ask if a simple review is useful.',
  },
  {
    strategyKey: 'tax-assessment-shock',
    strategyName: 'Tax assessment shock',
    sourceProvider: 'dealmachine',
    feeThesis: '$10k-$35k when tax burden or assessment jumps push high-equity owners to consider a clean exit.',
    targetBuyerLane: 'Cash buyers, creative buyers, and landlords depending on condition and seller needs',
    qualificationGate: 'Tax/high-equity/assessment proxy + current tax/assessment check before referencing a specific increase',
    copyGuardrail:
      'Frame around carrying cost and options. Do not imply tax distress unless verified; no tax advice.',
  },
  {
    strategyKey: 'stale-listing-creative-finance',
    strategyName: 'Stale listing creative terms',
    sourceProvider: 'homeharvest',
    feeThesis: '$15k-$50k when seller terms unlock a deal cash buyers cannot make work.',
    targetBuyerLane: 'Creative finance buyers, rental buyers, and seller-finance operators',
    qualificationGate: 'Stale listing + seller flexibility signal + lien/payment facts before terms are drafted',
    copyGuardrail:
      'Ask the agent if the seller would consider a clean creative structure only after confirming cash is not the right fit.',
  },
]

export const DEFAULT_AUTOPILOT_JOBS: AutopilotJobDefinition[] = [
  {
    jobKey: 'daily-strategy-plan',
    jobType: 'daily_strategy_plan',
    title: 'Choose daily focus and challenger strategy',
    cadence: 'daily morning',
    priority: 100,
    config: {
      localHour: 8,
      output: 'strategy plan + source blockers + send target',
      sourceDoctrine: {
        sellerStacking: 'DealMachine + DataPipe/Outscraper + county/public records',
        networkCapture: 'Instantly SuperSearch/Lead Finder + Instantly campaigns',
      },
    },
  },
  {
    jobKey: 'source-rotation',
    jobType: 'source_rotation',
    title: 'Rotate markets and sources before scraping',
    cadence: 'every 6 hours',
    priority: 90,
    config: {
      avoidRepeatHours: 18,
      preferOwnedFreeSources: true,
      rules: [
        'Outscraper/DataPipe only for stack methods, county records, local operators, builders, and map evidence.',
        'Instantly is the default for buyer, lender, builder, wholesaler, acquisition-manager, and operator network capture.',
      ],
    },
  },
  {
    jobKey: 'seller-outreach-batch',
    jobType: 'seller_outreach_batch',
    title: 'Prepare strategy-specific seller batches',
    cadence: 'hourly while slots remain',
    priority: 85,
    config: {
      channel: 'email',
      sms: 'review_only',
      maxPerStrategy: 30,
      dealMachineContactExportRequired: true,
      noDealMachineSkipTraceDefault: true,
      forbiddenSources: ['instantly_supersearch', 'instantly_lead_finder'],
    },
  },
  {
    jobKey: 'reply-memory-sync',
    jobType: 'reply_memory_sync',
    title: 'Attach replies to campaign, property, and next step',
    cadence: 'hourly',
    priority: 95,
    config: { mailbox: 'acquisitions@vestblock.io', fallbackMailbox: 'contact@vestblock.io' },
  },
  {
    jobKey: 'suppression-sync',
    jobType: 'suppression_sync',
    title: 'Apply opt-out, bounce, wrong-owner, and spam suppressions',
    cadence: 'before every send',
    priority: 110,
    config: { blockAcrossStrategies: true, channels: ['email', 'sms'] },
  },
  {
    jobKey: 'followup-router',
    jobType: 'followup_router',
    title: 'Route due seller and partner follow-ups',
    cadence: 'hourly',
    priority: 80,
    config: {
      staleHours: [24, 48, 72],
      keepLanesSeparated: ['seller', 'buyer', 'lender', 'builder', 'operator'],
    },
  },
  {
    jobKey: 'deal-routing-sync',
    jobType: 'deal_routing_sync',
    title: 'Turn analyses into buyer, lender, builder, or creative routes',
    cadence: 'after every saved analysis',
    priority: 75,
    config: { rankingEngine: 'disabled_until_more_data' },
  },
]

function daysAgo(now: Date, value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, (now.getTime() - parsed) / 864e5)
}

function statusRank(status: CommandStatus) {
  if (status === 'red') return 3
  if (status === 'yellow') return 2
  return 1
}

function worstStatus(statuses: CommandStatus[]): CommandStatus {
  return statuses.sort((left, right) => statusRank(right) - statusRank(left))[0] || 'green'
}

function normalizeMarketList(markets: string[]) {
  const normalized = markets.map((market) => String(market || '').trim()).filter(Boolean)
  return [...new Set(normalized)].slice(0, 4)
}

function sourceLane(input: AutopilotSnapshotInput, provider: string) {
  return input.sourceLanes.find((lane) => lane.provider === provider)
}

function sourceBlockedReason(input: AutopilotSnapshotInput, provider: string) {
  const lane = sourceLane(input, provider)
  if (!lane) return `${provider} source governor lane is not visible.`
  if (lane.canRun || ['allowed', 'manual_review'].includes(lane.status)) return null
  return lane.reason || `${lane.label || provider} is not available.`
}

function strategyMarkets(input: AutopilotSnapshotInput, strategyKey: string) {
  const heated = normalizeMarketList(input.marketHeat.map((market) => market.market))
  const refresh = normalizeMarketList(input.nextRefreshMarkets)
  if (strategyKey === 'buyer-demand-capture') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Detroit, MI', 'Indianapolis, IN'])
  }
  if (strategyKey === 'capital-desk-lender-capture') {
    return normalizeMarketList(['Nationwide', 'Midwest', 'Ohio', 'Michigan', 'Wisconsin'])
  }
  if (strategyKey === 'developer-builder-demand-capture') {
    return normalizeMarketList([...heated, 'Kansas City, MO', 'Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Indianapolis, IN'])
  }
  if (strategyKey === 'creative-finance-buyer-capture') {
    return normalizeMarketList([...heated, 'Phoenix, AZ', 'Tampa, FL', 'Dallas, TX', 'Atlanta, GA', 'Kansas City, MO'])
  }
  if (strategyKey === 'tax-code-stack') {
    return normalizeMarketList([...refresh, 'Cleveland, OH', 'Columbus, OH', 'Indianapolis, IN', 'Louisville, KY'])
  }
  if (strategyKey === 'builder-infill-teardown') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Detroit, MI'])
  }
  if (strategyKey === 'land-wholesale') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Columbus, OH', 'Cincinnati, OH', 'Indianapolis, IN', 'Louisville, KY'])
  }
  if (strategyKey === 'small-multifamily-portfolio') {
    return normalizeMarketList([...heated, 'Cleveland, OH', 'Toledo, OH', 'Milwaukee, WI', 'Cincinnati, OH'])
  }
  if (strategyKey === 'institutional-btr-buybox') {
    return normalizeMarketList(['Indianapolis, IN', 'Columbus, OH', 'Louisville, KY', 'Kansas City, MO', ...heated])
  }
  if (strategyKey === 'on-market-lowball-agent-sweep') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Cincinnati, OH', 'Detroit, MI'])
  }
  if (strategyKey === 'novation-retail-spread') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Cincinnati, OH', 'Pittsburgh, PA'])
  }
  if (strategyKey === 'commercial-small-bay-distress') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Pittsburgh, PA'])
  }
  if (strategyKey === 'failed-landlord-exit') {
    return normalizeMarketList([...heated, ...refresh, 'Dayton, OH', 'Akron, OH', 'Tulsa, OK', 'Little Rock, AR'])
  }
  if (strategyKey === 'insurance-damage-event' || strategyKey === 'contractor-distress-flip') {
    return normalizeMarketList([...heated, 'Kansas City, MO', 'St. Louis, MO', 'Memphis, TN', 'Birmingham, AL'])
  }
  if (strategyKey === 'zombie-rehab' || strategyKey === 'utility-lien-water-shutoff' || strategyKey === 'judgment-lien-pressure') {
    return normalizeMarketList([...refresh, 'Dayton, OH', 'Akron, OH', 'Youngstown, OH', 'Tulsa, OK'])
  }
  if (strategyKey === 'senior-downsizer' || strategyKey === 'tax-assessment-shock') {
    return normalizeMarketList([...heated, 'Omaha, NE', 'Des Moines, IA', 'Wichita, KS', 'Greensboro, NC'])
  }
  if (strategyKey === 'rent-gap-multifamily' || strategyKey === 'portfolio-fragmentation') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Cleveland, OH', 'Dayton, OH', 'Toledo, OH'])
  }
  if (strategyKey === 'probate-vacant-equity') {
    return normalizeMarketList([...refresh, 'Kansas City, MO', 'Little Rock, AR', 'Omaha, NE', 'Wichita, KS'])
  }
  if (strategyKey === 'tired-airbnb-midterm') {
    return normalizeMarketList(['Kansas City, MO', 'Louisville, KY', 'Indianapolis, IN', 'Pittsburgh, PA', ...heated])
  }
  if (strategyKey === 'small-commercial-owner-exit') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Cleveland, OH', 'Pittsburgh, PA', 'St. Louis, MO'])
  }
  if (strategyKey === 'buyer-reverse-engineering') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Kansas City, MO', 'Cleveland, OH', 'Indianapolis, IN'])
  }
  if (strategyKey === 'permit-spike-developer-land') {
    return normalizeMarketList([...heated, 'Columbus, OH', 'Indianapolis, IN', 'Louisville, KY', 'Kansas City, MO'])
  }
  return normalizeMarketList([...heated, ...refresh, ...DEFAULT_MARKETS])
}

const EPIC_DEALMACHINE_ROTATION_STRATEGIES = new Set([
  'failed-landlord-exit',
  'insurance-damage-event',
  'zombie-rehab',
  'senior-downsizer',
  'rent-gap-multifamily',
  'probate-vacant-equity',
  'tired-airbnb-midterm',
  'utility-lien-water-shutoff',
  'contractor-distress-flip',
  'small-commercial-owner-exit',
  'portfolio-fragmentation',
  'buyer-reverse-engineering',
  'permit-spike-developer-land',
  'judgment-lien-pressure',
  'tax-assessment-shock',
])

function strategyCommand(strategyKey: string, markets: string[], target: number) {
  const marketArg = markets.map((market) => market.replace(', ', '-').toLowerCase()).join('|')
  const marketList = markets.join('|')
  if (strategyKey === 'buyer-demand-capture') {
    return `pnpm run instantly:doctor && pnpm run instantly:demand -- --lane=buyer-demand-capture --market="${marketList}" --limit=${target}`
  }
  if (strategyKey === 'capital-desk-lender-capture') {
    return `pnpm run instantly:doctor && pnpm run instantly:demand -- --lane=capital-desk-lender-capture --market="${marketList}" --limit=${target}`
  }
  if (strategyKey === 'developer-builder-demand-capture') {
    return `pnpm run instantly:doctor && pnpm run instantly:demand -- --lane=developer-builder-demand-capture --market="${marketList}" --limit=${target}`
  }
  if (strategyKey === 'creative-finance-buyer-capture') {
    return `pnpm run instantly:doctor && pnpm run instantly:demand -- --lane=creative-finance-buyer-capture --market="${marketList}" --limit=${target}`
  }
  if (strategyKey === 'tax-code-stack') return `pnpm run distress:dealmachine:export-request -- --strategy=tax-code-stack --markets="${marketArg}" --limit=${target}`
  if (strategyKey === 'senior-out-of-state-landlord') {
    return `pnpm run distress:dealmachine:export-request -- --strategy=senior-out-of-state-landlord --markets="${marketArg}" --limit=${target}`
  }
  if (strategyKey === 'builder-infill-teardown') {
    return `pnpm run distress:dealmachine:export-request -- --strategy=builder-infill-teardown --markets="${marketArg}" --limit=${target}`
  }
  if (strategyKey === 'land-wholesale') {
    return `pnpm run distress:dealmachine:export-request -- --strategy=land-wholesale --markets="${marketArg}" --limit=${target}`
  }
  if (strategyKey === 'small-multifamily-portfolio') {
    return `pnpm run distress:dealmachine:export-request -- --strategy=small-multifamily-portfolio --markets="${marketArg}" --limit=${target}`
  }
  if (strategyKey === 'institutional-btr-buybox') {
    return `pnpm run distress:dealmachine:export-request -- --strategy=institutional-btr-buybox --markets="${marketArg}" --limit=${target}`
  }
  if (strategyKey === 'on-market-lowball-agent-sweep') {
    return `pnpm run sellers:on-market-lowball -- --limit=${target}`
  }
  if (strategyKey === 'commercial-small-bay-distress') {
    return `pnpm run distress:dealmachine:export-request -- --strategy=commercial-small-bay-distress --markets="${marketArg}" --limit=${target}`
  }
  if (strategyKey === 'novation-retail-spread') {
    return `pnpm run boss:stale-listings -- --market="${markets.join('|')}" --offer-mode=novation --limit=${target}`
  }
  if (EPIC_DEALMACHINE_ROTATION_STRATEGIES.has(strategyKey)) {
    return `pnpm run sellers:strategy-rotation -- --strategy=${strategyKey} --markets="${marketList}" --daily-cap=30 --max-builds=4`
  }
  return `pnpm run boss:stale-listings -- --market="${markets.join('|')}" --limit=${target}`
}

export function buildStrategyBatchPlans(input: AutopilotSnapshotInput): StrategyBatchPlan[] {
  const maxPerStrategy = 30
  const capacity = Math.max(0, Math.min(input.remainingToday, maxPerStrategy * STRATEGY_DEFINITIONS.length))
  const activeStrategyCount = input.replySignals7d > 0 ? 2 : STRATEGY_DEFINITIONS.length
  const baseTarget = activeStrategyCount > 0 ? Math.floor(capacity / activeStrategyCount) : 0
  const readyPressure = input.emailReady + input.needsReview

  return STRATEGY_DEFINITIONS.map((definition, index) => {
    const blockedReason =
      input.missingSuppressionDb
        ? 'Suppression database is not visible; live sends must stay paused.'
        : sourceBlockedReason(input, definition.sourceProvider)
    const markets = strategyMarkets(input, definition.strategyKey)
    const targetEmailCount =
      blockedReason || index >= activeStrategyCount
        ? 0
        : Math.max(0, Math.min(maxPerStrategy, baseTarget + (index === 0 ? capacity % activeStrategyCount : 0)))
    const status: CommandStatus = blockedReason ? 'red' : targetEmailCount > 0 || readyPressure > 0 ? 'green' : 'yellow'

    return {
      ...definition,
      status,
      markets,
      targetEmailCount,
      targetSmsReviewCount: definition.sourceProvider === 'instantly' ? 0 : targetEmailCount,
      blockedReason,
      command: strategyCommand(definition.strategyKey, markets, Math.max(targetEmailCount, 30)),
    }
  })
}

export function buildAutopilotSnapshot(input: AutopilotSnapshotInput): AutopilotSnapshot {
  const now = input.now || new Date()
  const jobs = input.jobs || []
  const activeJobs = jobs.filter((job) => !['paused', 'disabled'].includes(String(job.status || 'active').toLowerCase()))
  const jobsDue = activeJobs.filter((job) => !job.next_run_at || Date.parse(job.next_run_at) <= now.getTime()).length
  const lastRunAt =
    jobs
      .map((job) => job.last_run_at)
      .filter(Boolean)
      .sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] || null
  const nextRunAt =
    jobs
      .map((job) => job.next_run_at)
      .filter(Boolean)
      .sort((a, b) => Date.parse(String(a)) - Date.parse(String(b)))[0] || null

  const strategyRuns7d = (input.strategyRuns || []).filter((run) => daysAgo(now, run.created_at || run.completed_at) <= 7).length
  const replyMemories7d = (input.replyMemory || []).filter((reply) => daysAgo(now, reply.received_at) <= 7).length
  const suppressionBlocks7d = (input.suppressionDecisions || []).filter(
    (decision) => decision.decision === 'blocked' && daysAgo(now, decision.created_at) <= 7
  ).length

  const batches = buildStrategyBatchPlans(input)
  const guardrails = [
    {
      label: 'Suppressions',
      value: input.activeSuppressionCount,
      status: input.missingSuppressionDb ? 'red' : 'green',
      detail: input.missingSuppressionDb
        ? 'Suppression DB is not visible; block live sends.'
        : 'Opt-outs and DNC records are visible before batching.',
    },
    {
      label: 'DM exports',
      value: 'contacts',
      status: 'yellow',
      detail:
        'DealMachine lanes must generate an exact contact-export request, ingest the downloaded Contacts CSV, and verify DNC columns before sending. Skip tracing is not the default path.',
    },
    {
      label: 'Source doctrine',
      value: 'split',
      status: 'green',
      detail:
        'Outscraper/DataPipe is reserved for stacking, county/public records, local operators, and builder/source evidence. Instantly is the network lead-capture engine for buyers, lenders, builders, wholesalers, acquisition managers, and operators.',
    },
    {
      label: 'Reply memory',
      value: replyMemories7d,
      status: replyMemories7d || input.replySignals7d === 0 ? 'green' : 'yellow',
      detail: replyMemories7d
        ? 'Recent replies are being stored as learning objects.'
        : 'No recent reply memory rows are visible yet.',
    },
    {
      label: 'Daily slots',
      value: input.remainingToday,
      status: input.remainingToday > 0 ? 'green' : 'yellow',
      detail: input.remainingToday > 0 ? 'Autopilot can still plan outbound volume.' : 'Daily outbound cap is already full.',
    },
    {
      label: 'SMS lane',
      value: 'review',
      status: 'yellow',
      detail: 'SMS is prepared as review-only until consent and opt-out controls are approved.',
    },
  ] satisfies AutopilotSnapshot['guardrails']

  const blockingStatuses: CommandStatus[] = [
    input.missingSuppressionDb ? 'red' : 'green',
    input.remainingToday > 0 || input.replySignals7d > 0 || input.followupsDue > 0 ? 'green' : 'yellow',
    ...batches.map((batch) => batch.status),
  ]
  const status = worstStatus(blockingStatuses)
  const enabled = activeJobs.length >= DEFAULT_AUTOPILOT_JOBS.length || jobs.length === 0
  const sendReady = input.remainingToday > 0 && batches.some((batch) => batch.targetEmailCount > 0)
  const mode: AutopilotSnapshot['mode'] =
    input.missingSuppressionDb ? 'blocked' : sendReady ? 'send_ready' : jobsDue > 0 || input.followupsDue > 0 ? 'dispatch_ready' : 'plan_only'

  const summary =
    jobs.length === 0
      ? 'Autopilot jobs are ready to seed. The planner can choose strategy lanes, markets, suppression gates, and reply memory objects.'
      : `${activeJobs.length} active job${activeJobs.length === 1 ? '' : 's'} · ${strategyRuns7d} strategy run${strategyRuns7d === 1 ? '' : 's'} in 7d · ${replyMemories7d} reply memor${replyMemories7d === 1 ? 'y' : 'ies'} in 7d.`
  const firstBlocked = batches.find((batch) => batch.blockedReason)
  const topBatch = batches.find((batch) => batch.targetEmailCount > 0) || batches[0]
  const nextMove =
    input.replySignals7d > 0
      ? 'Work replies and write memory before adding volume; each reply should update strategy, market, property, and next action.'
      : firstBlocked
        ? `${firstBlocked.strategyName}: ${firstBlocked.blockedReason}`
        : topBatch
          ? `Run ${topBatch.strategyName} in ${topBatch.markets.slice(0, 2).join(' and ')} with ${topBatch.targetEmailCount || 100} separated emails and SMS review tasks. DealMachine lanes start with a contact-export request, not skip tracing.`
          : 'Seed the durable jobs, then run a dry autopilot pass.'

  return {
    status,
    enabled,
    mode,
    summary,
    nextMove,
    lastRunAt,
    nextRunAt,
    durable: {
      jobsConfigured: jobs.length,
      jobsDue,
      activeJobs: activeJobs.length,
      strategyRuns7d,
      replyMemories7d,
      suppressionBlocks7d,
    },
    sourceDoctrine: SOURCE_DOCTRINE,
    batches,
    guardrails,
  }
}
