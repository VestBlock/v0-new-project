import type { OperatingStrategyKey, StrategyDestination } from './registry'

export const APPROVED_STRATEGY_CHANNELS = [
  'website_notification',
  'resend_email',
  'outlook_graph',
  'buffer_vestblock',
  'operator_task',
  'manual_phone_task',
  'no_outreach',
] as const

export type ApprovedStrategyChannel = (typeof APPROVED_STRATEGY_CHANNELS)[number]

export type StrategyExecutionMode = 'inactive' | 'internal_only' | 'no_send'

export type StrategyCadenceStep = {
  timing: string
  purpose: string
  channels: readonly ApprovedStrategyChannel[]
  condition: string
}

export type StrategySourceDataRequirement = {
  source: string
  authority: string
  requiredEvidence: readonly string[]
  freshnessRule: string
}

export type StrategyCrossLaneRoute = {
  to: OperatingStrategyKey
  trigger: string
  handoff: string
  requiresReceivingStrategyAcceptance: true
}

export type StrategyIntegrationDependency = {
  integration: string
  status: 'available' | 'partial' | 'missing' | 'blocked' | 'gate_3c'
  evidence: string
  requiredBeforeActivation: boolean
}

export type StrategyLifecycleTransition = {
  from: string
  to: string
  event: string
  persistence: 'current' | 'target_only'
}

export type StrategyOperatingContract = {
  objective: string
  targetParticipant: string
  problem: string
  valueExchange: string
  offer: string
  eligibilityCriteria: readonly string[]
  disqualificationCriteria: readonly string[]
  prioritizationRules: readonly string[]
  sourceData: readonly string[]
  sourceDataRequirements: readonly StrategySourceDataRequirement[]
  primaryChannels: readonly ApprovedStrategyChannel[]
  secondaryChannels: readonly ApprovedStrategyChannel[]
  channelSelectionRules: readonly string[]
  followupCadence: readonly string[]
  cadenceSteps: readonly StrategyCadenceStep[]
  nurtureRules: readonly string[]
  reactivationRules: readonly string[]
  crossLaneRoutes: readonly StrategyCrossLaneRoute[]
  humanApprovalPoints: readonly string[]
  complianceLimits: readonly string[]
  learningInputs: readonly string[]
  failureConditions: readonly string[]
  stopRules: readonly string[]
  handoffRules: readonly string[]
  integrationDependencies: readonly StrategyIntegrationDependency[]
  activationReadiness: {
    status: 'blocked'
    readyElements: readonly string[]
    blockers: readonly string[]
  }
  versionDecisionRule: {
    promote: string
    revise: string
    retire: string
    requiredCompleteWindows: 2
    autonomousMaterialChange: false
  }
}

export type StrategyLifecycleContract = {
  states: readonly string[]
  initialState: string
  terminalStates: readonly string[]
  transitions: readonly StrategyLifecycleTransition[]
  cadence: readonly string[]
  stopConditions: readonly string[]
  recordAuthority: string
  persistedStates: readonly string[]
  persistedEvents: readonly string[]
  targetOnlyStages: readonly string[]
  stateNotes: Readonly<Record<string, string>>
}

export type StrategyOwnerContract = {
  crmAuthority: 'vestblock_crm'
  automationRole: 'vestblock_application' | 'operator_manual'
  dispatchAuthority: 'none_in_gate_3b'
  recordOwner: string
  humanOwner: string
  handoffRules: readonly string[]
}

export type StrategyOutcomeContract = {
  primaryConversionEvent: string
  leadingIndicators: readonly string[]
  businessValue: string
  learningInputs: readonly string[]
  learningWindowDays: number
  minimumExposure: number
  exposureUnit: string
  minimumPrimaryConversions: number
  requiredCompleteWindows: 2
  attributionDimensions: readonly string[]
  safeguards: readonly string[]
  verifiedOutcomeRule: string
  targetOutcomeObservable: boolean
  observableCurrentOutcome: {
    available: boolean
    evidence: string
    limitation: string
  }
  stopConditions: readonly string[]
}

export type StrategySourceProvenance = {
  source: string
  kind: 'gate_3a_registry_seed' | 'founder_approved_architecture' | 'repository_consumer_audit'
  observedAt: '2026-08-15'
}

export type OperatingStrategyVersionContractDefinition = {
  strategyKey: OperatingStrategyKey
  version: 1
  versionStatus: 'draft'
  executionMode: StrategyExecutionMode
  destination: StrategyDestination
  externalSendCap: 0
  activation: {
    externalActivation: 'blocked'
    blockers: readonly string[]
  }
  operatingContract: StrategyOperatingContract
  lifecycleContract: StrategyLifecycleContract
  ownerContract: StrategyOwnerContract
  outcomeContract: StrategyOutcomeContract
  sourceProvenance: readonly StrategySourceProvenance[]
}

const UNIVERSAL_COMPLIANCE_LIMITS = [
  'Do not guarantee funding, approval, credit-score change, deletion, income, investment return, property availability, government award, deal outcome, or transaction timing.',
  'Keep analysis, matching, marketing, provider sharing, public display, and outreach permissions separate and purpose-specific.',
  'Recheck global suppression, DNC, withdrawal, complaint, hard bounce, identity conflict, and destination health immediately before any later dispatch.',
] as const

const UNIVERSAL_STOP_RULES = [
  'Stop on opt-out, complaint, hard bounce, DNC, withdrawal, or permission loss.',
  'Stop on a reply that needs human handling, a verified conversion, successful handoff, disqualification, or identity conflict.',
  'Stop on stale evidence, an invalid destination, a missing strategy or message version, duplicate ownership, capacity failure, or a kill switch.',
] as const

const UNIVERSAL_OUTCOME_SAFEGUARDS = [
  'Require two complete learning windows before recommending promotion.',
  'Do not declare a winner from opens, clicks, or other vanity engagement alone.',
  'A complaint, compliance failure, identity conflict, duplicate dispatch, or suppression breach blocks promotion.',
  'Material audience, offer, cadence, claim, destination, or channel changes remain human-reviewed proposals.',
] as const

const GATE_3C_DEPENDENCY: StrategyIntegrationDependency = {
  integration: 'canonical strategy-version binding',
  status: 'gate_3c',
  evidence: 'Application consumers do not yet persist or resolve canonical operating-strategy version IDs.',
  requiredBeforeActivation: true,
}

const sourceProvenance = (...sources: string[]): readonly StrategySourceProvenance[] => [
  {
    source: 'Gate 3A canonical governed registry',
    kind: 'gate_3a_registry_seed',
    observedAt: '2026-08-15',
  },
  {
    source: 'Gate 2 canonical strategy registry',
    kind: 'founder_approved_architecture',
    observedAt: '2026-08-15',
  },
  ...sources.map((source) => ({
    source,
    kind: 'repository_consumer_audit' as const,
    observedAt: '2026-08-15' as const,
  })),
]

const blockedActivation = (...blockers: string[]) => ({
  externalActivation: 'blocked' as const,
  blockers: [
    'Version 1 remains draft and has no founder-approved activation event.',
    'External send capacity is zero and no live-send approval exists.',
    'Gate 3C canonical consumer binding is not implemented.',
    ...blockers,
  ],
})

const crossLane = (
  to: OperatingStrategyKey,
  trigger: string,
  handoff: string
): StrategyCrossLaneRoute => ({
  to,
  trigger,
  handoff,
  requiresReceivingStrategyAcceptance: true,
})

const decisionRule = (promote: string, revise: string, retire: string) => ({
  promote,
  revise,
  retire,
  requiredCompleteWindows: 2 as const,
  autonomousMaterialChange: false as const,
})

const outcomeSafeguards = (...specific: string[]) => [
  ...UNIVERSAL_OUTCOME_SAFEGUARDS,
  ...specific,
]

const lifecycleStateNotes = (
  persistedStates: readonly string[],
  targetOnlyStages: readonly string[],
  authority: string
): Readonly<Record<string, string>> => Object.freeze(Object.fromEntries([
  ...persistedStates.map((state) => [state, `${state} is persisted by ${authority}.`]),
  ...targetOnlyStages.map((state) => [state, `${state} is target-only and is not currently persisted by ${authority}.`]),
]))

export const OPERATING_STRATEGY_VERSION_CONTRACTS: Record<
  OperatingStrategyKey,
  OperatingStrategyVersionContractDefinition
> = {
  capital_readiness_intake: {
    strategyKey: 'capital_readiness_intake',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: {
      mode: 'public_route',
      path: '/capital',
      cta: 'Start your capital readiness review',
    },
    externalSendCap: 0,
    activation: blockedActivation(
      'Provider matching and provider-confirmed outcome attribution are incomplete.',
      'Any provider sharing, eligibility representation, or financial claim requires operator approval.'
    ),
    operatingContract: {
      objective: 'Turn a defined capital need into a complete, reviewable readiness case without representing a lender or promising approval.',
      targetParticipant: 'Businesses, property operators, acquisition buyers, grant seekers, and sponsors with a defined capital need.',
      problem: 'Capital requests often reach providers before purpose, timing, records, constraints, and document gaps are organized.',
      valueExchange: 'The participant provides accurate facts, documents, and purpose-specific permissions in exchange for a structured readiness review and bounded next steps.',
      offer: 'A private capital-readiness intake, document-gap analysis, readiness plan, and operator-reviewed provider-review path.',
      eligibilityCriteria: [
        'Identity and business, property, or project context are verified.',
        'Use, amount, timing, present capacity, and material financial facts are supplied by the participant.',
        'Analysis consent is recorded; provider-sharing and marketing permissions remain separate.',
      ],
      disqualificationCriteria: [
        'Fabricated or materially conflicting facts, prohibited purpose, or unresolved identity conflict.',
        'A request for guaranteed approval, terms, funding, or an unsupported underwriting conclusion.',
        'Missing analysis consent or insufficient information to form a readiness case.',
      ],
      prioritizationRules: [
        'Prioritize submitted cases with defined timing and complete identity before incomplete drafts.',
        'Prioritize needs-information cases when one documented gap blocks readiness review.',
        'Never prioritize by protected status or by a claimed likelihood of approval.',
      ],
      sourceData: ['capital_cases', 'capital_case_events', 'customer-submitted financial and business records', 'operator-reviewed provider criteria'],
      sourceDataRequirements: [
        {
          source: 'capital_cases and capital_case_events',
          authority: 'VestBlock Capital case service and append-only case events',
          requiredEvidence: ['case type', 'purpose', 'amount or bounded need', 'timing', 'consents', 'document state', 'status event'],
          freshnessRule: 'Reconfirm material facts and provider criteria before provider review; do not infer freshness from case age alone.',
        },
      ],
      primaryChannels: ['website_notification', 'operator_task'],
      secondaryChannels: ['resend_email', 'outlook_graph', 'no_outreach'],
      channelSelectionRules: [
        'Use the secure website for intake, readiness results, and document requests.',
        'Use transactional email only for the submitted case and only after address validation.',
        'Use operator tasks for material review; do not submit a case to a provider automatically.',
      ],
      followupCadence: ['Immediate submission acknowledgement.', 'One-business-day operator review target.', 'Permitted missing-item reminders at days 3, 7, and 14, then stop.'],
      cadenceSteps: [
        { timing: 'immediate', purpose: 'Acknowledge a requested submission.', channels: ['website_notification'], condition: 'A case was successfully submitted.' },
        { timing: 'within one business day', purpose: 'Review completeness and assign a readiness next step.', channels: ['operator_task'], condition: 'The case is submitted and not suppressed or withdrawn.' },
        { timing: 'days 3, 7, and 14', purpose: 'Request a documented missing item.', channels: ['resend_email', 'outlook_graph'], condition: 'The participant separately permitted follow-up and the same unresolved gap remains.' },
      ],
      nurtureRules: [
        'Nurture is limited to the participant-selected capital purpose and documented readiness gaps.',
        'After three unanswered permitted reminders, close the reminder sequence and leave the case available for customer-initiated return.',
      ],
      reactivationRules: [
        'Reactivate only after the participant updates a material fact, document, timing, or provider-sharing permission.',
        'Recheck provider criteria freshness and suppression before reopening provider review.',
      ],
      crossLaneRoutes: [
        crossLane('business_formation_readiness', 'Foundational entity, banking, or recordkeeping gaps prevent responsible capital review.', 'Create a permissioned readiness handoff with the blocking gaps.'),
        crossLane('lender_provider_criteria', 'The case is ready for provider review and provider-sharing permission is present.', 'Submit an operator-reviewed match request; never auto-submit the case.'),
        crossLane('dealvault_activation', 'A qualified transaction needs controlled evidence and milestone continuity.', 'Offer an access-controlled DealVault review after the transaction owner accepts.'),
      ],
      humanApprovalPoints: ['Provider sharing', 'Underwriting-like or eligibility language', 'Provider introduction', 'Referral compensation', 'Material strategy activation'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'VestBlock does not represent a provider and must state that approval and terms are not guaranteed.'],
      learningInputs: ['capital path', 'need type', 'readiness gaps', 'completion friction', 'provider-fit decision', 'stage time', 'verified provider response'],
      failureConditions: ['Stale provider criteria', 'Materially inconsistent customer facts', 'Unresolved consent boundary', 'Document-access failure', 'No responsible record owner'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Pause a provider path when rejection evidence shows systemic criteria mismatch.'],
      handoffRules: ['Capital owns readiness through ready-for-provider-review.', 'A receiving provider strategy must accept a permissioned handoff before any introduction.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'Capital case service', status: 'available', evidence: 'capital_cases and capital_case_events persist the current case lifecycle.', requiredBeforeActivation: true },
        { integration: 'Provider matching and outcome capture', status: 'partial', evidence: 'Provider criteria foundations exist, but complete provider matching and provider-confirmed value attribution do not.', requiredBeforeActivation: true },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['Public Capital intake exists.', 'Capital case and append-only event authorities exist.', 'Purpose-specific consent fields exist.'],
        blockers: ['Canonical strategy-version binding is absent.', 'Provider matching is incomplete.', 'Provider-confirmed outcomes are not yet attributable end to end.', 'Live sending and provider sharing are unapproved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only when readiness acceptance improves across two complete 30-day windows with at least 20 submitted cases and five verified readiness conversions per window, with no guardrail regression.',
        'Revise a specific intake path when repeated, attributable document or criteria friction is correctable.',
        'Retire a provider path after material compliance failure or two complete reviewed windows with no qualified readiness progress.'
      ),
    },
    lifecycleContract: {
      states: ['draft', 'submitted', 'needs_information', 'under_review', 'readiness_plan', 'ready_for_provider_review', 'provider_review', 'approved', 'declined', 'withdrawn', 'closed'],
      initialState: 'draft',
      terminalStates: ['closed'],
      transitions: [
        { from: 'draft', to: 'submitted', event: 'participant_submits_draft', persistence: 'current' },
        { from: 'draft', to: 'withdrawn', event: 'participant_withdraws_draft', persistence: 'current' },
        { from: 'submitted', to: 'needs_information', event: 'submitted_case_needs_information', persistence: 'current' },
        { from: 'submitted', to: 'under_review', event: 'operator_accepts_submitted_review', persistence: 'current' },
        { from: 'submitted', to: 'withdrawn', event: 'participant_withdraws_submitted_case', persistence: 'current' },
        { from: 'needs_information', to: 'submitted', event: 'participant_resubmits_information', persistence: 'current' },
        { from: 'needs_information', to: 'under_review', event: 'operator_accepts_received_information', persistence: 'current' },
        { from: 'needs_information', to: 'withdrawn', event: 'participant_withdraws_information_case', persistence: 'current' },
        { from: 'under_review', to: 'needs_information', event: 'operator_finds_material_gap', persistence: 'current' },
        { from: 'under_review', to: 'readiness_plan', event: 'operator_prepares_readiness_plan', persistence: 'current' },
        { from: 'under_review', to: 'ready_for_provider_review', event: 'operator_confirms_direct_review_readiness', persistence: 'current' },
        { from: 'under_review', to: 'declined', event: 'operator_declines_review_case', persistence: 'current' },
        { from: 'under_review', to: 'withdrawn', event: 'participant_withdraws_review_case', persistence: 'current' },
        { from: 'readiness_plan', to: 'needs_information', event: 'readiness_plan_finds_new_gap', persistence: 'current' },
        { from: 'readiness_plan', to: 'under_review', event: 'readiness_plan_returns_to_review', persistence: 'current' },
        { from: 'readiness_plan', to: 'ready_for_provider_review', event: 'readiness_plan_requirements_met', persistence: 'current' },
        { from: 'readiness_plan', to: 'closed', event: 'readiness_plan_closed', persistence: 'current' },
        { from: 'readiness_plan', to: 'withdrawn', event: 'participant_withdraws_readiness_plan', persistence: 'current' },
        { from: 'ready_for_provider_review', to: 'provider_review', event: 'provider_review_authorized', persistence: 'current' },
        { from: 'ready_for_provider_review', to: 'readiness_plan', event: 'provider_readiness_gap_reopens_plan', persistence: 'current' },
        { from: 'ready_for_provider_review', to: 'declined', event: 'ready_case_declined', persistence: 'current' },
        { from: 'ready_for_provider_review', to: 'withdrawn', event: 'participant_withdraws_ready_case', persistence: 'current' },
        { from: 'provider_review', to: 'approved', event: 'provider_confirms_approval', persistence: 'current' },
        { from: 'provider_review', to: 'declined', event: 'provider_confirms_decline', persistence: 'current' },
        { from: 'provider_review', to: 'needs_information', event: 'provider_requests_information', persistence: 'current' },
        { from: 'provider_review', to: 'withdrawn', event: 'participant_withdraws_provider_review', persistence: 'current' },
        { from: 'approved', to: 'closed', event: 'approved_case_closed', persistence: 'current' },
        { from: 'declined', to: 'readiness_plan', event: 'declined_case_returns_to_readiness', persistence: 'current' },
        { from: 'declined', to: 'closed', event: 'declined_case_closed', persistence: 'current' },
        { from: 'withdrawn', to: 'closed', event: 'withdrawn_case_closed', persistence: 'current' },
      ],
      cadence: ['Immediate submission acknowledgement.', 'One-business-day operator review target.', 'Permitted missing-item reminders at days 3, 7, and 14, then stop.'],
      stopConditions: ['withdrawn', 'declined', 'closed', 'permission_revoked', 'identity_conflict', 'provider_criteria_stale'],
      recordAuthority: 'capital_cases is the current state authority; capital_case_events is the append-only transition authority.',
      persistedStates: ['draft', 'submitted', 'needs_information', 'under_review', 'readiness_plan', 'ready_for_provider_review', 'provider_review', 'approved', 'declined', 'withdrawn', 'closed'],
      persistedEvents: ['capital_case_events.event_type', 'capital_case_events.from_status', 'capital_case_events.to_status'],
      targetOnlyStages: [],
      stateNotes: lifecycleStateNotes(
        ['draft', 'submitted', 'needs_information', 'under_review', 'readiness_plan', 'ready_for_provider_review', 'provider_review', 'approved', 'declined', 'withdrawn', 'closed'],
        [],
        'capital_cases.status, with transitions recorded in capital_case_events'
      ),
    },

    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'Capital case service owns capital_cases and capital_case_events.',
      humanOwner: 'A VestBlock operator owns material readiness review, provider sharing, and provider introductions.',
      handoffRules: ['No provider receives a case without separate sharing permission and operator approval.', 'The receiving strategy must persist acceptance before it owns the next action.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'A complete submitted capital case reaches ready_for_provider_review with operator-verified readiness evidence.',
      leadingIndicators: ['submitted cases', 'required-document completeness', 'readiness-plan completion', 'time to operator review', 'provider-review acceptance'],
      businessValue: 'Provider-review-ready demand with fewer preventable document and fit gaps.',
      learningInputs: ['strategy version', 'capital path', 'source', 'consent state', 'readiness gap', 'provider criteria', 'status event', 'verified provider response'],
      learningWindowDays: 30,
      minimumExposure: 20,
      exposureUnit: 'submitted_capital_cases',
      minimumPrimaryConversions: 5,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'capital case type', 'source', 'customer path', 'operator', 'provider outcome'],
      safeguards: outcomeSafeguards('Do not treat readiness score, email engagement, or a submitted draft as provider approval.'),
      verifiedOutcomeRule: 'Count once when a submitted capital_cases record transitions to ready_for_provider_review and the corresponding event and readiness evidence are present.',
      targetOutcomeObservable: true,
      observableCurrentOutcome: {
        available: true,
        evidence: 'capital_cases persists submitted and ready_for_provider_review; capital_case_events persists the transition.',
        limitation: 'The records do not yet carry the canonical strategy-version ID, and provider-confirmed downstream value remains incomplete.',
      },
      stopConditions: ['suppression or permission breach', 'fabricated material fact', 'provider-criteria mismatch', 'duplicate case attribution', 'material claim regression'],
    },
    sourceProvenance: sourceProvenance('capital_cases/capital_case_events consumer audit'),
  },
  seller_options_intake: {
    strategyKey: 'seller_options_intake',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/sell', cta: 'Review my selling options' },
    externalSendCap: 0,
    activation: blockedActivation(
      'Legacy leads, seller cases, and source tactics still need a Gate 3C identity and strategy-version bridge.',
      'Every sourced first contact and every sensitive seller context requires operator review.'
    ),
    operatingContract: {
      objective: 'Help an owner or authorized representative organize a credible property sale or transition path without manufacturing urgency.',
      targetParticipant: 'Property owners or authorized representatives who request or may lawfully receive a review of selling options.',
      problem: 'Fragmented seller records and tactic-led contact can pressure owners, duplicate outreach, or confuse evidence with motivation.',
      valueExchange: 'The seller supplies authority, property context, priorities, and permissions in exchange for a private options review and operator-owned next step.',
      offer: 'A review of appropriate cash, listing or referral, seller-finance, creative, novation, hybrid, or no-action paths.',
      eligibilityCriteria: [
        'Authority to discuss the identified property is verified.',
        'Condition, occupancy, timing, title or equity context, and seller priorities are sufficiently documented.',
        'Any sourced contact has time-stamped provenance, a documented lawful basis, and a fresh suppression decision.',
      ],
      disqualificationCriteria: [
        'Owner or representative authority conflict, active representation conflict, or unresolved title/legal dispute.',
        'Identity mismatch, stale property evidence, prohibited targeting, or missing contact basis.',
        'A required value, legal, tax, timeline, or outcome guarantee.',
      ],
      prioritizationRules: [
        'Prioritize customer-submitted complete cases and explicit requests before sourced candidates.',
        'Escalate probate, foreclosure, bankruptcy, senior, hardship, or representation contexts to human review before contact.',
        'Do not score urgency from protected attributes or unsupported distress inference.',
      ],
      sourceData: ['seller_cases', 'seller_case_events', 'legacy leads', 'approved property source events'],
      sourceDataRequirements: [
        {
          source: 'seller_cases and seller_case_events',
          authority: 'Seller case service and append-only seller case events',
          requiredEvidence: ['owner authority', 'property identity', 'seller-submitted context', 'consent or lawful basis', 'status transition'],
          freshnessRule: 'Reconfirm authority, material property facts, representation, and suppression before each reviewed next step.',
        },
        {
          source: 'legacy leads and approved source events',
          authority: 'Historical CRM evidence only until Gate 3C links identity and strategy version',
          requiredEvidence: ['source namespace', 'source event', 'observed timestamp', 'contact provenance', 'dedupe key'],
          freshnessRule: 'A legacy outreach-ready label never establishes current eligibility; re-review the record before use.',
        },
      ],
      primaryChannels: ['website_notification', 'operator_task'],
      secondaryChannels: ['resend_email', 'outlook_graph', 'manual_phone_task', 'no_outreach'],
      channelSelectionRules: [
        'Use /sell as the secure, customer-controlled primary path.',
        'Use email only with a documented basis; use a manual phone task only when the contact basis and operator approval are recorded.',
        'A property source or tactic may create an operator task but may never dispatch directly.',
      ],
      followupCadence: ['Immediate customer-requested acknowledgement.', 'One-business-day sensitivity and options review.', 'Permitted seller follow-up at days 2, 7, and 14, then stop.'],
      cadenceSteps: [
        { timing: 'immediate', purpose: 'Acknowledge a seller-requested intake.', channels: ['website_notification'], condition: 'The seller submitted a valid case.' },
        { timing: 'within one business day', purpose: 'Complete options and sensitivity review.', channels: ['operator_task'], condition: 'The case is submitted and owner authority is not disputed.' },
        { timing: 'days 2, 7, and 14', purpose: 'Follow up on the requested options review.', channels: ['resend_email', 'outlook_graph', 'manual_phone_task'], condition: 'The seller permitted the selected channel and no stop condition applies.' },
      ],
      nurtureRules: [
        'Nurture must reference the seller-selected objective and never manufacture scarcity, distress, or motivation.',
        'End after three unanswered approved attempts and preserve a customer-initiated return path.',
      ],
      reactivationRules: [
        'Reactivate on a seller request or a verified material change in timing, representation, title, occupancy, or property condition.',
        'Reverify authority, contact basis, property facts, and suppression before reactivation.',
      ],
      crossLaneRoutes: [
        crossLane('property_opportunity_discovery', 'An operator needs refreshed provenance-backed property evidence.', 'Request an internal evidence refresh without authorizing contact.'),
        crossLane('buyer_buy_box_activation', 'An operator-approved seller path has a verified buyer-fit use case.', 'Create a blinded match-review handoff; disclose property facts only after approval.'),
        crossLane('service_provider_network', 'The seller requests an appropriate licensed or service-provider path.', 'Create an operator-reviewed, consented introduction request.'),
        crossLane('dealvault_activation', 'A reviewed transaction needs evidence and milestone continuity.', 'Create an access-controlled DealVault activation review.'),
      ],
      humanApprovalPoints: ['Every sourced first contact', 'Every sensitive context', 'Property-value or offer representation', 'Legal or tax language', 'Third-party introduction'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Do not characterize an owner as distressed or motivated unless the owner supplies that context and its use is appropriate.'],
      learningInputs: ['source tactic', 'property context', 'chosen option', 'objection', 'time to review', 'appointment', 'offer or referral outcome', 'verified close'],
      failureConditions: ['Owner-authority conflict', 'Representation or title dispute', 'Stale property evidence', 'Missing suppression decision', 'Duplicate tactic ownership'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Stop immediately on legal dispute, explicit sensitivity concern, or three unanswered approved attempts.'],
      handoffRules: ['Seller intake owns the customer case and options review.', 'Source tactics contribute evidence only; another strategy accepts ownership before matching or introduction.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'Seller case service', status: 'available', evidence: 'seller_cases and seller_case_events persist the current seller lifecycle.', requiredBeforeActivation: true },
        { integration: 'Legacy lead identity bridge', status: 'partial', evidence: 'Legacy leads and seller tactics exist but do not yet share canonical identity/version binding with seller cases.', requiredBeforeActivation: true },
        { integration: 'Operator-qualified next-step outcome', status: 'missing', evidence: 'qualified, next_step_approved, introduced, and offer_review are not seller_cases statuses or governed seller_case_events outcomes.', requiredBeforeActivation: true },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['/sell exists.', 'Seller case and event authorities exist.', 'The seller send path uses the governed seller-outreach compatibility key.'],
        blockers: ['Canonical strategy-version attribution is absent.', 'Legacy lead and seller-case identity is not reconciled.', 'Operator qualification and next-step outcomes are not persisted.', 'Sourced-first-contact approval is not an end-to-end gate.', 'External send remains unapproved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two 30-day windows each include at least 15 complete submitted seller cases and five operator-qualified cases with no complaint or sensitivity regression.',
        'Revise a specific path when attributable option, source, or timing friction is correctable.',
        'Retire a tactic or path after provenance failure, material complaint, prohibited targeting, or two reviewed windows without qualified progression.'
      ),
    },
    lifecycleContract: {
      states: ['draft', 'submitted', 'needs_information', 'under_review', 'options_review', 'declined', 'withdrawn', 'closed', 'qualified', 'next_step_approved', 'introduced', 'offer_review'],
      initialState: 'draft',
      terminalStates: ['closed'],
      transitions: [
        { from: 'draft', to: 'submitted', event: 'seller_submits_case', persistence: 'current' },
        { from: 'draft', to: 'withdrawn', event: 'seller_withdraws_draft', persistence: 'current' },
        { from: 'submitted', to: 'needs_information', event: 'required_information_missing', persistence: 'current' },
        { from: 'submitted', to: 'under_review', event: 'operator_accepts_review', persistence: 'current' },
        { from: 'submitted', to: 'withdrawn', event: 'seller_withdraws_submitted_case', persistence: 'current' },
        { from: 'needs_information', to: 'submitted', event: 'seller_resubmits_information', persistence: 'current' },
        { from: 'needs_information', to: 'under_review', event: 'information_received', persistence: 'current' },
        { from: 'needs_information', to: 'withdrawn', event: 'seller_withdraws_information_case', persistence: 'current' },
        { from: 'under_review', to: 'needs_information', event: 'new_material_gap_found', persistence: 'current' },
        { from: 'under_review', to: 'options_review', event: 'operator_opens_options_review', persistence: 'current' },
        { from: 'under_review', to: 'declined', event: 'operator_declines_case', persistence: 'current' },
        { from: 'under_review', to: 'withdrawn', event: 'seller_withdraws_review_case', persistence: 'current' },
        { from: 'options_review', to: 'needs_information', event: 'options_review_needs_information', persistence: 'current' },
        { from: 'options_review', to: 'under_review', event: 'options_review_reopens_review', persistence: 'current' },
        { from: 'options_review', to: 'declined', event: 'options_review_declined', persistence: 'current' },
        { from: 'options_review', to: 'withdrawn', event: 'seller_withdraws_options_review', persistence: 'current' },
        { from: 'options_review', to: 'closed', event: 'options_review_closed', persistence: 'current' },
        { from: 'declined', to: 'closed', event: 'declined_case_closed', persistence: 'current' },
        { from: 'withdrawn', to: 'closed', event: 'withdrawn_case_closed', persistence: 'current' },
        { from: 'options_review', to: 'qualified', event: 'operator_records_qualified_path', persistence: 'target_only' },
        { from: 'qualified', to: 'next_step_approved', event: 'seller_and_operator_approve_next_step', persistence: 'target_only' },
        { from: 'qualified', to: 'closed', event: 'qualified_path_not_pursued', persistence: 'target_only' },
        { from: 'next_step_approved', to: 'introduced', event: 'approved_third_party_introduction', persistence: 'target_only' },
        { from: 'next_step_approved', to: 'offer_review', event: 'offer_or_structure_ready_for_review', persistence: 'target_only' },
        { from: 'next_step_approved', to: 'closed', event: 'approved_step_cancelled', persistence: 'target_only' },
        { from: 'introduced', to: 'closed', event: 'introduction_path_completed_or_ended', persistence: 'target_only' },
        { from: 'offer_review', to: 'closed', event: 'offer_path_completed_or_ended', persistence: 'target_only' },
      ],
      cadence: ['Immediate customer-requested confirmation.', 'Human review within one business day.', 'Permitted follow-up at days 2, 7, and 14, then stop.'],
      stopConditions: ['declined', 'withdrawn', 'closed', 'authority_conflict', 'representation_conflict', 'legal_dispute', 'sensitivity_concern'],
      recordAuthority: 'seller_cases is the current state authority; seller_case_events is the append-only transition authority.',
      persistedStates: ['draft', 'submitted', 'needs_information', 'under_review', 'options_review', 'declined', 'withdrawn', 'closed'],
      persistedEvents: ['seller_case_events.event_type', 'seller_case_events.from_status', 'seller_case_events.to_status'],
      targetOnlyStages: ['qualified', 'next_step_approved', 'introduced', 'offer_review'],
      stateNotes: lifecycleStateNotes(
        ['draft', 'submitted', 'needs_information', 'under_review', 'options_review', 'declined', 'withdrawn', 'closed'],
        ['qualified', 'next_step_approved', 'introduced', 'offer_review'],
        'seller_cases.status, with transitions recorded in seller_case_events'
      ),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'Seller case service owns seller_cases and seller_case_events.',
      humanOwner: 'A VestBlock operator owns options review, sourced-contact approval, offers, and introductions.',
      handoffRules: ['No source script owns customer outreach.', 'The receiving buyer, provider, or DealVault strategy must accept an explicit permissioned handoff.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'A complete submitted seller case receives a future governed operator-qualified next-step event.',
      leadingIndicators: ['complete intake rate', 'time to options review', 'qualified conversation', 'next-step approval', 'verified offer or referral progression'],
      businessValue: 'Permissioned acquisition, referral, or advisory opportunities with verified provenance.',
      learningInputs: ['strategy version', 'source tactic', 'property context', 'contact basis', 'selected option', 'operator decision', 'seller response', 'verified close'],
      learningWindowDays: 30,
      minimumExposure: 15,
      exposureUnit: 'complete_submitted_seller_cases',
      minimumPrimaryConversions: 5,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'source namespace/tactic', 'property', 'seller path', 'operator', 'verified outcome'],
      safeguards: outcomeSafeguards('Do not count a sourced lead, delivered email, appointment suggestion, or options_review case as operator-qualified.'),
      verifiedOutcomeRule: 'Count once only after a governed outcome event records the assigned operator, qualification reason, approved next step, seller case, and operating-strategy version.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: {
        available: false,
        evidence: 'seller_cases and seller_case_events can show submission, information review, options_review, decline, withdrawal, and close.',
        limitation: 'No current seller status or governed outcome event persists operator qualification, approved next step, introduction, or offer review with the operating-strategy version.',
      },
      stopConditions: ['complaint or sensitivity regression', 'authority conflict', 'provenance failure', 'duplicate contact', 'unsupported property or offer claim'],
    },

    sourceProvenance: sourceProvenance('seller_cases/seller_case_events and seller send-path consumer audit'),
  },
  property_opportunity_discovery: {
    strategyKey: 'property_opportunity_discovery',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'internal_only',
    destination: { mode: 'internal_only', path: null, cta: null },
    externalSendCap: 0,
    activation: blockedActivation(
      'Primary outcome is not currently observable as one accepted case-or-match review across the fragmented source, market-state, run, and lead records.',
      'DealMachine API access is unavailable until a new key is supplied and must not be replaced with export automation.'
    ),
    operatingContract: {
      objective: 'Identify provenance-backed property signals for operator review without claiming that a property is available or an owner is motivated.',
      targetParticipant: 'VestBlock operators evaluating property evidence for seller cases, buyer matches, builders, and reviewed opportunities.',
      problem: 'Raw property signals are noisy, age quickly, and create duplicate or inappropriate contact when provenance and ownership are fragmented.',
      valueExchange: 'Approved sources provide timestamped evidence; VestBlock returns a deduplicated, suppression-checked review candidate, never an automatic outreach target.',
      offer: 'An internal evidence-prioritization and operator-review queue with no direct customer CTA or dispatch.',
      eligibilityCriteria: ['Property identity and source event are present.', 'Observed timestamp, freshness rule, dedupe key, and provenance are recorded.', 'Owner/contact provenance and suppression or lawful-basis review can be completed before any handoff.'],
      disqualificationCriteria: ['Unresolved property identity or duplicate.', 'Stale, unsupported, prohibited, or license-incompatible source evidence.', 'Protected-class targeting, unsupported distress inference, or missing contact provenance.'],
      prioritizationRules: ['Prioritize current multi-source corroboration and explicit buyer-demand fit.', 'Route sensitive contexts to operator review without scoring them as motivation.', 'Lower priority or reject sources with repeated staleness, suppression, or identity failure.'],
      sourceData: ['strategy_source_events', 'strategy_market_state', 'command_center_strategy_runs', 'legacy leads', 'ATTOM', 'permitted HomeHarvest history', 'future native DealMachine API'],
      sourceDataRequirements: [
        { source: 'strategy_source_events and strategy_market_state', authority: 'Application source orchestrator', requiredEvidence: ['source namespace', 'external ID', 'observed time', 'freshness', 'dedupe key'], freshnessRule: 'Use the provider-specific SLA; a historical export is never current evidence.' },
        { source: 'ATTOM, permitted HomeHarvest history, and future DealMachine API', authority: 'Timestamped provider response under current terms', requiredEvidence: ['property identity', 'provider', 'retrieved time', 'field provenance', 'license boundary'], freshnessRule: 'Refresh before operator review when the provider SLA or material property event expires.' },
        { source: 'legacy leads and command-center runs', authority: 'Historical evidence only', requiredEvidence: ['lead ID', 'source tactic', 'run ID', 'prior contact/suppression history'], freshnessRule: 'Never treat a legacy outreach-ready label or old run as current eligibility.' },
      ],
      primaryChannels: ['operator_task', 'no_outreach'],
      secondaryChannels: ['no_outreach'],
      channelSelectionRules: ['Create an operator task for evidence review.', 'No source adapter, source cron, or tactic may select an external channel.', 'Any later seller communication inherits the seller strategy contract after an accepted handoff.'],
      followupCadence: ['Daily internal source refresh where permitted.', 'Operator review based on freshness and demand fit.', 'No external cadence; seller or buyer strategies own any accepted handoff.'],
      cadenceSteps: [
        { timing: 'daily where permitted', purpose: 'Refresh approved source evidence and expire stale facts.', channels: ['no_outreach'], condition: 'Provider access, terms, budget, and source health are current.' },
        { timing: 'after normalization and dedupe', purpose: 'Review provenance, suppression, sensitivity, and demand fit.', channels: ['operator_task'], condition: 'The candidate has complete source evidence.' },
      ],
      nurtureRules: ['This internal strategy does not nurture people.', 'A held candidate may receive a scheduled evidence refresh, not a communication sequence.'],
      reactivationRules: ['Re-open a held or rejected candidate only on a new, timestamped material source event.', 'A source disabled for systemic failure requires operator approval and a passed provenance test before reuse.'],
      crossLaneRoutes: [
        crossLane('seller_options_intake', 'An operator accepts a provenance-backed candidate for a customer-safe seller review.', 'Create or link a seller-case candidate without authorizing dispatch.'),
        crossLane('buyer_buy_box_activation', 'A verified property fact set matches a current active buy box.', 'Create a blinded operator match review; do not represent availability.'),
        crossLane('dealvault_activation', 'An operator-approved opportunity needs controlled records.', 'Request DealVault review only after opportunity authority and access are established.'),
      ],
      humanApprovalPoints: ['Natural-person contact eligibility', 'Sensitive or protected context', 'Source reactivation', 'Seller-case or buyer-match acceptance', 'Property availability or value language'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Public records do not establish motivation or blanket permission to contact.', 'Respect provider licensing, field-use, storage, and freshness terms.'],
      learningInputs: ['provider/source', 'jurisdiction', 'freshness', 'source tactic', 'dedupe result', 'review reason', 'contact quality', 'accepted case or match'],
      failureConditions: ['Systemic provenance failure', 'Repeated stale or duplicate data', 'Provider contract or budget failure', 'High suppression or complaint signal', 'No accepted review across two windows'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Disable a source or tactic after systemic provenance failure, prohibited targeting, or repeated stale evidence.'],
      handoffRules: ['Discovery owns evidence and qualification only.', 'The seller or buyer strategy must accept the candidate and owns every later customer interaction.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'Source event and market-state services', status: 'partial', evidence: 'Source events, market state, runs, and leads exist without one canonical discovery lifecycle.', requiredBeforeActivation: true },
        { integration: 'ATTOM', status: 'available', evidence: 'ATTOM enrichment exists but remains subject to freshness, terms, and operator review.', requiredBeforeActivation: false },
        { integration: 'DealMachine native API', status: 'blocked', evidence: 'The current API key is unavailable; future contact data must come from the new API, not export automation.', requiredBeforeActivation: false },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['Internal source and market-state records exist.', 'Canonical source-tactic crosswalks exist.', 'This contract prohibits direct outreach.'],
        blockers: ['No single persisted discovery lifecycle exists.', 'Primary outcome is not currently observable as one accepted case-or-match review.', 'Canonical strategy-version binding is absent.', 'Source-owner conflicts and DealMachine access remain unresolved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two 14-day windows each include 100 operator-reviewed candidates and ten verified case-or-match acceptances without provenance or complaint regression.',
        'Revise a specific provider, jurisdiction, freshness rule, or tactic when reviewed evidence identifies a correctable source-quality problem.',
        'Retire a source or tactic for systemic provenance failure, prohibited use, or two complete reviewed windows without qualified progression.'
      ),
    },
    lifecycleContract: {
      states: ['source_observed', 'normalized', 'deduplicated', 'evidence_current', 'contact_review', 'eligible', 'held', 'rejected', 'seller_case_candidate', 'match_review'],
      initialState: 'source_observed',
      terminalStates: ['held', 'rejected', 'seller_case_candidate', 'match_review'],
      transitions: [
        { from: 'source_observed', to: 'normalized', event: 'source_payload_normalized', persistence: 'target_only' },
        { from: 'normalized', to: 'deduplicated', event: 'identity_and_property_deduplicated', persistence: 'target_only' },
        { from: 'deduplicated', to: 'evidence_current', event: 'freshness_and_provenance_pass', persistence: 'target_only' },
        { from: 'evidence_current', to: 'contact_review', event: 'operator_review_requested', persistence: 'target_only' },
        { from: 'contact_review', to: 'eligible', event: 'operator_accepts_candidate', persistence: 'target_only' },
        { from: 'contact_review', to: 'held', event: 'candidate_needs_future_evidence', persistence: 'target_only' },
        { from: 'contact_review', to: 'rejected', event: 'candidate_fails_review', persistence: 'target_only' },
        { from: 'eligible', to: 'seller_case_candidate', event: 'seller_strategy_accepts_handoff', persistence: 'target_only' },
        { from: 'eligible', to: 'match_review', event: 'buyer_strategy_accepts_handoff', persistence: 'target_only' },
      ],
      cadence: ['Provider-specific internal refresh.', 'Operator review after dedupe and freshness checks.', 'No external cadence.'],
      stopConditions: ['held', 'rejected', 'source_disabled', 'provider_terms_failure', 'provenance_failure', 'suppression_failure'],
      recordAuthority: 'strategy_source_events, strategy_market_state, command_center_strategy_runs, and leads each persist partial facts; no single canonical lifecycle authority exists.',
      persistedStates: [],
      persistedEvents: ['source-event rows', 'market-state observations', 'strategy-run results', 'legacy lead status/history'],
      targetOnlyStages: ['source_observed', 'normalized', 'deduplicated', 'evidence_current', 'contact_review', 'eligible', 'held', 'rejected', 'seller_case_candidate', 'match_review'],
      stateNotes: lifecycleStateNotes([], ['source_observed', 'normalized', 'deduplicated', 'evidence_current', 'contact_review', 'eligible', 'held', 'rejected', 'seller_case_candidate', 'match_review'], 'the fragmented source-event, market-state, run, and lead records'),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'The application source orchestrator owns source facts; the CRM owns qualification once a canonical candidate exists.',
      humanOwner: 'A VestBlock operator owns contact review and every case or match acceptance.',
      handoffRules: ['Source jobs may ingest and score evidence only.', 'No contact occurs until a receiving customer strategy accepts the reviewed handoff.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'A provenance-backed operator-reviewed property candidate is accepted into a seller-case or buyer-match review.',
      leadingIndicators: ['fresh-record rate', 'dedupe rate', 'evidence completeness', 'operator-review yield', 'lawful-contact eligibility'],
      businessValue: 'Higher-quality property evidence and fewer wasted, duplicate, stale, or noncompliant contacts.',
      learningInputs: ['strategy version', 'source provider', 'jurisdiction', 'freshness', 'tactic', 'review reason', 'receiving strategy', 'verified progression'],
      learningWindowDays: 14,
      minimumExposure: 100,
      exposureUnit: 'operator_reviewed_property_candidates',
      minimumPrimaryConversions: 10,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'source namespace/tactic', 'provider', 'jurisdiction', 'operator', 'receiving strategy'],
      safeguards: outcomeSafeguards('Never count ingestion, enrichment, a strategy run, or an outreach-ready lead as a case-or-match acceptance.'),
      verifiedOutcomeRule: 'Count once only when the reviewed candidate and the receiving seller-case or buyer-match record share a persisted handoff ID and accepted event.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: {
        available: false,
        evidence: 'Current source_events, market_state, runs, and leads contain partial evidence but no single accepted handoff joins them to a seller case or buyer match.',
        limitation: 'The primary outcome cannot be verified until Gate 3C creates the canonical candidate and receiving-strategy handoff link.',
      },
      stopConditions: ['source provenance failure', 'provider-terms breach', 'suppression or complaint regression', 'repeated stale evidence', 'no qualified progression after two windows'],
    },
    sourceProvenance: sourceProvenance('property source-events/market-state/runs/leads consumer audit'),
  },
  buyer_buy_box_activation: {
    strategyKey: 'buyer_buy_box_activation',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/workspace/profiles/new?role=buyer', cta: 'Create your free buyer profile' },
    externalSendCap: 0,
    activation: blockedActivation(
      'Primary outcome is not currently observable because operator-reviewed match acceptance lacks a complete persisted response lifecycle.',
      'Legacy buyers and buy boxes are not yet bridged to participant profiles and canonical strategy versions.'
    ),
    operatingContract: {
      objective: 'Maintain a verified, current buyer buy box and route only operator-reviewed, relevant property opportunities.',
      targetParticipant: 'Active local, institutional, specialty, landlord, builder, and acquisition buyers with current criteria and capacity.',
      problem: 'Buyer demand is not actionable when markets, property types, economics, capacity, no-go criteria, or permissions are incomplete or stale.',
      valueExchange: 'The buyer maintains private criteria and matching permission in exchange for fewer, better operator-reviewed opportunities.',
      offer: 'A free buyer profile, 30-day criteria refresh, and controlled match-review path.',
      eligibilityCriteria: ['participant_profiles status is active after professional participant activation', 'Buyer role and identity are verified.', 'Markets, asset types, economics, capacity/proof state, no-go criteria, matching permission, and communication preference are current.'],
      disqualificationCriteria: ['Inactive, stale, disputed, or unverified profile.', 'Missing matching permission or proof path.', 'A request for guaranteed inventory, returns, pricing, or transaction outcome.'],
      prioritizationRules: ['Prioritize exact current buy-box fit and verified capacity.', 'Prefer buyers who provide timely pass reasons and keep criteria current.', 'Do not rank by protected attributes or promised return.'],
      sourceData: ['participant_profiles', 'participant_profile_events', 'participant_matches', 'legacy buyers and buy boxes pending bridge'],
      sourceDataRequirements: [
        { source: 'participant_profiles and participant_profile_events', authority: 'Participant profile service', requiredEvidence: ['buyer role', 'active status', 'operator verification', 'matching permission', 'criteria', 'verification timestamp'], freshnessRule: 'Refresh buyer criteria and capacity at least every 30 days before a new match.' },
        { source: 'participant_matches and opportunity evidence', authority: 'CRM match record plus operator-reviewed opportunity facts', requiredEvidence: ['profile ID', 'opportunity ID', 'fit factors', 'operator decision', 'response'], freshnessRule: 'Recheck property facts, availability boundary, and buyer criteria immediately before notification.' },
      ],
      primaryChannels: ['website_notification', 'operator_task'],
      secondaryChannels: ['resend_email', 'outlook_graph', 'no_outreach'],
      channelSelectionRules: ['Use website notification for an approved match.', 'Use email only with matching communication permission.', 'The operator reviews the first share and any investment, return, or availability language.'],
      followupCadence: ['Post-activation criteria refresh every 30 days.', 'One notification per operator-approved relevant match.', 'No generic buyer blast or pre-activation reminder ownership.'],
      cadenceSteps: [
        { timing: 'every 30 days', purpose: 'Reconfirm buyer criteria and capacity.', channels: ['website_notification', 'resend_email'], condition: 'The active buyer permitted criteria reminders.' },
        { timing: 'when an operator approves a match', purpose: 'Present one reviewed opportunity for buyer response.', channels: ['website_notification', 'resend_email', 'outlook_graph'], condition: 'Criteria, permission, opportunity evidence, and suppression are current.' },
      ],
      nurtureRules: ['Nurture only around criteria freshness and explicit buyer interests.', 'Do not send generic inventory or repeat opportunities the buyer has passed.'],
      reactivationRules: ['A dormant buyer reactivates only after current criteria, capacity, and matching permission are reconfirmed.', 'A passed opportunity does not reactivate without a materially changed verified fact.'],
      crossLaneRoutes: [
        crossLane('professional_participant_activation', 'The prospective buyer has not completed active profile verification.', 'Return ownership to the shared pre-active profile journey.'),
        crossLane('property_opportunity_discovery', 'Current buyer demand justifies an internal source review.', 'Provide blinded demand criteria without authorizing seller contact.'),
        crossLane('capital_readiness_intake', 'A buyer requests acquisition financing readiness.', 'Create a separately consented Capital case.'),
        crossLane('dealvault_activation', 'An accepted reviewed match needs controlled evidence continuity.', 'Request DealVault activation after access approval.'),
      ],
      humanApprovalPoints: ['Initial opportunity share', 'Capacity representation', 'Investment-return or availability language', 'Property disclosure', 'Cross-party introduction'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Matching permission is not marketing permission, and a match is not a representation that a property is available.'],
      learningInputs: ['criteria fit', 'pass reason', 'source', 'asset type', 'timing', 'price or structure gap', 'match quality', 'transaction stage'],
      failureConditions: ['Stale capacity', 'Repeated irrelevant match feedback', 'Missing response persistence', 'Withdrawn matching permission', 'Opportunity evidence conflict'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Pause the buyer role when criteria or capacity misses the 30-day refresh SLA.'],
      handoffRules: ['Professional participant activation exclusively owns draft through active.', 'Buyer strategy begins only after the active handoff and owns criteria refresh and reviewed matches.'],
      integrationDependencies: [GATE_3C_DEPENDENCY, { integration: 'Participant profile service', status: 'available', evidence: 'participant_profiles and events persist identity, role, permissions, and active status.', requiredBeforeActivation: true }, { integration: 'Buyer match response lifecycle', status: 'missing', evidence: 'Current consumer truth does not provide a complete operator-reviewed match and participant-acceptance response authority.', requiredBeforeActivation: true }, { integration: 'Legacy buyer bridge', status: 'partial', evidence: 'Legacy buyers and buy boxes exist separately from participant profiles.', requiredBeforeActivation: true }],
      activationReadiness: { status: 'blocked', readyElements: ['Role-aware buyer profile destination exists.', 'Participant profile permissions and verification exist.', 'Historical buyer and buy-box data are preserved.'], blockers: ['Canonical strategy-version binding is absent.', 'Legacy buyer identity is not bridged.', 'Primary outcome is not currently observable as an operator-reviewed buyer match accepted by the participant.', 'External opportunity notifications remain unapproved.'] },
      versionDecisionRule: decisionRule('Promote after two 45-day windows each include 20 operator-reviewed buyer matches and five verified acceptances without relevance or complaint regression.', 'Revise criteria, fit scoring, or notification timing when pass reasons identify a correctable mismatch.', 'Retire a segment or match rule after material misrepresentation or two complete windows without accepted matches.'),
    },
    lifecycleContract: {
      states: ['active', 'criteria_current', 'match_review', 'notified', 'interested', 'passed', 'transaction_review', 'completed', 'dormant', 'paused', 'withdrawn', 'archived'],
      initialState: 'active',
      terminalStates: ['passed', 'completed', 'dormant', 'withdrawn', 'archived'],
      transitions: [
        { from: 'active', to: 'criteria_current', event: 'buyer_criteria_verified', persistence: 'target_only' }, { from: 'active', to: 'paused', event: 'profile_paused', persistence: 'current' }, { from: 'active', to: 'withdrawn', event: 'profile_withdrawn', persistence: 'current' },
        { from: 'criteria_current', to: 'match_review', event: 'operator_opens_match_review', persistence: 'target_only' }, { from: 'criteria_current', to: 'dormant', event: 'criteria_expire', persistence: 'target_only' },
        { from: 'match_review', to: 'notified', event: 'operator_approves_notification', persistence: 'target_only' }, { from: 'match_review', to: 'dormant', event: 'match_review_ends_without_share', persistence: 'target_only' },
        { from: 'notified', to: 'interested', event: 'buyer_accepts_review', persistence: 'target_only' }, { from: 'notified', to: 'passed', event: 'buyer_passes', persistence: 'target_only' },
        { from: 'interested', to: 'transaction_review', event: 'operator_accepts_transaction_review', persistence: 'target_only' },
        { from: 'transaction_review', to: 'completed', event: 'verified_transaction_stage_completed', persistence: 'target_only' }, { from: 'transaction_review', to: 'dormant', event: 'transaction_review_ends', persistence: 'target_only' },
        { from: 'paused', to: 'archived', event: 'profile_archived', persistence: 'current' },
      ],
      cadence: ['Role strategy starts only after active.', 'Criteria refresh every 30 days.', 'Match notification only after operator review.'],
      stopConditions: ['passed', 'completed', 'dormant', 'withdrawn', 'archived', 'criteria_stale', 'matching_permission_revoked'],
      recordAuthority: 'participant_profiles and participant_profile_events own active/paused/withdrawn/archived profile truth; a complete buyer match-response authority is not yet present.',
      persistedStates: ['active', 'paused', 'withdrawn', 'archived'],
      persistedEvents: ['participant profile activation/verification event', 'profile pause/withdraw/archive event', 'partial participant match records'],
      targetOnlyStages: ['criteria_current', 'match_review', 'notified', 'interested', 'passed', 'transaction_review', 'completed', 'dormant'],
      stateNotes: lifecycleStateNotes(['active', 'paused', 'withdrawn', 'archived'], ['criteria_current', 'match_review', 'notified', 'interested', 'passed', 'transaction_review', 'completed', 'dormant'], 'participant_profiles/events and the incomplete participant_matches model'),
    },
    ownerContract: { crmAuthority: 'vestblock_crm', automationRole: 'vestblock_application', dispatchAuthority: 'none_in_gate_3b', recordOwner: 'Participant profile service owns profile truth; the canonical CRM must own post-active buyer match responses.', humanOwner: 'A VestBlock operator owns opportunity review and introductions.', handoffRules: ['Accept exactly one idempotent active-profile handoff.', 'Relinquish ownership to the transaction or DealVault strategy only after explicit acceptance.'] },
    outcomeContract: {
      primaryConversionEvent: 'An operator-reviewed buyer match is explicitly accepted by the active buyer for review.',
      leadingIndicators: ['active buyer profiles', 'criteria freshness', 'operator-reviewed matches', 'buyer response rate', 'transaction-review progression'],
      businessValue: 'More useful demand routing and potential DealVault-supported transactions.',
      learningInputs: ['strategy version', 'buyer profile', 'buy-box version', 'match factors', 'opportunity source', 'operator approval', 'buyer response', 'verified stage'],
      learningWindowDays: 45, minimumExposure: 20, exposureUnit: 'operator_reviewed_buyer_matches', minimumPrimaryConversions: 5, requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'buyer profile', 'buy-box version', 'opportunity', 'operator', 'response'],
      safeguards: outcomeSafeguards('Do not count an active profile, computed match, notification, open, or click as participant acceptance.'),
      verifiedOutcomeRule: 'Count once when the operator-approved match record and the active buyer response record share an idempotent match ID and the response is accepted.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'Profiles and partial match rows exist, but the consumer audit found no complete persisted response states proving buyer acceptance.', limitation: 'Gate 3C must add canonical version and accepted-response binding before this conversion is measurable.' },
      stopConditions: ['irrelevant-match regression', 'stale criteria or capacity', 'permission withdrawal', 'unsupported opportunity claim', 'duplicate notification'],
    },
    sourceProvenance: sourceProvenance('participant profile and buyer-match consumer audit'),
  },

  lender_provider_criteria: {
    strategyKey: 'lender_provider_criteria', version: 1, versionStatus: 'draft', executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/workspace/profiles/new?role=lender', cta: 'Add your lending criteria' }, externalSendCap: 0,
    activation: blockedActivation('Primary outcome is not currently observable because accepted provider introductions lack one complete response authority.', 'No lender products or lender matches exist in current production evidence.'),
    operatingContract: {
      objective: 'Maintain verified, current lender/provider criteria for permissioned, operator-reviewed introductions.',
      targetParticipant: 'Lenders, CDFIs, brokers, banks, private lenders, and specialty capital providers seeking qualified demand.',
      problem: 'Provider lists are unusable when products, geography, amounts, exclusions, capacity, and criteria freshness are incomplete.',
      valueExchange: 'A provider maintains private, current criteria and permissions in exchange for fewer, better reviewed introductions.',
      offer: 'A free provider profile, 30–60 day criteria verification, and controlled introduction review.',
      eligibilityCriteria: ['participant_profiles is active after shared activation', 'Organization and role are verified.', 'Products, geography, amount range, criteria, exclusions, documents, capacity, matching permission, and verification date are present.'],
      disqualificationCriteria: ['Unverified organization, authority, capacity, or licensing boundary.', 'Expired criteria or withdrawn matching permission.', 'A requirement that VestBlock represent approval or suitability.'],
      prioritizationRules: ['Prioritize current criteria that match a permissioned, review-ready capital case.', 'Prefer providers with timely, evidence-backed disposition reasons.', 'Do not rank by promised approvals, terms, or compensation.'],
      sourceData: ['participant_profiles', 'participant_profile_events', 'provider criteria', 'capital_cases', 'legacy lenders pending bridge'],
      sourceDataRequirements: [
        { source: 'participant_profiles and participant_profile_events', authority: 'Participant profile service', requiredEvidence: ['lender role', 'active status', 'operator verification', 'matching permission', 'provider criteria'], freshnessRule: 'Reconfirm volatile criteria every 30 days and stable criteria no later than 60 days.' },
        { source: 'capital_cases and provider-match review', authority: 'Capital case service plus operator review', requiredEvidence: ['provider-sharing permission', 'readiness status', 'criteria fit', 'introduction decision'], freshnessRule: 'Recheck case consent and provider criteria immediately before an introduction.' },
      ],
      primaryChannels: ['website_notification', 'operator_task'], secondaryChannels: ['resend_email', 'outlook_graph', 'manual_phone_task', 'no_outreach'],
      channelSelectionRules: ['Use the website for criteria entry and review.', 'Use operator tasks for match and introduction approval.', 'Use email or a manual phone task only with documented provider preference and suppression clearance.'],
      followupCadence: ['Role strategy starts only after active.', 'Criteria verification every 30–60 days based on volatility.', 'One introduction request per operator-approved case.'],
      cadenceSteps: [
        { timing: 'every 30–60 days', purpose: 'Reconfirm criteria and capacity.', channels: ['website_notification', 'resend_email'], condition: 'The provider permitted criteria reminders.' },
        { timing: 'after operator match approval', purpose: 'Request review of one permissioned case.', channels: ['website_notification', 'outlook_graph', 'resend_email'], condition: 'Provider criteria, case readiness, sharing permission, and suppression are current.' },
      ],
      nurtureRules: ['Nurture is limited to provider criteria freshness and opted-in relevant demand.', 'Do not send borrower or project details before permissioned operator review.'],
      reactivationRules: ['Reactivate a paused provider only after organization, capacity, criteria, and permissions are reverified.', 'Prior complaints or contradictory outcomes require human clearance.'],
      crossLaneRoutes: [crossLane('professional_participant_activation', 'The provider has not completed active verification.', 'Return to the shared pre-active profile owner.'), crossLane('capital_readiness_intake', 'A provider accepts a review-ready case.', 'Accept only the permissioned, operator-reviewed case handoff.'), crossLane('investor_capital_relationships', 'The participant is a verified real-estate investor organizing a current acquisition thesis rather than offering a lender product.', 'Offer the real-estate investor role path only; broader capital-partner intent remains in operator review until a distinct governed role and schema exist.')],
      humanApprovalPoints: ['Borrower/project introduction', 'Underwriting or eligibility statement', 'Provider recommendation', 'Compensation disclosure', 'Regulated-service boundary'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'VestBlock does not represent provider approval, terms, suitability, or endorsement.'],
      learningInputs: ['criteria rule', 'rejection reason', 'term drift', 'response time', 'match outcome', 'customer experience', 'provider-confirmed disposition'],
      failureConditions: ['Expired criteria', 'Unverified capacity', 'Contradictory outcomes', 'Missing introduction response authority', 'Complaint or regulatory concern'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Pause when criteria expire, provider identity/capacity cannot be verified, or outcomes contradict submitted criteria.'],
      handoffRules: ['Professional participant activation owns pre-active verification.', 'Provider strategy owns criteria refresh and introductions after active; Capital retains the customer case.'],
      integrationDependencies: [GATE_3C_DEPENDENCY, { integration: 'Participant profile service', status: 'available', evidence: 'Profile identity, role, permissions, and active state exist.', requiredBeforeActivation: true }, { integration: 'Provider products and accepted-introduction lifecycle', status: 'missing', evidence: 'Current evidence has lenders but no lender products, lender matches, or complete response authority.', requiredBeforeActivation: true }, { integration: 'Legacy lender bridge', status: 'partial', evidence: 'Legacy lender records are separate from participant profiles.', requiredBeforeActivation: true }],
      activationReadiness: { status: 'blocked', readyElements: ['Role-aware lender destination exists.', 'Capital cases contain separate provider-sharing permission.', 'Participant verification fields exist.'], blockers: ['Canonical strategy-version binding is absent.', 'No lender products or lender matches exist.', 'Primary outcome is not currently observable as a provider-accepted reviewed introduction.', 'External introductions remain unapproved.'] },
      versionDecisionRule: decisionRule('Promote after two 60-day windows each include 12 operator-reviewed provider introductions and three verified acceptances without criteria or complaint regression.', 'Revise criteria capture or match logic when attributable declines reveal a correctable fit issue.', 'Retire a provider segment or path after material compliance failure or two complete windows without accepted introductions.'),
    },
    lifecycleContract: {
      states: ['active', 'criteria_refresh_due', 'match_review', 'introduction_accepted', 'declined', 'paused', 'dormant', 'dnc', 'archived'], initialState: 'active', terminalStates: ['introduction_accepted', 'declined', 'dormant', 'dnc', 'archived'],
      transitions: [
        { from: 'active', to: 'criteria_refresh_due', event: 'criteria_refresh_sla_reached', persistence: 'target_only' }, { from: 'active', to: 'paused', event: 'profile_paused', persistence: 'current' }, { from: 'active', to: 'dnc', event: 'provider_withdraws_contact_permission', persistence: 'target_only' },
        { from: 'criteria_refresh_due', to: 'match_review', event: 'criteria_reverified_and_match_opened', persistence: 'target_only' }, { from: 'criteria_refresh_due', to: 'dormant', event: 'criteria_expire', persistence: 'target_only' },
        { from: 'match_review', to: 'introduction_accepted', event: 'provider_accepts_introduction', persistence: 'target_only' }, { from: 'match_review', to: 'declined', event: 'provider_declines_introduction', persistence: 'target_only' },
        { from: 'paused', to: 'archived', event: 'profile_archived', persistence: 'current' },
      ],
      cadence: ['Role strategy starts after active.', 'Criteria refresh every 30–60 days.', 'Introduction only after operator approval.'], stopConditions: ['introduction_accepted', 'declined', 'dormant', 'dnc', 'archived', 'criteria_expired', 'capacity_unverified'],
      recordAuthority: 'participant_profiles and participant_profile_events own profile truth; no complete provider-product, match, and accepted-response authority exists.',
      persistedStates: ['active', 'paused', 'archived'], persistedEvents: ['participant profile activation/verification event', 'profile pause/archive event'], targetOnlyStages: ['criteria_refresh_due', 'match_review', 'introduction_accepted', 'declined', 'dormant', 'dnc'],
      stateNotes: lifecycleStateNotes(['active', 'paused', 'archived'], ['criteria_refresh_due', 'match_review', 'introduction_accepted', 'declined', 'dormant', 'dnc'], 'participant_profiles/events; the provider match-response model is missing'),
    },
    ownerContract: { crmAuthority: 'vestblock_crm', automationRole: 'vestblock_application', dispatchAuthority: 'none_in_gate_3b', recordOwner: 'Participant profile service owns provider identity/profile; CRM must own post-active criteria and introduction responses.', humanOwner: 'A VestBlock operator owns provider verification, match review, and introduction.', handoffRules: ['Accept one active-profile handoff.', 'Capital retains the customer case; provider strategy records only the provider-side response.'] },
    outcomeContract: {
      primaryConversionEvent: 'A verified provider accepts an operator-reviewed, permissioned introduction.', leadingIndicators: ['verified provider profiles', 'product completeness', 'criteria freshness', 'reviewed match precision', 'provider response time'], businessValue: 'Current capital supply and fewer unsuitable introductions.', learningInputs: ['strategy version', 'provider profile', 'criteria version', 'capital case', 'fit factors', 'operator approval', 'provider response', 'confirmed disposition'],
      learningWindowDays: 60, minimumExposure: 12, exposureUnit: 'operator_reviewed_provider_introductions', minimumPrimaryConversions: 3, requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'provider profile', 'criteria version', 'capital path', 'operator', 'provider response'], safeguards: outcomeSafeguards('Do not count a lender record, profile activation, criteria refresh, or sent introduction request as provider acceptance.'),
      verifiedOutcomeRule: 'Count once when a current verified provider and permissioned capital case share an operator-approved introduction ID with a persisted accepted provider response.', targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'Lender records and participant-profile foundations exist, but no lender products, lender matches, or accepted-introduction response authority exists.', limitation: 'Gate 3C plus a provider match-response model is required before the primary conversion can be verified.' },
      stopConditions: ['criteria expiry', 'capacity or identity failure', 'complaint', 'regulatory concern', 'contradictory provider outcomes'],
    },
    sourceProvenance: sourceProvenance('participant profile, lender, product, and match consumer audit'),
  },

  next_move_free_roadmap: {
    strategyKey: 'next_move_free_roadmap', version: 1, versionStatus: 'draft', executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/next-move', cta: 'Build my free Next Move roadmap' }, externalSendCap: 0,
    activation: blockedActivation('Questionnaire starts and post-roadmap action progress are not persisted as a canonical lifecycle.', 'Optional follow-up must remain separate from analysis consent and transactional confirmation.'),
    operatingContract: {
      objective: 'Generate and save a practical educational sequence across credit, funding, income, business readiness, property, and opportunity paths.',
      targetParticipant: 'People and business owners who need a credible starting point and order of operations.',
      problem: 'People often have multiple goals but no realistic sequence, clear preparation path, or transparent route into the right VestBlock lane.',
      valueExchange: 'The participant provides questionnaire facts and analysis consent in exchange for a free deterministic roadmap with optional bounded AI refinement.',
      offer: 'A free questionnaire, saved roadmap, prioritized actions, and explicit routes into responsible VestBlock next steps.',
      eligibilityCriteria: ['The participant supplies the required questionnaire fields.', 'Analysis consent is explicit.', 'Any marketing or progress follow-up permission is separately recorded.'],
      disqualificationCriteria: ['Missing analysis consent.', 'Identity or data-integrity conflict.', 'A request for legal, tax, investment, credit, underwriting, income, or approval certainty.'],
      prioritizationRules: ['Generate the roadmap immediately after a valid submission.', 'Prioritize foundational blockers before financing, deal, or growth recommendations.', 'Use customer-stated focus and readiness, not protected attributes, to order actions.'],
      sourceData: ['next_move_questionnaires', 'questionnaire answers', 'roadmap_json', 'attribution_json', 'customer feedback and requested follow-up'],
      sourceDataRequirements: [
        { source: 'next_move_questionnaires', authority: 'Next Move persistence service', requiredEvidence: ['focus', 'goal', 'timeline', 'current position', 'obstacle', 'analysis consent', 'roadmap_json'], freshnessRule: 'Treat each questionnaire as a dated snapshot; request a new submission when the participant reports a material change.' },
        { source: 'participant progress and feedback', authority: 'Target CRM events not yet implemented', requiredEvidence: ['action ID', 'progress event', 'feedback', 'receiving strategy handoff'], freshnessRule: 'Use only customer-reported or receiving-strategy-verified progress.' },
      ],
      primaryChannels: ['website_notification'], secondaryChannels: ['resend_email', 'operator_task', 'no_outreach'],
      channelSelectionRules: ['Deliver the roadmap in the website flow.', 'Use transactional confirmation only for the requested roadmap.', 'Use optional progress email or operator follow-up only with separate permission.'],
      followupCadence: ['Immediate roadmap generation and display.', 'Optional checkpoints at days 7, 30, 60, and 90.', 'No optional reminder without separate permission.'],
      cadenceSteps: [
        { timing: 'immediate', purpose: 'Generate and display the requested roadmap.', channels: ['website_notification'], condition: 'A valid questionnaire and analysis consent were persisted.' },
        { timing: 'days 7, 30, 60, and 90', purpose: 'Ask for action progress or offer the selected next step.', channels: ['resend_email', 'operator_task'], condition: 'The participant opted into follow-up and has not completed, deleted, or disengaged.' },
      ],
      nurtureRules: ['Nurture follows the saved roadmap and never introduces an unrelated offer.', 'Each receiving lane owns its own qualification after an explicit handoff.'],
      reactivationRules: ['Invite a new questionnaire after a customer-reported material change or after 90 days of inactivity with permission.', 'Do not resurrect deleted or explicitly disengaged records.'],
      crossLaneRoutes: [
        crossLane('credit_education_support', 'The roadmap identifies credit-report understanding as the appropriate next step.', 'Offer the secure credit-upload path without promising an outcome.'),
        crossLane('business_formation_readiness', 'The roadmap identifies foundational business gaps.', 'Offer the guided start-business path.'),
        crossLane('capital_readiness_intake', 'The participant has a defined capital need and sufficient foundational readiness.', 'Start a separate Capital intake with purpose-specific consent.'),
        crossLane('seller_options_intake', 'The participant requests property selling help.', 'Offer /sell and let the seller strategy qualify the case.'),
        crossLane('professional_participant_activation', 'The participant wants network matching as an approved role.', 'Offer the role-aware profile path with separate permissions.'),
      ],
      humanApprovalPoints: ['Financial, credit, legal, tax, investment, or underwriting interpretation', 'Material AI recommendation change', 'Requested operator follow-up', 'Cross-lane offer outside the stated purpose'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'The roadmap is educational and cannot make a legal, tax, credit, investment, or underwriting decision.'],
      learningInputs: ['abandonment step', 'focus/path', 'roadmap model', 'saved action', 'usefulness feedback', 'cross-lane transition', 'customer-reported progress'],
      failureConditions: ['Missing analysis consent', 'Roadmap generation failure', 'Broken destination', 'Unbounded AI claim', 'Optional contact without marketing/follow-up permission'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Stop optional reminders on deletion request, completed path, or explicit disengagement.'],
      handoffRules: ['Roadmap owns educational sequencing only.', 'The receiving strategy rechecks eligibility, permissions, destination, communication, and outcome ownership.'],
      integrationDependencies: [GATE_3C_DEPENDENCY, { integration: 'Next Move persistence', status: 'available', evidence: 'next_move_questionnaires stores the submitted snapshot and roadmap JSON.', requiredBeforeActivation: true }, { integration: 'Roadmap action-progress lifecycle', status: 'missing', evidence: 'No generic questionnaire status or canonical action-progress event model exists.', requiredBeforeActivation: true }],
      activationReadiness: { status: 'blocked', readyElements: ['/next-move exists.', 'Questionnaire and roadmap persistence exist.', 'Analysis, marketing, and follow-up permissions are separated.'], blockers: ['Canonical strategy-version binding is absent.', 'Questionnaire starts are not persisted for the required exposure denominator.', 'Post-roadmap action progress and receiving-strategy acceptance are incomplete.', 'Optional external follow-up remains unapproved.'] },
      versionDecisionRule: decisionRule('Promote after two 30-day windows each include 100 attributable questionnaire starts and 40 generated-and-saved roadmaps with no advice or consent regression.', 'Revise a focus path when attributable abandonment or usefulness feedback identifies a correctable sequencing problem.', 'Retire a path after material claim failure or two complete windows without qualified generation and save progression.'),
    },
    lifecycleContract: {
      states: ['started', 'submitted', 'roadmap_generated', 'saved', 'action_due', 'progress_reported', 'completed', 'rerouted', 'reengage', 'deletion_requested'], initialState: 'started', terminalStates: ['completed', 'rerouted', 'deletion_requested'],
      transitions: [
        { from: 'started', to: 'submitted', event: 'questionnaire_persisted', persistence: 'target_only' }, { from: 'started', to: 'deletion_requested', event: 'participant_abandons_and_requests_deletion', persistence: 'target_only' },
        { from: 'submitted', to: 'roadmap_generated', event: 'roadmap_json_created', persistence: 'target_only' }, { from: 'submitted', to: 'deletion_requested', event: 'participant_requests_deletion', persistence: 'target_only' },
        { from: 'roadmap_generated', to: 'saved', event: 'roadmap_record_saved', persistence: 'target_only' }, { from: 'roadmap_generated', to: 'rerouted', event: 'immediate_receiving_strategy_handoff', persistence: 'target_only' }, { from: 'roadmap_generated', to: 'deletion_requested', event: 'participant_requests_deletion', persistence: 'target_only' },
        { from: 'saved', to: 'action_due', event: 'saved_action_due', persistence: 'target_only' }, { from: 'saved', to: 'completed', event: 'participant_reports_completion', persistence: 'target_only' }, { from: 'saved', to: 'rerouted', event: 'receiving_strategy_accepts_handoff', persistence: 'target_only' },
        { from: 'action_due', to: 'progress_reported', event: 'participant_reports_progress', persistence: 'target_only' }, { from: 'action_due', to: 'reengage', event: 'permitted_checkpoint_due', persistence: 'target_only' },
        { from: 'progress_reported', to: 'completed', event: 'roadmap_goal_completed', persistence: 'target_only' }, { from: 'progress_reported', to: 'rerouted', event: 'next_lane_accepted', persistence: 'target_only' }, { from: 'progress_reported', to: 'reengage', event: 'next_checkpoint_due', persistence: 'target_only' },
        { from: 'reengage', to: 'saved', event: 'participant_returns_to_roadmap', persistence: 'target_only' }, { from: 'reengage', to: 'deletion_requested', event: 'participant_requests_deletion', persistence: 'target_only' },
      ],
      cadence: ['Immediate generation.', 'Optional days 7, 30, 60, and 90 checkpoints.', 'Stop on completion, reroute, deletion, or disengagement.'], stopConditions: ['completed', 'rerouted', 'deletion_requested', 'no_followup_permission', 'explicit_disengagement'],
      recordAuthority: 'next_move_questionnaires stores a submitted questionnaire and roadmap snapshot but has no generic lifecycle status.',
      persistedStates: [], persistedEvents: ['questionnaire row created', 'roadmap_json stored', 'confirmation_status updated', 'operator_task_status updated', 'deletion_requested_at/deleted_at set'],
      targetOnlyStages: ['started', 'submitted', 'roadmap_generated', 'saved', 'action_due', 'progress_reported', 'completed', 'rerouted', 'reengage', 'deletion_requested'],
      stateNotes: lifecycleStateNotes([], ['started', 'submitted', 'roadmap_generated', 'saved', 'action_due', 'progress_reported', 'completed', 'rerouted', 'reengage', 'deletion_requested'], 'next_move_questionnaires, which stores facts/events rather than a generic status'),
    },
    ownerContract: { crmAuthority: 'vestblock_crm', automationRole: 'vestblock_application', dispatchAuthority: 'none_in_gate_3b', recordOwner: 'Next Move persistence service owns questionnaire and roadmap snapshots; CRM must own future action events.', humanOwner: 'A VestBlock operator owns requested follow-up and regulated-topic review.', handoffRules: ['Emit one idempotent, permissioned route proposal.', 'The receiving strategy accepts ownership before any lane-specific communication.'] },
    outcomeContract: {
      primaryConversionEvent: 'A valid questionnaire produces a nonempty roadmap that is persisted and returned to the participant.', leadingIndicators: ['questionnaire starts', 'submission completion', 'generation success', 'roadmap persistence', 'qualified receiving-lane starts'], businessValue: 'Broad ecosystem acquisition and better-qualified routing into the appropriate lane.', learningInputs: ['strategy version', 'focus', 'source', 'abandonment', 'roadmap model', 'action selection', 'feedback', 'receiving path'],
      learningWindowDays: 30, minimumExposure: 100, exposureUnit: 'questionnaire_starts', minimumPrimaryConversions: 40, requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'focus', 'source/UTM', 'roadmap model', 'destination', 'receiving strategy'], safeguards: outcomeSafeguards('Do not count page views, partial client state, email confirmation, or an unsaved AI response as a generated-and-saved roadmap.'),
      verifiedOutcomeRule: 'Count once when a valid next_move_questionnaires row contains a nonempty roadmap_json and the successful response returns that persisted questionnaire ID.', targetOutcomeObservable: true,
      observableCurrentOutcome: { available: true, evidence: 'next_move_questionnaires persists valid submissions and roadmap_json.', limitation: 'Questionnaire starts and post-roadmap action progress are not persisted, and canonical strategy-version attribution is absent.' },
      stopConditions: ['analysis-consent failure', 'roadmap generation failure', 'broken receiving path', 'unbounded claim', 'deletion or disengagement'],
    },
    sourceProvenance: sourceProvenance('next_move_questionnaires persistence and route consumer audit'),
  },

  credit_education_support: {
    strategyKey: 'credit_education_support', version: 1, versionStatus: 'draft', executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/credit-upload', cta: 'Review my credit report and build an action plan' }, externalSendCap: 0,
    activation: blockedActivation('Primary saved-plan outcome is not currently observable after credit analysis completion.', 'Credit-report handling and any dispute support require explicit authorization and strict educational claim boundaries.'),
    operatingContract: {
      objective: 'Help a customer understand an authorized credit report and organize bounded educational actions without guaranteeing deletion, score change, approval, or timing.',
      targetParticipant: 'Authenticated customers who voluntarily upload an authorized credit report and request education.',
      problem: 'Credit reports are difficult to interpret, and incomplete context can produce risky claims, unauthorized access, or inappropriate actions.',
      valueExchange: 'The customer supplies an authorized report and analysis permission in exchange for private organization, education, and a customer-controlled action plan.',
      offer: 'Secure upload, report analysis, issue organization, educational next actions, and operator review for edge cases.',
      eligibilityCriteria: ['Authenticated customer owns or is authorized to use the uploaded report.', 'Explicit analysis permission and source date are present.', 'The report can be processed securely and the requested support stays educational.'],
      disqualificationCriteria: ['Unauthorized report or identity conflict.', 'Request for guaranteed deletion, score improvement, funding, approval, legal outcome, or timeline.', 'A matter requiring licensed legal or other professional advice beyond the supported education boundary.'],
      prioritizationRules: ['Process securely received reports in timestamp order.', 'Escalate extraction ambiguity, identity concern, legal issue, or low-confidence analysis to needs_review.', 'Do not prioritize by score range or protected status.'],
      sourceData: ['credit_reports', 'creditRepairWorkflow status updates', 'customer-uploaded report', 'analysis_json', 'system events and review tasks'],
      sourceDataRequirements: [
        { source: 'credit_reports and creditRepairWorkflow', authority: 'Credit workflow service', requiredEvidence: ['user ID', 'authorized file', 'status', 'status timestamps', 'analysis result or failure reason'], freshnessRule: 'Treat the report as a dated snapshot and request a new authorized upload for later bureau changes.' },
        { source: 'customer action-plan selection and progress', authority: 'Target CRM events not yet implemented', requiredEvidence: ['selected action', 'saved timestamp', 'checkpoint', 'customer feedback'], freshnessRule: 'Use only customer-confirmed action and progress events.' },
      ],
      primaryChannels: ['website_notification', 'operator_task'], secondaryChannels: ['resend_email', 'no_outreach'],
      channelSelectionRules: ['Use secure website surfaces for report data and analysis.', 'Use transactional email for receipt/completion only; never include sensitive report detail.', 'Use an operator task for needs_review or an edge case.'],
      followupCadence: ['Immediate secure receipt confirmation.', 'Status notification when analysis completes or needs review.', 'Customer-selected educational checkpoints at days 7, 30, 60, and 90.'],
      cadenceSteps: [
        { timing: 'immediate', purpose: 'Confirm secure report receipt.', channels: ['website_notification', 'resend_email'], condition: 'The authorized upload was persisted.' },
        { timing: 'on completed, failed, or needs_review', purpose: 'Provide a bounded status next step.', channels: ['website_notification', 'operator_task', 'resend_email'], condition: 'No sensitive report content is placed in email.' },
        { timing: 'customer-selected days 7, 30, 60, and 90', purpose: 'Check educational action progress.', channels: ['website_notification', 'resend_email'], condition: 'Separate follow-up permission exists.' },
      ],
      nurtureRules: ['Nurture follows customer-selected educational actions only.', 'Do not market credit repair outcomes or convert transactional notices into marketing.'],
      reactivationRules: ['Reactivate after a new authorized report or explicit customer request.', 'Identity/data-access concern or deletion request prevents reactivation.'],
      crossLaneRoutes: [crossLane('capital_readiness_intake', 'The customer completes relevant readiness actions and requests a capital review.', 'Start a separate Capital case; do not share report data automatically.'), crossLane('next_move_free_roadmap', 'The customer needs broader sequencing beyond credit.', 'Offer a new roadmap without exposing report detail.')],
      humanApprovalPoints: ['Identity or report-authorization concern', 'Dispute/legal edge case', 'Low-confidence or contradictory analysis', 'Any score, deletion, funding, or timeline statement'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Dispute tools are customer-directed educational documents, not a promise of bureau, creditor, legal, or score outcomes.', 'Never ingest a report without customer authorization.'],
      learningInputs: ['workflow stage time', 'extraction failure', 'needs-review reason', 'confusing section', 'selected action', 'plan save', 'checkpoint', 'customer-reported progress'],
      failureConditions: ['Unauthorized access', 'Sensitive-data exposure', 'Extraction/analysis failure', 'Unsupported claim', 'Missing saved-plan event'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Stop on report ownership concern, deletion request, unsupported legal claim, or need for licensed advice.'],
      handoffRules: ['Credit support owns secure analysis and education.', 'Another strategy receives only the minimum permissioned readiness facts, never the report by default.'],
      integrationDependencies: [GATE_3C_DEPENDENCY, { integration: 'Credit report workflow', status: 'available', evidence: 'credit_reports and creditRepairWorkflow persist uploaded through completed/failed/needs_review.', requiredBeforeActivation: true }, { integration: 'Customer action-plan persistence', status: 'missing', evidence: 'No canonical saved plan/progress event proves the target conversion after analysis_ready.', requiredBeforeActivation: true }],
      activationReadiness: { status: 'blocked', readyElements: ['/credit-upload exists.', 'The credit workflow persists exact processing statuses.', 'Operator review tasks and transactional status notifications exist.'], blockers: ['Canonical strategy-version binding is absent.', 'Primary outcome is not currently observable as an analysis-ready report with a customer-saved action plan.', 'Customer action progress is not persisted.', 'External educational follow-up remains unapproved.'] },
      versionDecisionRule: decisionRule('Promote after two 60-day windows each include 25 analysis-ready credit reports and ten verified saved action plans without privacy, claim, or needs-review regression.', 'Revise extraction, explanation, or action design when attributable confusion or failure evidence is correctable.', 'Retire a claim, action path, or workflow after privacy/compliance failure or two complete windows without saved-plan progress.'),
    },
    lifecycleContract: {
      states: ['uploaded', 'extracting_text', 'text_extracted', 'analyzing', 'completed', 'failed', 'needs_review', 'customer_review', 'action_plan_saved', 'action_in_progress', 'checkpoint', 'education_completed', 'referred', 'paused'], initialState: 'uploaded', terminalStates: ['failed', 'needs_review', 'education_completed', 'referred', 'paused'],
      transitions: [
        { from: 'uploaded', to: 'extracting_text', event: 'extraction_started', persistence: 'current' }, { from: 'uploaded', to: 'failed', event: 'upload_or_queue_failed', persistence: 'current' }, { from: 'uploaded', to: 'needs_review', event: 'upload_requires_human_review', persistence: 'current' },
        { from: 'extracting_text', to: 'text_extracted', event: 'text_extraction_completed', persistence: 'current' }, { from: 'extracting_text', to: 'failed', event: 'text_extraction_failed', persistence: 'current' }, { from: 'extracting_text', to: 'needs_review', event: 'extraction_ambiguous', persistence: 'current' },
        { from: 'text_extracted', to: 'analyzing', event: 'analysis_started', persistence: 'current' }, { from: 'text_extracted', to: 'failed', event: 'analysis_start_failed', persistence: 'current' }, { from: 'text_extracted', to: 'needs_review', event: 'text_requires_review', persistence: 'current' },
        { from: 'analyzing', to: 'completed', event: 'analysis_completed', persistence: 'current' }, { from: 'analyzing', to: 'failed', event: 'analysis_failed', persistence: 'current' }, { from: 'analyzing', to: 'needs_review', event: 'analysis_requires_review', persistence: 'current' },
        { from: 'completed', to: 'customer_review', event: 'customer_opens_completed_analysis', persistence: 'target_only' },
        { from: 'customer_review', to: 'action_plan_saved', event: 'customer_saves_bounded_plan', persistence: 'target_only' }, { from: 'customer_review', to: 'referred', event: 'professional_review_recommended', persistence: 'target_only' }, { from: 'customer_review', to: 'paused', event: 'customer_pauses', persistence: 'target_only' },
        { from: 'action_plan_saved', to: 'action_in_progress', event: 'customer_starts_action', persistence: 'target_only' }, { from: 'action_plan_saved', to: 'education_completed', event: 'customer_completes_plan', persistence: 'target_only' }, { from: 'action_plan_saved', to: 'paused', event: 'customer_pauses', persistence: 'target_only' },
        { from: 'action_in_progress', to: 'checkpoint', event: 'checkpoint_due_or_reported', persistence: 'target_only' },
        { from: 'checkpoint', to: 'education_completed', event: 'customer_confirms_completion', persistence: 'target_only' }, { from: 'checkpoint', to: 'referred', event: 'qualified_professional_review_needed', persistence: 'target_only' }, { from: 'checkpoint', to: 'paused', event: 'customer_pauses', persistence: 'target_only' },
      ],
      cadence: ['Immediate receipt.', 'Workflow status notifications.', 'Optional customer-selected 7/30/60/90 checkpoints.'], stopConditions: ['failed', 'needs_review', 'education_completed', 'referred', 'paused', 'deletion_requested', 'authorization_conflict'],
      recordAuthority: 'credit_reports plus creditRepairWorkflow own uploaded, extracting_text, text_extracted, analyzing, completed, failed, and needs_review; later educational action states are not persisted.',
      persistedStates: ['uploaded', 'extracting_text', 'text_extracted', 'analyzing', 'completed', 'failed', 'needs_review'], persistedEvents: ['credit_report_uploaded system event', 'credit workflow status updates', 'analysis completed/failure/review tasks'],
      targetOnlyStages: ['customer_review', 'action_plan_saved', 'action_in_progress', 'checkpoint', 'education_completed', 'referred', 'paused'],
      stateNotes: lifecycleStateNotes(['uploaded', 'extracting_text', 'text_extracted', 'analyzing', 'completed', 'failed', 'needs_review'], ['customer_review', 'action_plan_saved', 'action_in_progress', 'checkpoint', 'education_completed', 'referred', 'paused'], 'credit_reports/creditRepairWorkflow; post-analysis customer action events are missing'),
    },
    ownerContract: { crmAuthority: 'vestblock_crm', automationRole: 'vestblock_application', dispatchAuthority: 'none_in_gate_3b', recordOwner: 'Credit workflow owns processing state; CRM must own future customer education/action events.', humanOwner: 'A VestBlock operator owns needs-review and regulated/legal edge cases.', handoffRules: ['Share only minimum permissioned readiness facts.', 'A receiving strategy accepts ownership and may not infer credit eligibility or outcome.'] },
    outcomeContract: {
      primaryConversionEvent: 'An analysis-ready authorized credit report produces a bounded action plan that the customer explicitly saves.', leadingIndicators: ['secure upload completion', 'analysis-ready reports', 'needs-review rate', 'customer analysis review', 'plan-save attempt'], businessValue: 'More informed customers and cleaner readiness paths without prohibited credit-repair claims.', learningInputs: ['strategy version', 'workflow status', 'failure/review reason', 'analysis version', 'selected action', 'save event', 'checkpoint', 'feedback'],
      learningWindowDays: 60, minimumExposure: 25, exposureUnit: 'analysis_ready_credit_reports', minimumPrimaryConversions: 10, requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'credit report', 'analysis version', 'action plan', 'operator review', 'customer event'], safeguards: outcomeSafeguards('Do not treat upload, extraction, completed analysis, generated letters, email delivery, or score movement as a saved educational plan.'),
      verifiedOutcomeRule: 'Count once when an authorized completed credit_reports record and a customer-authenticated action_plan_saved event share the report ID and strategy version.', targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'credit_reports proves processing through completed, but no customer-saved action-plan event is authoritative.', limitation: 'The target conversion requires Gate 3C action-plan persistence and canonical version binding.' },
      stopConditions: ['privacy or authorization failure', 'unsupported credit claim', 'high extraction/analysis failure', 'needs-review regression', 'deletion request'],
    },
    sourceProvenance: sourceProvenance('credit_reports and creditRepairWorkflow consumer audit'),
  },

  business_formation_readiness: {
    strategyKey: 'business_formation_readiness', version: 1, versionStatus: 'draft', executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/next-move?focus=start-business', cta: 'Build my business readiness roadmap' }, externalSendCap: 0,
    activation: blockedActivation('Primary completed-plan-with-milestone outcome is target-only and not currently observable.', 'The public /business-setup page is static and does not create business_roadmaps; current records originate from /tools/business-credit.'),
    operatingContract: {
      objective: 'Organize foundational entity, EIN, banking, recordkeeping, offer-validation, compliance, and operating steps before capital or growth pursuit.',
      targetParticipant: 'Founders and small-business owners preparing a coherent business foundation.',
      problem: 'Funding and growth efforts fail when identity, entity, banking, records, offers, and operating basics are inconsistent or incomplete.',
      valueExchange: 'The participant supplies business-stage facts in exchange for an educational preparation sequence and responsible next route.',
      offer: 'A guided start-business questionnaire, readiness plan, milestone checklist, and permissioned Capital handoff when ready.',
      eligibilityCriteria: ['The participant requests business readiness education.', 'Business stage, jurisdiction, identity/ownership basics, goals, and current foundation state are provided.', 'The participant understands that legal, tax, licensing, banking, and funding decisions are outside the guarantee boundary.'],
      disqualificationCriteria: ['Identity conflict or fabricated business facts.', 'A request for legal/tax suitability, guaranteed banking/funding, purchased tradelines, or an unsupported shortcut.', 'Jurisdiction-specific issue requiring qualified advice before proceeding.'],
      prioritizationRules: ['Prioritize identity/entity consistency, records, banking, and real operating activity before credit or funding tactics.', 'Order milestones by the participant state and jurisdictional uncertainty.', 'Do not prioritize based on promised funding or score outcomes.'],
      sourceData: ['next_move_questionnaires focus=start-business', 'business_roadmaps created by /tools/business-credit', 'user_tool_answers', 'future readiness milestone events'],
      sourceDataRequirements: [
        { source: 'next_move_questionnaires', authority: 'Next Move persistence service', requiredEvidence: ['start-business focus', 'business stage', 'goal', 'obstacle', 'analysis consent'], freshnessRule: 'Request a new snapshot after a material entity, ownership, jurisdiction, or operating change.' },
        { source: 'business_roadmaps and user_tool_answers', authority: '/tools/business-credit workflow, not /business-setup', requiredEvidence: ['authenticated user', 'answers', 'roadmap output', 'version', 'created time'], freshnessRule: 'Treat the roadmap as a dated educational artifact; it does not prove milestone completion.' },
        { source: 'readiness milestone events', authority: 'Target CRM authority not implemented', requiredEvidence: ['milestone ID', 'customer evidence', 'verified time', 'operator review when needed'], freshnessRule: 'Count only a customer- or operator-verified milestone.' },
      ],
      primaryChannels: ['website_notification'], secondaryChannels: ['resend_email', 'operator_task', 'no_outreach'],
      channelSelectionRules: ['Use the guided Next Move start-business route as entry.', 'Do not claim /business-setup persists progress.', 'Use email only for a requested plan or permitted checkpoint; operator tasks handle individualized questions.'],
      followupCadence: ['Immediate readiness plan after valid guided input.', 'Optional day 7 and day 30 milestone prompts.', 'Capital handoff only after defined readiness evidence and new consent.'],
      cadenceSteps: [
        { timing: 'immediate', purpose: 'Present the educational readiness plan.', channels: ['website_notification'], condition: 'A valid guided start-business input is available.' },
        { timing: 'days 7 and 30', purpose: 'Ask the participant to verify a selected milestone.', channels: ['website_notification', 'resend_email'], condition: 'Follow-up permission and a persisted milestone model exist.' },
      ],
      nurtureRules: ['Nurture one selected foundational milestone at a time.', 'Do not market funding until the Capital strategy independently accepts readiness.'],
      reactivationRules: ['Reactivate after a participant reports a material entity, banking, records, offer, or operating change.', 'Reassess jurisdictional and identity facts before reusing an old plan.'],
      crossLaneRoutes: [crossLane('capital_readiness_intake', 'A participant verifies the minimum foundational milestones and requests capital review.', 'Create a separate Capital case with current purpose and consent.'), crossLane('next_move_free_roadmap', 'The participant needs broader sequencing beyond business formation.', 'Return to a fresh roadmap snapshot.')],
      humanApprovalPoints: ['Jurisdiction-specific legal/tax/licensing question', 'Banking, tradeline, funding, or business-success claim', 'Milestone evidence that changes readiness', 'Capital handoff'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'No legal, tax, licensing, banking-approval, tradeline, funding, or business-success guarantee.'],
      learningInputs: ['foundation gap', 'abandonment', 'roadmap source', 'milestone selection', 'verified milestone', 'professional referral need', 'Capital handoff'],
      failureConditions: ['Static page mistaken for persistence', 'Missing milestone authority', 'Jurisdictional uncertainty', 'Unsupported shortcut', 'Identity/entity conflict'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Stop on jurisdictional/legal uncertainty, identity conflict, or a request for an unsupported shortcut.'],
      handoffRules: ['Business readiness owns educational foundation sequencing.', 'Capital accepts only a complete, permissioned handoff and requalifies the capital request.'],
      integrationDependencies: [GATE_3C_DEPENDENCY, { integration: 'Guided start-business route', status: 'available', evidence: '/next-move?focus=start-business can collect a guided entry snapshot.', requiredBeforeActivation: true }, { integration: 'Business roadmap persistence', status: 'partial', evidence: 'business_roadmaps are currently created by /tools/business-credit, not the static /business-setup page.', requiredBeforeActivation: true }, { integration: 'Readiness milestone lifecycle', status: 'missing', evidence: 'No persisted milestone completion authority exists.', requiredBeforeActivation: true }],
      activationReadiness: { status: 'blocked', readyElements: ['Guided start-business entry exists.', 'A separate business_roadmaps artifact store exists.', 'Capital can receive a future permissioned handoff.'], blockers: ['Canonical strategy-version binding is absent.', 'Guided entry and business_roadmaps are not one lifecycle.', 'Primary outcome is not currently observable as a completed plan with a verified milestone.', 'Milestone prompts and Capital handoff remain unapproved.'] },
      versionDecisionRule: decisionRule('Promote after two 60-day windows each include 40 attributable starts and 15 completed plans with at least one verified milestone, without advice or claim regression.', 'Revise a milestone sequence when attributable abandonment or verification evidence identifies a correctable readiness problem.', 'Retire a path after material legal/tax/funding claim failure or two complete windows without verified milestone progress.'),
    },
    lifecycleContract: {
      states: ['started', 'readiness_assessed', 'gaps_identified', 'action_plan', 'milestone_due', 'ready_for_capital', 'operating_ready', 'completed', 'paused'], initialState: 'started', terminalStates: ['ready_for_capital', 'operating_ready', 'completed', 'paused'],
      transitions: [
        { from: 'started', to: 'readiness_assessed', event: 'guided_assessment_completed', persistence: 'target_only' }, { from: 'started', to: 'paused', event: 'participant_pauses', persistence: 'target_only' },
        { from: 'readiness_assessed', to: 'gaps_identified', event: 'foundation_gaps_organized', persistence: 'target_only' }, { from: 'readiness_assessed', to: 'paused', event: 'assessment_requires_professional_review', persistence: 'target_only' },
        { from: 'gaps_identified', to: 'action_plan', event: 'readiness_plan_persisted', persistence: 'target_only' }, { from: 'gaps_identified', to: 'paused', event: 'participant_pauses', persistence: 'target_only' },
        { from: 'action_plan', to: 'milestone_due', event: 'milestone_selected', persistence: 'target_only' }, { from: 'action_plan', to: 'completed', event: 'plan_completed_without_cross_lane_route', persistence: 'target_only' },
        { from: 'milestone_due', to: 'ready_for_capital', event: 'capital_readiness_milestone_verified', persistence: 'target_only' }, { from: 'milestone_due', to: 'operating_ready', event: 'operating_foundation_verified', persistence: 'target_only' }, { from: 'milestone_due', to: 'completed', event: 'selected_milestone_verified', persistence: 'target_only' }, { from: 'milestone_due', to: 'paused', event: 'milestone_blocked', persistence: 'target_only' },
      ],
      cadence: ['Immediate educational plan.', 'Optional day 7 and day 30 milestone prompts.', 'No Capital outreach without accepted handoff.'], stopConditions: ['ready_for_capital', 'operating_ready', 'completed', 'paused', 'jurisdictional_uncertainty', 'identity_conflict'],
      recordAuthority: 'business_roadmaps stores generated artifacts from /tools/business-credit; /business-setup is static and no canonical milestone lifecycle exists.',
      persistedStates: [], persistedEvents: ['business_roadmaps row created', 'user_tool_answers row created or updated'], targetOnlyStages: ['started', 'readiness_assessed', 'gaps_identified', 'action_plan', 'milestone_due', 'ready_for_capital', 'operating_ready', 'completed', 'paused'],
      stateNotes: lifecycleStateNotes([], ['started', 'readiness_assessed', 'gaps_identified', 'action_plan', 'milestone_due', 'ready_for_capital', 'operating_ready', 'completed', 'paused'], 'business_roadmaps/user_tool_answers, which do not persist readiness lifecycle states'),
    },
    ownerContract: { crmAuthority: 'vestblock_crm', automationRole: 'vestblock_application', dispatchAuthority: 'none_in_gate_3b', recordOwner: 'Business-readiness service must own future assessment and milestone events; current business_roadmaps owns only artifacts.', humanOwner: 'A VestBlock operator owns individualized and jurisdiction-specific review.', handoffRules: ['Do not infer readiness from roadmap creation.', 'Capital accepts only a separately consented handoff with verified milestone evidence.'] },
    outcomeContract: {
      primaryConversionEvent: 'A participant completes a business readiness plan and verifies at least one substantive foundation milestone.', leadingIndicators: ['guided starts', 'assessment completion', 'gaps identified', 'plan creation', 'milestone selection'], businessValue: 'More coherent business foundations and better-qualified Capital transitions.', learningInputs: ['strategy version', 'business stage', 'jurisdiction', 'gap', 'plan source', 'milestone evidence', 'operator review', 'Capital acceptance'],
      learningWindowDays: 60, minimumExposure: 40, exposureUnit: 'business_readiness_starts', minimumPrimaryConversions: 15, requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'entry route', 'business stage', 'gap', 'milestone', 'receiving strategy'], safeguards: outcomeSafeguards('Do not count a static page visit, questionnaire recommendation, roadmap artifact, PDF creation, or email as a verified milestone.'),
      verifiedOutcomeRule: 'Count once when a canonical business-readiness plan and a customer- or operator-verified milestone event share the participant, plan version, and strategy version.', targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'business_roadmaps can prove an artifact was created through /tools/business-credit, but no milestone completion event exists and /business-setup is static.', limitation: 'The primary outcome remains target-only until Gate 3C unifies guided entry, plan, milestone, and strategy-version attribution.' },
      stopConditions: ['unsupported legal/tax/funding claim', 'identity conflict', 'jurisdictional uncertainty', 'missing milestone authority', 'broken Capital handoff'],
    },
    sourceProvenance: sourceProvenance('Next Move, /business-setup, /tools/business-credit, and business_roadmaps consumer audit'),
  },
  dealvault_activation: {
    strategyKey: 'dealvault_activation',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/dealvault/demo', cta: 'Request a private demo' },
    externalSendCap: 0,
    activation: blockedActivation(
      'The public demo request and authenticated product records are not joined into one attributable activation lifecycle.',
      'A verified first record cannot yet prove that an invited or otherwise authorized participant accepted access.'
    ),
    operatingContract: {
      objective: 'Turn a qualified DealVault demo request into permissioned use of a verified record layer for agreements, proofs, milestones, certificates, and payout references.',
      targetParticipant: 'Operators, buyers, lenders, partners, and teams that need controlled continuity across a transaction or other multi-party work.',
      problem: 'Important records, approvals, proofs, milestones, and payout references become unreliable when they are scattered across messages and disconnected files.',
      valueExchange: 'The participant provides a real coordination use case, accurate record data, and explicit access decisions in exchange for a private demonstration and a controlled record workspace.',
      offer: 'A private DealVault demonstration followed, when qualified, by an access-controlled path to create and coordinate verified records.',
      eligibilityCriteria: [
        'A demo request identifies a real participant, organization or team context, reachable contact, and plausible coordination use case.',
        'Authenticated product use is tied to permitted deal or opportunity data, role-based access, and an accepted diligence boundary.',
        'Records, proofs, participants, milestones, and payout references have attributable owners and source evidence.',
      ],
      disqualificationCriteria: [
        'Fabricated identity, unverifiable use case, prohibited content, or unresolved access conflict.',
        'A request to imply that a record proves legal enforceability, asset ownership, deal availability, performance, closing, or return beyond verified facts.',
        'Sensitive third-party information without authority to store, share, or invite access.',
      ],
      prioritizationRules: [
        'Prioritize complete qualified demo requests with a defined coordination problem and intended participants.',
        'Prioritize product onboarding steps that unblock a participant-owned first verified record before optional capabilities.',
        'Never treat a demo form submission, page view, sample record view, or account creation as product activation.',
      ],
      sourceData: [
        'leads with source=dealvault_demo_request',
        'real_estate_deals',
        'real_estate_deal_proofs',
        'real_estate_status_events',
        'real_estate_payout_splits',
        'dealvault_milestone_projects',
        'dealvault_milestone_items',
        'dealvault_audit_logs',
        'dealvault_usage_logs',
      ],
      sourceDataRequirements: [
        {
          source: 'DealVault demo-request lead',
          authority: 'leads record with source=dealvault_demo_request and submitted form_data',
          requiredEvidence: ['requester identity', 'contact point', 'organization or team context', 'use case', 'source path', 'submitted timestamp'],
          freshnessRule: 'Reconfirm the use case, contact permission, and intended participants before scheduling or opening product access.',
        },
        {
          source: 'Authenticated DealVault records',
          authority: 'DealVault application tables and append-only status/audit records',
          requiredEvidence: ['record owner', 'record type', 'source facts', 'access decision', 'proof or milestone metadata where applicable', 'created timestamp'],
          freshnessRule: 'Recheck access and record authority before every restricted view, participant invitation, proof attachment, milestone approval, or payout action.',
        },
      ],
      primaryChannels: ['website_notification', 'operator_task'],
      secondaryChannels: ['resend_email', 'outlook_graph', 'no_outreach'],
      channelSelectionRules: [
        'Use /dealvault/demo for the public request and the authenticated application for records and access decisions.',
        'Use email only for the requested demo or transactional product step after validating the address and purpose-specific permission.',
        'Use an operator task for qualification, restricted opportunity access, participant authorization, or sensitive-record review.',
      ],
      followupCadence: [
        'Immediate on-page acknowledgement of a valid demo request.',
        'Operator qualification review within one business day.',
        'If separately permitted, guidance at days 1, 3, 7, and 14 only for the next documented activation gap, then stop.',
      ],
      cadenceSteps: [
        { timing: 'immediate', purpose: 'Confirm receipt without implying activation.', channels: ['website_notification'], condition: 'A valid demo request was recorded.' },
        { timing: 'within one business day', purpose: 'Qualify the use case, access boundary, and next product step.', channels: ['operator_task'], condition: 'The request is complete, unsuppressed, and owned.' },
        { timing: 'days 1, 3, 7, and 14 after an approved onboarding start', purpose: 'Resolve one verified missing activation step.', channels: ['website_notification', 'resend_email', 'outlook_graph'], condition: 'The participant requested follow-up, the same gap remains, and no stop condition applies.' },
      ],
      nurtureRules: [
        'Nurture is limited to the participant-specific coordination use case and next incomplete activation step.',
        'Do not use generic deal claims, sample-record engagement, or page views to infer demand or permission.',
      ],
      reactivationRules: [
        'Reactivation requires a participant request, a new permitted use case, or a verified change in record/collaboration need.',
        'Recheck record ownership, participant access, suppression, and product health before reopening guidance.',
      ],
      crossLaneRoutes: [
        crossLane('capital_readiness_intake', 'A participant-owned record reveals a separately requested capital-readiness need.', 'Offer a permissioned Capital intake without sharing DealVault records automatically.'),
        crossLane('service_provider_network', 'A milestone or record owner requests an appropriate service-provider introduction.', 'Create an operator-reviewed service request containing only approved facts.'),
        crossLane('customer_lifecycle_orchestration', 'A documented activation step becomes stale without authorizing a message.', 'Propose an internal lifecycle task that DealVault must accept before any communication.'),
      ],
      humanApprovalPoints: ['Demo qualification', 'Restricted opportunity access', 'Third-party participant invitation', 'Sensitive documents or proofs', 'Financial, return, compensation, or legal-enforceability language'],
      complianceLimits: [
        ...UNIVERSAL_COMPLIANCE_LIMITS,
        'A DealVault record documents submitted evidence and activity; it does not itself establish legal enforceability, ownership, availability, performance, closing, or return.',
        'Store and expose only the minimum information authorized for each participant and purpose.',
      ],
      learningInputs: ['request source', 'use case', 'qualification result', 'setup friction', 'first-record type', 'access decision', 'invite acceptance', 'proof or milestone usage', 'retention', 'churn reason'],
      failureConditions: ['Broken access control', 'Unowned or sensitive record', 'Demo-to-account attribution gap', 'Unauthorized participant access', 'Misleading proof or outcome representation', 'Product health failure'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Stop onboarding after activation, explicit no-interest, access conflict, sensitive-record concern, or the documented dormant threshold pending operator review.'],
      handoffRules: [
        'The demo-request lead records interest only; it does not own authenticated product state or prove activation.',
        'The DealVault application owns records; an operator owns qualification and restricted access; a receiving lane must accept any cross-lane request.',
      ],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'DealVault application records', status: 'available', evidence: 'Deal, proof, status-event, payout, milestone, audit, and usage records exist.', requiredBeforeActivation: true },
        { integration: 'Demo-to-product activation attribution', status: 'missing', evidence: 'The public demo request is a lead and is not joined to account, first-record, authorized-participant, and retention events.', requiredBeforeActivation: true },
        { integration: 'Authorized participant acceptance', status: 'partial', evidence: 'Deal and payout records can name participants, but one governed invited-and-authorized collaboration acceptance is not established.', requiredBeforeActivation: true },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['The private demo destination exists.', 'Authenticated DealVault records and audit evidence exist.', 'Public demo interest can be recorded.'],
        blockers: ['Canonical strategy-version binding is absent.', 'Demo requests do not join to product activation.', 'Authorized-participant acceptance is not a governed outcome.', 'External onboarding sends are unapproved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 45-day windows each contain ten qualified demo requests and three pilot accounts with a first verified record plus an authorized participant, without access or claim regression.',
        'Revise one attributable demo or onboarding step when verified setup friction can be corrected without weakening access controls.',
        'Retire a path after material access failure, misleading record claims, or two complete reviewed windows without qualified activation.'
      ),
    },
    lifecycleContract: {
      states: ['visitor', 'demo_requested', 'demo_completed', 'account_created', 'first_record', 'first_collaboration', 'activated', 'retained', 'dormant', 'closed'],
      initialState: 'visitor',
      terminalStates: ['retained', 'dormant', 'closed'],
      transitions: [
        { from: 'visitor', to: 'demo_requested', event: 'qualified_demo_request_recorded', persistence: 'target_only' },
        { from: 'demo_requested', to: 'demo_completed', event: 'operator_records_demo_completion', persistence: 'target_only' },
        { from: 'demo_completed', to: 'account_created', event: 'authenticated_account_linked', persistence: 'target_only' },
        { from: 'account_created', to: 'first_record', event: 'first_verified_record_created', persistence: 'target_only' },
        { from: 'first_record', to: 'first_collaboration', event: 'authorized_participant_accepts_access', persistence: 'target_only' },
        { from: 'first_collaboration', to: 'activated', event: 'activation_requirements_verified', persistence: 'target_only' },
        { from: 'activated', to: 'retained', event: 'qualified_use_persists_thirty_days', persistence: 'target_only' },
        { from: 'account_created', to: 'dormant', event: 'activation_window_expires', persistence: 'target_only' },
        { from: 'activated', to: 'dormant', event: 'retention_window_expires', persistence: 'target_only' },
        { from: 'demo_requested', to: 'closed', event: 'request_closed', persistence: 'target_only' },
      ],
      cadence: ['Immediate request acknowledgement.', 'One-business-day qualification target.', 'Permitted gap-specific guidance at days 1, 3, 7, and 14, then stop.'],
      stopConditions: ['retained', 'closed', 'no_interest', 'access_conflict', 'sensitive_record_issue', 'permission_revoked', 'product_health_failure'],
      recordAuthority: 'Demo interest is stored as a lead; DealVault tables store product records, but no single record currently persists this commercial activation lifecycle.',
      persistedStates: [],
      persistedEvents: ['leads source=dealvault_demo_request', 'real_estate_deals and real_estate_status_events', 'DealVault proof, payout, milestone, audit, and usage rows'],
      targetOnlyStages: ['visitor', 'demo_requested', 'demo_completed', 'account_created', 'first_record', 'first_collaboration', 'activated', 'retained', 'dormant', 'closed'],
      stateNotes: lifecycleStateNotes([], ['visitor', 'demo_requested', 'demo_completed', 'account_created', 'first_record', 'first_collaboration', 'activated', 'retained', 'dormant', 'closed'], 'the currently fragmented demo-lead and DealVault product records'),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'The CRM owns demo interest; the DealVault application owns authenticated records and audit facts.',
      humanOwner: 'A VestBlock operator owns qualification, restricted access, participant authorization, and sensitive-record review.',
      handoffRules: ['A demo request is not an activated account.', 'No cross-lane strategy receives record data without purpose-specific permission and explicit acceptance.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'A pilot account creates its first verified DealVault record and an invited or otherwise authorized participant accepts access.',
      leadingIndicators: ['qualified demo request', 'demo completion', 'account linkage', 'time to first record', 'participant invitation', 'proof or milestone use', 'thirty-day use'],
      businessValue: 'Product adoption, retention, and controlled transaction or multi-party coordination.',
      learningInputs: ['strategy version', 'request source', 'use case', 'qualification decision', 'activation gap', 'record type', 'participant acceptance', 'retention', 'verified downstream outcome'],
      learningWindowDays: 45,
      minimumExposure: 10,
      exposureUnit: 'qualified_demo_requests',
      minimumPrimaryConversions: 3,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'request source', 'use case', 'operator', 'account', 'record type', 'authorized participant'],
      safeguards: outcomeSafeguards('Measure demo request, demo completion, account creation, first record, participant acceptance, activation, and retention as separate events.'),
      verifiedOutcomeRule: 'Count once when a qualified demo request is linked to an authenticated pilot account, its first verified record, and an authorized participant acceptance event.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: {
        available: false,
        evidence: 'Demo-request leads and authenticated DealVault records exist as separate authorities.',
        limitation: 'No current attribution joins the request, pilot account, first verified record, and authorized participant acceptance.',
      },
      stopConditions: ['access-control failure', 'misleading record claim', 'sensitive data without authority', 'product health failure', 'no qualified activation after two windows'],
    },
    sourceProvenance: sourceProvenance('DealVault demo-request, authenticated application, and record-authority audit'),
  },

  service_provider_network: {
    strategyKey: 'service_provider_network',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/workspace/profiles/new?role=service_provider', cta: 'Create your service provider profile' },
    externalSendCap: 0,
    activation: blockedActivation(
      'Service-provider-specific capacity, credential, bilateral-introduction, quality, and outcome events are not yet persisted end to end.',
      'Every provider introduction and any compensation relationship requires operator approval and customer permission.'
    ),
    operatingContract: {
      objective: 'Maintain current service-provider capabilities and route a qualified customer need to an operator-reviewed, permissioned introduction.',
      targetParticipant: 'Contractors, builders, developers, agents, wholesalers, and transaction or service specialists with verifiable capabilities.',
      problem: 'Customers and operators lose time when provider identity, service area, credentials, capacity, conflicts, and quality evidence are stale or incomplete.',
      valueExchange: 'A provider supplies accurate capability, capacity, credential, and permission data in exchange for consideration for relevant, reviewed introductions.',
      offer: 'A private service-provider profile with governed criteria refresh and operator-reviewed introductions; VestBlock does not guarantee work, leads, or endorsement.',
      eligibilityCriteria: ['An active participant profile exists for the approved provider role.', 'Identity, service area, capabilities, capacity, and current verification are complete.', 'Credentials, insurance, references, conflicts, and matching/communication permissions are present where relevant.'],
      disqualificationCriteria: ['Identity or ownership conflict.', 'Required credential, insurance, capacity, or service evidence is missing or expired.', 'Unresolved complaint, prohibited service, undisclosed conflict, permission withdrawal, or requested guarantee of work.'],
      prioritizationRules: ['Prioritize verified fit, current capacity, required credentials, response reliability, and customer-approved need.', 'Give no ranking credit for paid status or referral economics unless clearly disclosed and independently appropriate.', 'Never represent a profile as endorsement or guarantee.'],
      sourceData: ['participant_profiles', 'participant_matches', 'provider-submitted credentials and capacity', 'operator quality review', 'customer feedback'],
      sourceDataRequirements: [
        { source: 'Participant profile', authority: 'Shared participant-profile service', requiredEvidence: ['role', 'identity/entity', 'service areas', 'capabilities', 'capacity', 'matching consent', 'verification timestamp'], freshnessRule: 'Refresh capacity every 30 days and role-specific credentials within their governing expiration or 90 days, whichever is sooner.' },
        { source: 'Provider quality and introduction evidence', authority: 'Future service-provider match and outcome record', requiredEvidence: ['customer need', 'operator fit decision', 'bilateral acceptance', 'completion evidence', 'complaint or dispute state'], freshnessRule: 'Recheck fit, capacity, conflicts, and permission immediately before every introduction.' },
      ],
      primaryChannels: ['website_notification', 'operator_task'],
      secondaryChannels: ['resend_email', 'outlook_graph', 'manual_phone_task', 'no_outreach'],
      channelSelectionRules: ['The shared activation strategy owns profile completion; this strategy may communicate only after an active-profile handoff.', 'Use a website notification for a reviewed match; use another channel only with channel-specific permission.', 'Every first introduction remains operator-approved; a provider profile never triggers autonomous outreach.'],
      followupCadence: ['Capacity and high-volatility criteria review every 30 days.', 'Credential and broader profile review no later than 90 days or governing expiry.', 'A reviewed introduction receives only the customer-approved, channel-permitted follow-up and stops on either party response.'],
      cadenceSteps: [
        { timing: 'every 30 days while active', purpose: 'Reconfirm availability, service area, and capacity.', channels: ['website_notification'], condition: 'The profile is active and separately permitted for profile notifications.' },
        { timing: 'before credential expiry or at 90 days', purpose: 'Request current role-relevant evidence.', channels: ['website_notification', 'resend_email'], condition: 'A required credential or verification is approaching its freshness limit.' },
        { timing: 'after operator-approved bilateral fit review', purpose: 'Present a permissioned introduction to both parties.', channels: ['operator_task', 'website_notification', 'resend_email', 'outlook_graph', 'manual_phone_task'], condition: 'The operator approved the fit, each recipient permitted the selected channel, and compensation/conflicts are disclosed.' },
      ],
      nurtureRules: ['Nurture only current profile, capacity, credential, or accepted-match gaps.', 'Do not promise opportunities, lead volume, revenue, preferred status, or customer endorsement.'],
      reactivationRules: ['A paused profile may reactivate only after the provider corrects the documented capacity, credential, quality, complaint, or permission issue.', 'An operator must review unresolved complaints and quality concerns before any new introduction.'],
      crossLaneRoutes: [
        crossLane('professional_participant_activation', 'The provider profile is incomplete, unverified, or no longer active.', 'Return ownership to the shared activation service without preserving a pending match.'),
        crossLane('dealvault_activation', 'Both parties accept a project requiring controlled milestone, proof, or payout records.', 'Offer a permissioned DealVault review with no automatic record sharing.'),
        crossLane('partner_referral_network', 'The relationship requires governed recurring referral terms rather than a single service introduction.', 'Propose a partner review only after a partner destination and terms authority exist.'),
      ],
      humanApprovalPoints: ['Role and identity verification', 'License/insurance representation', 'Every first introduction', 'Compensation/referral disclosure', 'Complaint and quality review'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Do not represent a provider as licensed, insured, endorsed, available, or suitable without current evidence and context.', 'Disclose any referral or compensation relationship and obtain customer permission before introduction.'],
      learningInputs: ['provider role', 'service need', 'geography', 'capacity', 'credential freshness', 'fit decision', 'response time', 'bilateral acceptance', 'completion', 'quality', 'complaint', 'repeat demand'],
      failureConditions: ['Expired required evidence', 'Capacity mismatch', 'Unresolved complaint or dispute', 'Repeated nonresponse', 'Poor verified quality', 'Undisclosed conflict or compensation'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Pause immediately on credential expiry, unresolved complaint, capacity failure, permission withdrawal, or repeated verified poor quality.'],
      handoffRules: ['Professional participant activation owns every pre-active state and completion reminder.', 'Service provider network owns only accepted active profiles, current capacity/credential review, and operator-approved service introductions.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'Shared participant-profile service', status: 'available', evidence: 'Role-aware participant profile and permission fields exist.', requiredBeforeActivation: true },
        { integration: 'Service-provider capacity and credential lifecycle', status: 'missing', evidence: 'No canonical role-specific freshness and credential event stream persists this lifecycle.', requiredBeforeActivation: true },
        { integration: 'Bilateral service introduction and quality outcome', status: 'missing', evidence: 'No governed record currently proves operator review, acceptance by both parties, completion, quality, and complaint resolution.', requiredBeforeActivation: true },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['A role-aware public profile route exists.', 'Shared profile permissions and verification foundations exist.', 'This contract separates activation from post-active matching.'],
        blockers: ['Canonical strategy-version binding is absent.', 'Service-specific capacity and credential state is not persisted.', 'Bilateral introduction acceptance and quality outcomes are not attributable.', 'External sends are unapproved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 60-day windows each contain 15 operator-reviewed service matches and five bilaterally accepted introductions, with no credential, quality, or complaint regression.',
        'Revise a provider segment, evidence requirement, or match rule when attributable fit or completion friction is correctable.',
        'Retire a segment after material credential or disclosure failure, repeated verified poor quality, or two reviewed windows without accepted introductions.'
      ),
    },
    lifecycleContract: {
      states: ['active_profile', 'capacity_current', 'match_review', 'introduction_accepted', 'declined', 'quality_review', 'retained', 'paused', 'removed'],
      initialState: 'active_profile',
      terminalStates: ['declined', 'retained', 'removed'],
      transitions: [
        { from: 'active_profile', to: 'capacity_current', event: 'provider_capacity_and_evidence_verified', persistence: 'target_only' },
        { from: 'capacity_current', to: 'match_review', event: 'operator_reviews_customer_need_fit', persistence: 'target_only' },
        { from: 'match_review', to: 'introduction_accepted', event: 'both_parties_accept_introduction', persistence: 'target_only' },
        { from: 'match_review', to: 'declined', event: 'either_party_declines_match', persistence: 'target_only' },
        { from: 'introduction_accepted', to: 'quality_review', event: 'service_outcome_ready_for_review', persistence: 'target_only' },
        { from: 'quality_review', to: 'retained', event: 'operator_confirms_acceptable_outcome', persistence: 'target_only' },
        { from: 'active_profile', to: 'paused', event: 'capacity_credential_permission_or_quality_pause', persistence: 'target_only' },
        { from: 'paused', to: 'active_profile', event: 'operator_approves_reactivation', persistence: 'target_only' },
        { from: 'quality_review', to: 'removed', event: 'operator_confirms_removal_condition', persistence: 'target_only' },
      ],
      cadence: ['Capacity review every 30 days.', 'Credential/profile review by expiry or 90 days.', 'Match-specific follow-up stops on either party response.'],
      stopConditions: ['paused', 'removed', 'credential_expired', 'unresolved_complaint', 'capacity_failure', 'permission_withdrawn'],
      recordAuthority: 'Shared participant profiles and matches hold partial facts; no service-provider-specific lifecycle authority currently persists these stages.',
      persistedStates: [],
      persistedEvents: ['participant profile status and operator verification facts', 'participant match records where present'],
      targetOnlyStages: ['active_profile', 'capacity_current', 'match_review', 'introduction_accepted', 'declined', 'quality_review', 'retained', 'paused', 'removed'],
      stateNotes: lifecycleStateNotes([], ['active_profile', 'capacity_current', 'match_review', 'introduction_accepted', 'declined', 'quality_review', 'retained', 'paused', 'removed'], 'the shared participant-profile and match records'),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'The shared profile service owns identity and permissions; a future service match authority must own role-specific lifecycle and outcomes.',
      humanOwner: 'A VestBlock operator owns verification, every introduction, quality review, complaint handling, and compensation disclosure.',
      handoffRules: ['Accept only an active profile handed off by professional participant activation.', 'No other lane may send on behalf of this strategy or bypass bilateral introduction review.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'An operator-approved service introduction is accepted by both the customer and the service provider.',
      leadingIndicators: ['active verified provider', 'capacity freshness', 'credential freshness', 'reviewed match', 'provider response', 'customer response', 'service completion', 'quality review'],
      businessValue: 'Appropriate service coordination, improved customer outcomes, and lawfully structured partner value where disclosed.',
      learningInputs: ['strategy version', 'provider role', 'service need', 'market', 'match rule', 'operator decision', 'bilateral response', 'completion', 'quality', 'complaint'],
      learningWindowDays: 60,
      minimumExposure: 15,
      exposureUnit: 'operator_reviewed_service_matches',
      minimumPrimaryConversions: 5,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'provider profile', 'customer need', 'market', 'operator', 'match', 'verified outcome'],
      safeguards: outcomeSafeguards('Do not count profile activation, a one-sided response, notification delivery, or an operator suggestion as bilateral acceptance.'),
      verifiedOutcomeRule: 'Count once only when the governed introduction record contains operator approval and explicit acceptance events from both identified parties.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'Shared profiles and matches provide partial identity and fit evidence.', limitation: 'No service-specific event currently proves operator approval and bilateral acceptance.' },
      stopConditions: ['credential or identity failure', 'undisclosed compensation', 'unresolved complaint', 'quality regression', 'no accepted introduction after two windows'],
    },
    sourceProvenance: sourceProvenance('participant-profile, match, service-provider route, and quality-loop audit'),
  },

  partner_referral_network: {
    strategyKey: 'partner_referral_network',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'inactive',
    destination: { mode: 'unresolved', path: null, cta: null },
    externalSendCap: 0,
    activation: blockedActivation(
      'No governed partner-profile destination, canonical partner record, test-referral record, or quality/economics outcome model exists.',
      'The legacy affiliate registration path is not an approved substitute and must not be promoted.',
      'Referral terms, compensation, disclosures, tax handling, regulated-service boundaries, and customer permission require human review.'
    ),
    operatingContract: {
      objective: 'Establish transparent, permissioned partner relationships and evaluate service quality through disclosed, operator-approved test referrals.',
      targetParticipant: 'Verified organizations and professionals with complementary capabilities and a documented customer or ecosystem fit.',
      problem: 'Scattered links and legacy affiliate mechanics can create duplicate ownership, undisclosed economics, unclear customer consent, and unmeasured quality.',
      valueExchange: 'A prospective partner provides verifiable capabilities, service evidence, conflicts, terms, and permissions in exchange for a governed test-referral review.',
      offer: 'A future governed partner application and operator-approved test-referral path; no public application or live referral promise exists in Gate 3B.',
      eligibilityCriteria: ['Organization and accountable contact can be verified.', 'Capabilities, geography, service fit, customer evidence, conflicts, terms, and contact permissions are documented.', 'Compensation, tax, disclosure, regulated-service, customer-consent, and attribution requirements can be reviewed before a referral.'],
      disqualificationCriteria: ['Unverifiable identity or capability.', 'Undisclosed compensation, conflict, regulatory uncertainty, poor or unsupported service evidence, attribution dispute, or prohibited service.', 'A request for guaranteed referrals, volume, revenue, preferred status, or concealment from the customer.'],
      prioritizationRules: ['No partner is prioritized for outreach until the destination and partner record are approved.', 'Future review prioritizes verified customer fit, quality, disclosure completeness, capacity, and accountable ownership.', 'Economics never override customer fit, consent, compliance, or quality evidence.'],
      sourceData: ['future governed partner profiles', 'future partner terms and disclosure records', 'future test-referral and quality outcomes', 'operator-supplied prospective partner evidence'],
      sourceDataRequirements: [
        { source: 'Prospective partner evidence', authority: 'Future governed partner profile with operator attestation', requiredEvidence: ['legal identity', 'accountable contact', 'capabilities', 'geography', 'service evidence', 'conflicts', 'permissions'], freshnessRule: 'Reverify identity, capacity, terms, disclosures, conflicts, and permissions before invitation and each test referral.' },
        { source: 'Test-referral evidence', authority: 'Future partner referral and quality ledger', requiredEvidence: ['customer permission', 'fit decision', 'disclosures', 'terms version', 'bilateral acceptance', 'completion', 'quality', 'attributed economics'], freshnessRule: 'Bind each referral to the terms and permissions current at the time of operator approval.' },
      ],
      primaryChannels: ['operator_task', 'no_outreach'],
      secondaryChannels: ['no_outreach'],
      channelSelectionRules: ['No public destination or external channel is approved.', 'The strategy may only create an internal operator research/review task in Gate 3B.', 'Do not route prospects to the legacy affiliate registration path.'],
      followupCadence: ['No external cadence while the destination and partner authority are unresolved.', 'Future approved human-first contact may use relevant follow-up at days 7 and 21, subject to a separate activation review.'],
      cadenceSteps: [
        { timing: 'Gate 3B only', purpose: 'Record missing partner evidence and destination requirements.', channels: ['operator_task', 'no_outreach'], condition: 'An operator identifies a plausible partner without authorizing contact.' },
      ],
      nurtureRules: ['No external nurture is authorized.', 'A future sequence must reference a verified capability fit and disclosed relationship purpose, never generic partnership language.'],
      reactivationRules: ['There is no inactive external sequence to reactivate.', 'A future paused partner requires corrected terms, quality, complaint, conflict, or permission evidence and operator approval.'],
      crossLaneRoutes: [
        crossLane('service_provider_network', 'A single customer service need does not require recurring partner terms.', 'Route to the service-provider profile and bilateral introduction review after that strategy accepts.'),
        crossLane('professional_participant_activation', 'The prospective partner is better represented as one approved participant role.', 'Offer the role-specific profile path only after operator review.'),
        crossLane('dealvault_activation', 'An approved referral requires controlled proof, milestone, or payout records.', 'Offer DealVault only after the referral and record-access parties accept.'),
      ],
      humanApprovalPoints: ['Public partner destination', 'First contact', 'Verification and terms', 'Commission/referral/affiliate compensation', 'Customer disclosure and permission', 'Every test referral', 'Quality or complaint decision'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Do not conceal a referral, affiliate, commission, or other economic relationship.', 'Do not use the legacy affiliate path as evidence of current approval or terms.'],
      learningInputs: ['partner type', 'capability fit', 'terms', 'disclosure', 'test-referral acceptance', 'completion', 'quality', 'complaint', 'attributed economics', 'repeat fit'],
      failureConditions: ['Missing destination or authority', 'Undisclosed economics', 'Customer-consent failure', 'Regulatory uncertainty', 'Poor service', 'Complaint', 'Attribution dispute'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Pause or end on undisclosed compensation, conflict, poor verified service, complaint, regulatory uncertainty, nonperformance, or attribution dispute.'],
      handoffRules: ['This strategy owns no customer or provider record until a governed partner authority exists.', 'A receiving service, participant, or DealVault strategy must accept the handoff and its own permission boundary.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'Governed partner profile and destination', status: 'missing', evidence: 'No approved partner-profile route or canonical partner authority exists.', requiredBeforeActivation: true },
        { integration: 'Referral terms, disclosure, and tax controls', status: 'missing', evidence: 'No version-bound contract records partner economics, required disclosures, and tax/payment requirements.', requiredBeforeActivation: true },
        { integration: 'Test-referral and quality ledger', status: 'missing', evidence: 'No governed record proves customer permission, acceptance, completion, quality, complaint, and attributable value.', requiredBeforeActivation: true },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['The founder-approved strategy objective and unresolved destination are explicit.', 'The legacy affiliate path is excluded.', 'The contract requires disclosed economics and customer permission.'],
        blockers: ['No governed public destination exists.', 'No canonical partner or referral authority exists.', 'Terms, disclosure, quality, and attributed-value controls are missing.', 'The parent strategy remains externally inactive.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 90-day windows each include ten operator-approved test-referral offers and five accepted referrals with complete disclosures and no quality or complaint regression.',
        'Revise one partner segment or term when attributable fit, response, disclosure, or quality evidence identifies a correctable problem.',
        'Retire a relationship after material disclosure or regulatory failure, unresolved complaint, poor verified service, or two reviewed windows without accepted referrals.'
      ),
    },
    lifecycleContract: {
      states: ['identified', 'invited', 'application', 'verification', 'terms_review', 'approved_test', 'test_referral', 'quality_review', 'active', 'paused', 'ended'],
      initialState: 'identified',
      terminalStates: ['active', 'paused', 'ended'],
      transitions: [
        { from: 'identified', to: 'invited', event: 'operator_approves_partner_invitation', persistence: 'target_only' },
        { from: 'invited', to: 'application', event: 'partner_submits_governed_application', persistence: 'target_only' },
        { from: 'application', to: 'verification', event: 'verification_review_started', persistence: 'target_only' },
        { from: 'verification', to: 'terms_review', event: 'identity_and_capability_verified', persistence: 'target_only' },
        { from: 'terms_review', to: 'approved_test', event: 'terms_disclosures_and_test_approved', persistence: 'target_only' },
        { from: 'approved_test', to: 'test_referral', event: 'customer_permitted_test_referral', persistence: 'target_only' },
        { from: 'test_referral', to: 'quality_review', event: 'referral_outcome_ready_for_review', persistence: 'target_only' },
        { from: 'quality_review', to: 'active', event: 'operator_approves_active_relationship', persistence: 'target_only' },
        { from: 'approved_test', to: 'paused', event: 'terms_capacity_or_permission_pause', persistence: 'target_only' },
        { from: 'quality_review', to: 'ended', event: 'operator_ends_relationship', persistence: 'target_only' },
      ],
      cadence: ['No Gate 3B external cadence.', 'Future approved human-first contact with permitted days 7 and 21 follow-up.'],
      stopConditions: ['paused', 'ended', 'terms_unapproved', 'disclosure_failure', 'regulatory_uncertainty', 'complaint', 'permission_withdrawn'],
      recordAuthority: 'No canonical partner profile, terms, referral, or quality record currently owns this lifecycle.',
      persistedStates: [],
      persistedEvents: [],
      targetOnlyStages: ['identified', 'invited', 'application', 'verification', 'terms_review', 'approved_test', 'test_referral', 'quality_review', 'active', 'paused', 'ended'],
      stateNotes: lifecycleStateNotes([], ['identified', 'invited', 'application', 'verification', 'terms_review', 'approved_test', 'test_referral', 'quality_review', 'active', 'paused', 'ended'], 'the missing canonical partner authority'),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'operator_manual',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'No canonical partner authority exists; the future CRM partner record must own the relationship and referral ledger.',
      humanOwner: 'A VestBlock operator, with legal/business review where needed, owns verification, terms, disclosure, every test referral, quality, and complaint decisions.',
      handoffRules: ['Do not use a legacy affiliate application as a partner record.', 'No receiving strategy accepts a partner handoff without current disclosures, customer permission, and attributable ownership.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'An operator-approved test referral with complete disclosures and permissions is accepted by the intended recipient.',
      leadingIndicators: ['verified partner application', 'terms approval', 'disclosure completeness', 'approved test offer', 'recipient acceptance', 'completion', 'customer quality', 'repeat fit'],
      businessValue: 'Broader verified capabilities and attributable referral value where lawfully and transparently structured.',
      learningInputs: ['strategy version', 'partner segment', 'capability fit', 'terms version', 'disclosure', 'operator decision', 'recipient acceptance', 'quality', 'complaint', 'attributed value'],
      learningWindowDays: 90,
      minimumExposure: 10,
      exposureUnit: 'approved_test_referral_offers',
      minimumPrimaryConversions: 5,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'partner', 'customer', 'service/referral type', 'terms version', 'operator', 'verified outcome'],
      safeguards: outcomeSafeguards('Do not count identification, invitation, application, terms review, or an unaccepted referral as conversion.'),
      verifiedOutcomeRule: 'Count once only when a governed referral record proves operator approval, current disclosures, customer permission, and recipient acceptance.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'Scattered referral and legacy affiliate references exist.', limitation: 'No canonical partner, terms, test-referral, acceptance, quality, or attributable-value ledger exists.' },
      stopConditions: ['disclosure or regulatory failure', 'customer-permission failure', 'complaint or quality regression', 'attribution dispute', 'no accepted referral after two windows'],
    },
    sourceProvenance: sourceProvenance('partner, affiliate, referral, route, and outcome-authority audit'),
  },

  investor_capital_relationships: {
    strategyKey: 'investor_capital_relationships',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: { mode: 'public_route', path: '/workspace/profiles/new?role=investor', cta: 'Create your real estate investor profile' },
    externalSendCap: 0,
    activation: blockedActivation(
      'The current investor route captures a real-estate acquisition profile only; it does not support the broader cross-sector capital-relationship identity previously described.',
      'No governed investor-relationship review, opportunity review, bilateral introduction, diligence, or verified-value lifecycle is currently persisted.',
      'Historical investor automation ran without a real sourced participant-profile contract and is not an approved source or executor.',
      'Investment, securities, return, suitability, offering, compensation, and opportunity language requires operator review.'
    ),
    operatingContract: {
      objective: 'Capture a current real-estate investor thesis through the existing investor profile and hold any relationship or opportunity introduction for controlled operator review without autonomous investment recommendations or opportunity blasts.',
      targetParticipant: 'Verified real-estate investors and acquisition sponsors using the current investor role; broader cross-sector capital participants are outside the supported profile contract.',
      problem: 'Real-estate investor relationships fail when identity, acquisition thesis, target markets, property criteria, capacity, permissions, and opportunity fit are stale, overstated, or confused with an active buyer buy box.',
      valueExchange: 'A participant supplies current real-estate acquisition criteria, capacity evidence, and permissions in exchange for an organized profile that may later support qualified, controlled introductions.',
      offer: 'A free real-estate investor profile; any future operator-reviewed relationship introduction remains target-only, while active property sourcing belongs to the buyer strategy.',
      eligibilityCriteria: ['An active participant profile exists for role=investor with verified identity or entity.', 'Target markets, property types, acquisition strategy, budget or capacity path, and current verification are documented within the current real-estate profile.', 'Matching and channel permissions are explicit; any securities, offering, suitability, or compensation boundary is identified for operator review.'],
      disqualificationCriteria: ['Identity, entity, capacity, proof, permission, or ownership conflict.', 'A request for unreviewed solicitation, return guarantee, suitability determination, concealed compensation, or unsupported opportunity availability.', 'Stale criteria, regulatory concern, withdrawn permission, or a property-only buy box that belongs in buyer activation.'],
      prioritizationRules: ['Prioritize verified current real-estate thesis, fit, capacity, permission, and operator-reviewed relationship value.', 'Route an active property-acquisition buy box to buyer activation instead of duplicating its sourcing contract here.', 'Do not score or rank by promised returns, unsupported wealth inference, or historical automation volume.'],
      sourceData: ['participant_profiles', 'participant_matches', 'participant-submitted real estate investor criteria', 'operator-reviewed opportunity evidence', 'historical investor automation runs as non-authoritative diagnostics only'],
      sourceDataRequirements: [
        { source: 'Real-estate investor participant profile', authority: 'Shared participant-profile service', requiredEvidence: ['verified role/entity', 'target markets', 'property types', 'acquisition strategy', 'budget or capacity path', 'matching permission', 'channel preference', 'verification timestamp'], freshnessRule: 'Reconfirm material acquisition criteria, capacity, and permission every 30 to 60 days and immediately before an introduction.' },
        { source: 'Opportunity and relationship evidence', authority: 'Future governed real-estate investor relationship and outcome record', requiredEvidence: ['opportunity authority', 'permitted disclosure facts', 'fit decision', 'operator approval', 'bilateral acceptance', 'diligence stage', 'verified outcome'], freshnessRule: 'Refresh opportunity facts and applicable legal/compliance review immediately before disclosure or introduction.' },
      ],
      primaryChannels: ['operator_task', 'website_notification'],
      secondaryChannels: ['resend_email', 'outlook_graph', 'manual_phone_task', 'no_outreach'],
      channelSelectionRules: ['Professional participant activation owns profile completion and verification.', 'After an accepted active-profile handoff, present an operator-reviewed relationship request through the secure website first.', 'Use email or a manual phone task only with channel-specific permission; never send an unreviewed opportunity or return-based solicitation.'],
      followupCadence: ['Reconfirm high-volatility capacity and criteria every 30 days; complete a full relationship review no later than 60 days.', 'For an operator-approved introduction, use only the approved opportunity-specific cadence and stop on either party response.', 'No cadence may use the empty historical automation loop.'],
      cadenceSteps: [
        { timing: 'every 30 to 60 days while active', purpose: 'Reconfirm capacity, structure, criteria, conflicts, and permissions.', channels: ['website_notification', 'resend_email'], condition: 'The participant profile is active and separately permitted for profile notifications.' },
        { timing: 'before any opportunity disclosure', purpose: 'Review fit, authority, legal boundaries, permitted facts, and compensation.', channels: ['operator_task'], condition: 'A current authorized opportunity may fit a verified profile.' },
        { timing: 'after bilateral operator-reviewed fit', purpose: 'Present a controlled relationship introduction.', channels: ['website_notification', 'resend_email', 'outlook_graph', 'manual_phone_task'], condition: 'The operator approved the introduction, both parties permitted the purpose, and the selected channel is allowed.' },
      ],
      nurtureRules: ['Nurture only criteria freshness, participant-requested education, or a specific approved relationship gap.', 'Do not imply access to inventory, investment suitability, returns, capital availability, or transaction timing.'],
      reactivationRules: ['Reactivate only after the participant updates capacity, criteria, structure, conflicts, verification, or permissions.', 'A regulatory or complaint pause requires operator review before any relationship activity resumes.'],
      crossLaneRoutes: [
        crossLane('professional_participant_activation', 'The investor profile is incomplete, unverified, disputed, or no longer active.', 'Return pre-active ownership to the shared participant service.'),
        crossLane('buyer_buy_box_activation', 'The participant wants VestBlock to source properties against a current buy box.', 'Create or update a distinct buyer-role profile after the receiving strategy accepts; the investor profile alone does not authorize sourcing.'),
        crossLane('capital_readiness_intake', 'A separately permissioned sponsor or project needs capital-readiness review.', 'Route the sponsor to Capital without representing investor interest or sharing this profile automatically.'),
        crossLane('dealvault_activation', 'Both parties accept a relationship that needs controlled records and diligence continuity.', 'Offer an access-controlled DealVault review after record authority is established.'),
      ],
      humanApprovalPoints: ['Role/entity/capacity verification', 'Every opportunity disclosure', 'Every introduction', 'Investment/securities/return/suitability language', 'Compensation and conflicts', 'Diligence or verified-value conclusion'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Do not provide an autonomous investment recommendation, suitability determination, offering, or return-based solicitation.', 'The current route supports a real-estate investor profile only; broader capital-partner claims are prohibited until a distinct governed role and schema exist.', 'Active property sourcing belongs to buyer activation and requires its own accepted handoff.'],
      learningInputs: ['participant segment', 'sector', 'geography', 'structure', 'capacity', 'opportunity fit', 'decline reason', 'operator decision', 'bilateral acceptance', 'diligence stage', 'verified outcome'],
      failureConditions: ['Unverified identity or capacity', 'Stale criteria', 'Regulatory or offering concern', 'Permission withdrawal', 'Unreviewed opportunity disclosure', 'Empty-source automation'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Pause on stale capacity, permission withdrawal, regulatory concern, complaint, or any outcome that materially contradicts the submitted profile.'],
      handoffRules: ['Professional participant activation owns every pre-active state and completion reminder.', 'This strategy owns only an accepted active investor profile, relationship review, and operator-approved introduction; the receiving opportunity owner must also accept.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'Real-estate investor participant profile', status: 'partial', evidence: 'The role=investor route exists and reuses real-estate buyer fields; it can capture a real-estate acquisition thesis but cannot represent a broader cross-sector capital partner.', requiredBeforeActivation: true },
        { integration: 'Investor relationship and opportunity match authority', status: 'missing', evidence: 'No governed record currently persists relationship review, opportunity review, bilateral acceptance, diligence, and verified value.', requiredBeforeActivation: true },
        { integration: 'Historical investor automation', status: 'blocked', evidence: 'Historical runs exist without a sourced current profile contract and must remain disabled rather than become an executor.', requiredBeforeActivation: false },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['The current real-estate investor profile route exists.', 'The contract separates investor-profile intake from buyer-strategy property sourcing.', 'The historical empty automation loop is explicitly excluded.'],
        blockers: ['Canonical strategy-version binding is absent.', 'The shared investor form cannot support the prior cross-sector capital-partner scope.', 'Relationship and opportunity acceptance events are missing.', 'Verified diligence/value attribution is absent.', 'External sends and introductions are unapproved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 90-day windows each contain ten operator-reviewed real-estate investor introductions and three accepted introductions, with no regulatory, complaint, or claim regression.',
        'Revise one participant segment, fit rule, or review step when attributable decline or diligence evidence identifies a correctable issue.',
        'Retire a segment after material regulatory or permission failure, unsupported solicitation, or two reviewed windows without accepted introductions.'
      ),
    },
    lifecycleContract: {
      states: ['active_real_estate_investor_profile', 'relationship_review', 'opportunity_review', 'introduction_accepted', 'declined', 'diligence', 'relationship_active', 'dormant', 'DNC'],
      initialState: 'active_real_estate_investor_profile',
      terminalStates: ['relationship_active', 'dormant', 'DNC'],
      transitions: [
        { from: 'active_real_estate_investor_profile', to: 'relationship_review', event: 'relationship_criteria_review_started', persistence: 'target_only' },
        { from: 'relationship_review', to: 'opportunity_review', event: 'operator_accepts_opportunity_fit_review', persistence: 'target_only' },
        { from: 'opportunity_review', to: 'introduction_accepted', event: 'both_parties_accept_controlled_introduction', persistence: 'target_only' },
        { from: 'opportunity_review', to: 'declined', event: 'either_party_declines_opportunity', persistence: 'target_only' },
        { from: 'introduction_accepted', to: 'diligence', event: 'authorized_diligence_begins', persistence: 'target_only' },
        { from: 'diligence', to: 'relationship_active', event: 'verified_relationship_activity_recorded', persistence: 'target_only' },
        { from: 'active_real_estate_investor_profile', to: 'dormant', event: 'criteria_or_capacity_expires', persistence: 'target_only' },
        { from: 'active_real_estate_investor_profile', to: 'DNC', event: 'participant_withdraws_outreach_permission', persistence: 'target_only' },
        { from: 'declined', to: 'relationship_review', event: 'current_criteria_materially_change', persistence: 'target_only' },
      ],
      cadence: ['Relationship criteria review every 30 to 60 days.', 'Opportunity-specific cadence only after operator approval.', 'Stop on either party response or any permission/compliance event.'],
      stopConditions: ['dormant', 'DNC', 'capacity_stale', 'permission_withdrawn', 'regulatory_concern', 'complaint'],
      recordAuthority: 'Shared real-estate investor profiles and matches hold partial identity and fit facts; no investor-relationship lifecycle authority currently persists these stages.',
      persistedStates: [],
      persistedEvents: ['participant profile status and operator verification facts', 'participant match records where present', 'historical investor automation runs as non-authoritative diagnostics'],
      targetOnlyStages: ['active_real_estate_investor_profile', 'relationship_review', 'opportunity_review', 'introduction_accepted', 'declined', 'diligence', 'relationship_active', 'dormant', 'DNC'],
      stateNotes: lifecycleStateNotes([], ['active_real_estate_investor_profile', 'relationship_review', 'opportunity_review', 'introduction_accepted', 'declined', 'diligence', 'relationship_active', 'dormant', 'DNC'], 'the shared real-estate investor profile/match records and missing relationship authority'),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'The shared profile service owns participant identity and permissions; a future relationship ledger must own match, introduction, diligence, and outcome.',
      humanOwner: 'A VestBlock operator owns verification, opportunity review, every introduction, compliance review, and outcome verification.',
      handoffRules: ['Accept only an active investor-role profile from professional participant activation.', 'No opportunity owner or channel may bypass operator review and bilateral acceptance.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'A qualified real-estate investor relationship accepts an operator-reviewed, controlled introduction.',
      leadingIndicators: ['verified active profile', 'criteria freshness', 'relationship review', 'opportunity fit', 'operator approval', 'bilateral response', 'diligence progression'],
      businessValue: 'A governed real-estate investor relationship network with potential Capital and DealVault adoption.',
      learningInputs: ['strategy version', 'participant profile', 'sector', 'structure', 'capacity', 'match rationale', 'decline reason', 'operator decision', 'acceptance', 'diligence', 'verified value'],
      learningWindowDays: 90,
      minimumExposure: 10,
      exposureUnit: 'operator_reviewed_real_estate_investor_introductions',
      minimumPrimaryConversions: 3,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'participant', 'opportunity', 'sector', 'structure', 'operator', 'verified outcome'],
      safeguards: outcomeSafeguards('Do not count profile activation, opportunity view, delivered message, one-sided interest, or historical automation activity as an accepted introduction.'),
      verifiedOutcomeRule: 'Count once when a governed relationship record proves current profiles, operator approval, permitted disclosure, and acceptance by both identified parties.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'The real-estate investor profile and generic matches can hold partial participant and fit facts.', limitation: 'No current investor-relationship record proves operator review, controlled disclosure, and bilateral acceptance.' },
      stopConditions: ['regulatory or offering concern', 'permission failure', 'unreviewed disclosure', 'complaint', 'no accepted introduction after two windows'],
    },
    sourceProvenance: sourceProvenance('real-estate investor profile, historical automation, opportunity, and relationship-outcome audit'),
  },

  public_sector_opportunity_readiness: {
    strategyKey: 'public_sector_opportunity_readiness',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'internal_only',
    destination: { mode: 'internal_only', path: null, cta: null },
    externalSendCap: 0,
    activation: blockedActivation(
      'The public_sector_opportunities parent portfolio remains proposed rather than founder-approved for activation.',
      'No approved customer destination or participant-specific readiness/bid-no-bid plan authority exists.',
      'Every bid/no-bid decision, capability assertion, pricing decision, submission, teaming step, and government contact requires human approval.'
    ),
    operatingContract: {
      objective: 'Organize current official public-sector opportunities for internal fit screening and operator-reviewed readiness or bid/no-bid planning.',
      targetParticipant: 'Qualified small businesses and partners with verifiable capabilities, registrations, certifications, capacity, and interest in relevant public-sector work.',
      problem: 'Opportunity feeds create noise and missed deadlines when official facts, entity readiness, exclusions, conflicts, documents, and human bid decisions are not joined.',
      valueExchange: 'Official sources and participant-submitted facts support a cited internal fit review; a future qualified participant receives a bounded readiness or bid/no-bid plan, never an award promise.',
      offer: 'Internal cited opportunity intelligence and operator review only in Gate 3B; no public CTA, autonomous notification, bid preparation, or submission is active.',
      eligibilityCriteria: ['Opportunity facts come from an official current source and include identifier, agency, notice type, dates, deadline, and applicable NAICS or scope.', 'Participant facts, when later used, are customer-submitted and include capability, registration, certification, capacity, conflicts, and document state.', 'Deadline feasibility, exclusions, source agreement, and operator ownership can be established before a fit decision.'],
      disqualificationCriteria: ['Expired, cancelled, duplicated, unsupported, or source-conflicted notice.', 'Ineligible entity, missing required registration, material capability/capacity gap, prohibited conflict, or unsupported certification claim.', 'Any request to imply agency endorsement, award likelihood, guaranteed eligibility, or autonomous submission.'],
      prioritizationRules: ['Prioritize current official notices with complete source evidence and sufficient time for responsible review.', 'Rank by verified capability fit, deadline feasibility, readiness gaps, and operator capacity, never protected attributes or claimed award likelihood.', 'Treat feed ingestion and automated scoring as hypotheses until an operator records a bid/no-bid review.'],
      sourceData: ['sam_opportunities', 'official SAM.gov and government notice sources', 'participant-submitted capability and readiness facts', 'operator bid/no-bid review'],
      sourceDataRequirements: [
        { source: 'Official public-sector opportunity', authority: 'sam_opportunities plus the cited official source', requiredEvidence: ['official identifier', 'agency', 'notice type', 'NAICS/scope', 'posted/updated/deadline timestamps', 'status', 'source URL'], freshnessRule: 'Refresh daily and immediately before fit review, participant notification, bid/no-bid, or submission work.' },
        { source: 'Participant readiness evidence', authority: 'Future governed participant public-sector readiness record', requiredEvidence: ['identity/entity', 'registrations', 'certifications', 'capabilities', 'capacity', 'conflicts', 'document state', 'permission'], freshnessRule: 'Reverify every material eligibility, registration, certification, conflict, and capacity fact before bid/no-bid approval.' },
      ],
      primaryChannels: ['operator_task', 'no_outreach'],
      secondaryChannels: ['no_outreach'],
      channelSelectionRules: ['Gate 3B is internal-only: ingest current official facts and create operator review tasks.', 'Do not send a digest, alert, government contact, or customer message until a public destination, opted-in participant fit, and strategy activation are separately approved.', 'n8n and channel adapters are not executors for this draft.'],
      followupCadence: ['Daily internal source refresh while official access and health are current.', 'Operator tasks follow verified deadlines and capacity.', 'No external weekly digest or participant cadence is active in Gate 3B.'],
      cadenceSteps: [
        { timing: 'daily while source access is healthy', purpose: 'Refresh official notice facts and archive expired or changed records.', channels: ['no_outreach'], condition: 'The official source, terms, and internal scheduler are healthy.' },
        { timing: 'after current fit screening', purpose: 'Review source agreement, participant fit, deadline feasibility, and readiness gaps.', channels: ['operator_task'], condition: 'A current notice has complete cited evidence and an identified review owner.' },
        { timing: 'before every material deadline', purpose: 'Escalate an already approved internal readiness task.', channels: ['operator_task'], condition: 'The operator previously approved preparation and the official deadline remains current.' },
      ],
      nurtureRules: ['This internal draft does not nurture participants.', 'A future digest must be participant-specific, fit-screened, source-cited, permissioned, and separately activated.'],
      reactivationRules: ['Reopen an archived opportunity only on a new official amendment, deadline, or status event.', 'A disabled source requires corrected provenance/health evidence and operator approval before reuse.'],
      crossLaneRoutes: [
        crossLane('business_formation_readiness', 'A future participant has foundational entity, registration, recordkeeping, or readiness gaps.', 'Offer the guided readiness route without implying procurement eligibility.'),
        crossLane('capital_readiness_intake', 'A participant separately requests preparation for a documented working-capital need.', 'Create a permissioned Capital intake without implying award or funding approval.'),
        crossLane('partner_referral_network', 'A reviewed opportunity may require governed teaming or specialist capability.', 'Hold the route until the partner strategy has an approved destination, terms, and disclosure authority.'),
        crossLane('dealvault_activation', 'An approved preparation or teaming effort needs controlled proof and milestone records.', 'Offer DealVault only after authority and participant access are established.'),
      ],
      humanApprovalPoints: ['Bid/no-bid', 'Capability and certification assertions', 'Pricing', 'Teaming and partner disclosure', 'Preparation scope', 'Submission', 'Government contact', 'Award/outcome verification'],
      complianceLimits: [...UNIVERSAL_COMPLIANCE_LIMITS, 'Cite the current official source and never imply agency endorsement, award likelihood, eligibility, or submission.', 'Automated fit is screening evidence only; it is not a bid decision or capability assertion.'],
      learningInputs: ['official source', 'notice type', 'agency', 'NAICS/scope', 'fit/no-fit reason', 'deadline feasibility', 'readiness gap', 'bid/no-bid decision', 'submission result', 'debrief fact'],
      failureConditions: ['Expired or conflicting source', 'Ineligible entity', 'Missing registration or certification', 'Insufficient capacity', 'Conflict', 'Unsupported claim', 'No participant plan authority'],
      stopRules: [...UNIVERSAL_STOP_RULES, 'Stop on expiration, cancellation, entity ineligibility, conflict, missing registration, insufficient capacity, unsupported claim, source discrepancy, or operator no-bid.'],
      handoffRules: ['SAM ingestion owns official facts only; it does not own participant communication or bid decisions.', 'A receiving readiness, Capital, partner, or DealVault strategy must accept the handoff and its own evidence/permission requirements.'],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        { integration: 'SAM opportunity subsystem', status: 'available', evidence: 'sam_opportunities and official-source ingestion/repository foundations exist, though they are dormant and unscheduled.', requiredBeforeActivation: true },
        { integration: 'Participant public-sector readiness and bid/no-bid plan authority', status: 'missing', evidence: 'No governed record joins an opportunity to participant capability, readiness gaps, operator decision, and accepted plan.', requiredBeforeActivation: true },
        { integration: 'Approved public destination and permissioned digest', status: 'missing', evidence: 'The strategy intentionally has no public CTA and no approved external notification path.', requiredBeforeActivation: true },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: ['Official opportunity ingestion and repository foundations exist.', 'The strategy is explicitly internal-only.', 'Human authority for bid/no-bid and submission is explicit.'],
        blockers: ['The parent portfolio remains proposed.', 'Canonical strategy-version binding is absent.', 'No customer destination or participant-plan authority exists.', 'External notifications and source scheduling are unapproved.'],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 30-day windows each include 30 current fit-screened official opportunities and five participant-accepted operator-reviewed readiness or bid/no-bid plans, with no source or claim regression.',
        'Revise a source, fit rule, or readiness requirement when attributable no-fit, deadline, or source evidence identifies a correctable issue.',
        'Retire a source or segment after material source discrepancy, prohibited claim, or two reviewed windows without accepted readiness progression.'
      ),
    },
    lifecycleContract: {
      states: ['watchlisted', 'ingested', 'normalized', 'fit_screen', 'bid_no_bid_review', 'prepare_approved', 'no_bid', 'submission_review', 'submitted', 'award', 'lost', 'archived'],
      initialState: 'watchlisted',
      terminalStates: ['no_bid', 'award', 'lost', 'archived'],
      transitions: [
        { from: 'watchlisted', to: 'ingested', event: 'official_notice_ingested', persistence: 'target_only' },
        { from: 'ingested', to: 'normalized', event: 'official_fields_normalized', persistence: 'target_only' },
        { from: 'normalized', to: 'fit_screen', event: 'current_source_and_fit_screen_ready', persistence: 'target_only' },
        { from: 'fit_screen', to: 'bid_no_bid_review', event: 'operator_review_requested', persistence: 'target_only' },
        { from: 'bid_no_bid_review', to: 'prepare_approved', event: 'operator_approves_preparation', persistence: 'target_only' },
        { from: 'bid_no_bid_review', to: 'no_bid', event: 'operator_records_no_bid', persistence: 'target_only' },
        { from: 'prepare_approved', to: 'submission_review', event: 'submission_package_ready_for_review', persistence: 'target_only' },
        { from: 'submission_review', to: 'submitted', event: 'operator_confirms_submission', persistence: 'target_only' },
        { from: 'submitted', to: 'award', event: 'official_award_verified', persistence: 'target_only' },
        { from: 'submitted', to: 'lost', event: 'official_nonaward_verified', persistence: 'target_only' },
        { from: 'watchlisted', to: 'archived', event: 'notice_expires_or_is_cancelled', persistence: 'target_only' },
      ],
      cadence: ['Daily official-source refresh.', 'Deadline-driven internal operator tasks.', 'No Gate 3B external digest or notification.'],
      stopConditions: ['no_bid', 'award', 'lost', 'archived', 'expired', 'cancelled', 'ineligible', 'conflict', 'source_discrepancy'],
      recordAuthority: 'sam_opportunities persists official opportunity facts and its own status, but no canonical readiness/bid lifecycle or participant acceptance authority exists.',
      persistedStates: [],
      persistedEvents: ['sam_opportunities official identifier, source, status, update, and deadline facts'],
      targetOnlyStages: ['watchlisted', 'ingested', 'normalized', 'fit_screen', 'bid_no_bid_review', 'prepare_approved', 'no_bid', 'submission_review', 'submitted', 'award', 'lost', 'archived'],
      stateNotes: lifecycleStateNotes([], ['watchlisted', 'ingested', 'normalized', 'fit_screen', 'bid_no_bid_review', 'prepare_approved', 'no_bid', 'submission_review', 'submitted', 'award', 'lost', 'archived'], 'sam_opportunities without a canonical readiness/bid lifecycle'),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'operator_manual',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'The SAM repository owns official notice facts; a future CRM readiness record must own participant fit, plan acceptance, and bid lifecycle.',
      humanOwner: 'A VestBlock operator owns fit review, every bid/no-bid, capability assertion, pricing, teaming, submission, government contact, and outcome verification.',
      handoffRules: ['Source ingestion cannot contact a participant or government party.', 'No receiving strategy or channel acts until the operator and that strategy accept the governed handoff.'],
    },
    outcomeContract: {
      primaryConversionEvent: 'A qualified participant accepts an operator-reviewed public-sector readiness or bid/no-bid action plan.',
      leadingIndicators: ['current official opportunity', 'fit-screen completion', 'deadline feasibility', 'readiness-gap closure', 'operator bid/no-bid', 'submission readiness', 'verified result'],
      businessValue: 'Disciplined public-sector readiness services and strategic relationships without wasted or unsupported bids.',
      learningInputs: ['strategy version', 'official opportunity', 'agency', 'NAICS/scope', 'participant', 'fit/no-fit reason', 'readiness gaps', 'operator decision', 'accepted plan', 'verified result'],
      learningWindowDays: 30,
      minimumExposure: 30,
      exposureUnit: 'current_fit_screened_opportunities',
      minimumPrimaryConversions: 5,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'official source', 'opportunity', 'participant', 'fit segment', 'operator', 'verified outcome'],
      safeguards: outcomeSafeguards('Do not count feed ingestion, a relevance score, operator task creation, digest delivery, submission, or claimed award as an accepted readiness plan.'),
      verifiedOutcomeRule: 'Count once when a current cited opportunity, qualified participant, operator-reviewed plan, and participant acceptance share a governed readiness record.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: { available: false, evidence: 'sam_opportunities can provide official opportunity facts.', limitation: 'No current authority joins a fit-screened opportunity to a qualified participant, operator-reviewed plan, and participant acceptance.' },
      stopConditions: ['official-source discrepancy', 'expired notice', 'entity ineligibility', 'unsupported capability claim', 'no accepted plan after two windows'],
    },
    sourceProvenance: sourceProvenance('SAM subsystem, official-source, scheduling, and participant-readiness audit'),
  },
  professional_participant_activation: {
    strategyKey: 'professional_participant_activation',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: {
      mode: 'public_route',
      path: '/workspace/profiles',
      cta: 'Create your free participant profile',
    },
    externalSendCap: 0,
    activation: blockedActivation(
      'An active profile is not yet bound to this immutable operating-strategy version or an idempotent receiving-strategy handoff.',
      'Days 3 and 7 completion reminders remain proposed, externally disabled, and unapproved.'
    ),
    operatingContract: {
      objective: 'Convert an authenticated participant draft into one operator-verified active profile with explicit matching permission, then hand it to exactly one role strategy without retaining outreach ownership.',
      targetParticipant: 'Buyers, investors, lenders, builders, developers, agents, wholesalers, business buyers or sellers, and service providers who need a private reusable criteria profile.',
      problem: 'Disconnected role forms, ambiguous identity ownership, and combined consent choices produce duplicate profiles, unusable criteria, and outreach that cannot be governed safely.',
      valueExchange: 'The participant provides role, identity, criteria, permission, and verification facts in exchange for a reusable private profile and access to operator-reviewed matching paths.',
      offer: 'A free role-aware profile with independent account, matching, outreach, public-display, and marketing controls plus a reviewed handoff to the appropriate VestBlock strategy.',
      eligibilityCriteria: [
        'The profile has an authenticated owner and a supported participant role.',
        'Required identity or entity facts, role criteria, provenance, and operator review inputs are complete.',
        'Matching permission is explicit and independent of outreach, marketing, and public-display permission.',
      ],
      disqualificationCriteria: [
        'Identity conflict, ownership dispute, fabricated evidence, or an attempt to claim a legacy record by email alone.',
        'Missing role-critical facts or verification evidence after a documented needs-information review.',
        'Withdrawn matching permission or a request to bypass operator verification, disclosure, or role boundaries.',
      ],
      prioritizationRules: [
        'Prioritize pending-review profiles with a complete identity, role, criteria, permission, and provenance record.',
        'Resolve ownership and identity conflicts before completeness or matching work.',
        'Use role-specific readiness and submission age only after required evidence is complete; do not prioritize by a promised opportunity or outcome.',
      ],
      sourceData: [
        'participant_profiles',
        'participant_profile_events',
        'authenticated account ownership',
        'role criteria and permission fields',
        'operator verification tasks and evidence',
        'legacy participant records pending governed ownership review',
      ],
      sourceDataRequirements: [
        {
          source: 'participant_profiles',
          authority: 'Participant profile service',
          requiredEvidence: ['authenticated owner', 'supported role', 'current status', 'role criteria', 'matching consent', 'separate outreach, marketing, and public-display choices', 'operator_verified_at when active'],
          freshnessRule: 'Revalidate identity ownership and consent on every material profile change; role-specific criteria freshness belongs to the receiving strategy after activation.',
        },
        {
          source: 'participant_profile_events',
          authority: 'Participant profile append-only event history',
          requiredEvidence: ['profile ID', 'prior and resulting status', 'actor', 'event time', 'verification or information-request reason', 'permission change provenance'],
          freshnessRule: 'Use the latest non-revoked event sequence and reject a transition when event history conflicts with the current profile row.',
        },
        {
          source: 'legacy participant identity candidates',
          authority: 'Operator-reviewed legacy source records; email equality alone has no ownership authority',
          requiredEvidence: ['source namespace and ID', 'ownership proof', 'identity resolution decision', 'operator', 'decision time'],
          freshnessRule: 'Require a new ownership review whenever source identity, account ownership, or a material entity fact conflicts.',
        },
      ],
      primaryChannels: ['website_notification', 'operator_task'],
      secondaryChannels: ['resend_email', 'no_outreach'],
      channelSelectionRules: [
        'Use the secure website for profile entry, consent choices, status, and requested information.',
        'Use an operator task for identity, role, evidence, public-field, and activation review.',
        'A completion email may be proposed only after separate channel permission, suppression clearance, founder activation, and a still-incomplete eligible state; Gate 3B authorizes no send.',
      ],
      followupCadence: [
        'Persist an immediate in-product acknowledgement after a valid draft or submission.',
        'Open one operator review task when a complete profile enters pending_review.',
        'Proposed completion checkpoints are limited to days 3 and 7 while the profile remains incomplete and permissioned; they are not executable in Gate 3B.',
      ],
      cadenceSteps: [
        {
          timing: 'immediate after a valid save or submission',
          purpose: 'Confirm the current profile state and show the next required action.',
          channels: ['website_notification'],
          condition: 'The authenticated owner saved a valid profile change and the returned state matches the profile authority.',
        },
        {
          timing: 'when a complete profile enters pending_review',
          purpose: 'Create one deduplicated operator verification task.',
          channels: ['operator_task'],
          condition: 'Identity, role, criteria, permission, provenance, and required evidence are complete and no open review task already owns the profile.',
        },
        {
          timing: 'proposed days 3 and 7 after an incomplete draft',
          purpose: 'Remind the participant about the exact missing profile fields without introducing an opportunity offer.',
          channels: ['resend_email'],
          condition: 'A later approved version is active, email permission and suppression are current, the profile remains draft or needs_information, and no prior response requires human handling.',
        },
      ],
      nurtureRules: [
        'Limit pre-activation assistance to the participant-selected role and exact missing or review-blocking facts.',
        'Do not market, match, share opportunities, publish fields, or infer consent while this strategy owns the profile.',
        'After active handoff, the receiving role strategy exclusively owns criteria freshness, matching, communication, and outcomes.',
      ],
      reactivationRules: [
        'A paused or archived profile may re-enter review only after the authenticated owner confirms role, identity, criteria, and every relevant permission.',
        'A declined, withdrawn, ownership-disputed, or identity-conflicted profile requires a new operator decision before any review or handoff.',
      ],
      crossLaneRoutes: [
        crossLane('buyer_buy_box_activation', 'An operator-verified buyer profile becomes active with explicit matching permission.', 'Emit one idempotent buyer-profile handoff and permanently relinquish reminder and dispatch ownership.'),
        crossLane('lender_provider_criteria', 'An operator-verified lender profile becomes active with explicit matching permission.', 'Emit one idempotent lender-profile handoff; the lender strategy owns products, criteria freshness, and introductions.'),
        crossLane('service_provider_network', 'An operator-verified service-provider profile becomes active with explicit matching permission.', 'Emit one idempotent service-provider handoff; the provider strategy owns capacity, credentials, and introductions.'),
        crossLane('investor_capital_relationships', 'An operator-verified real-estate investor profile becomes active with explicit matching permission.', 'Emit one idempotent real-estate investor handoff; broader capital-partner intent remains an operator task until a distinct governed role exists, and active property sourcing still requires the buyer strategy.'),
      ],
      humanApprovalPoints: [
        'Identity and profile ownership conflict',
        'Operator verification and activation',
        'Role classification or material criteria ambiguity',
        'Public-display fields',
        'Legacy-record ownership decision',
        'First receiving-strategy handoff',
      ],
      complianceLimits: [
        ...UNIVERSAL_COMPLIANCE_LIMITS,
        'Never auto-claim or merge a legacy record from an email match alone.',
        'Keep account, matching, outreach, marketing, and public-display permissions independent and purpose-specific.',
        'Profile activation is not approval, endorsement, opportunity availability, eligibility, or authorization to contact the participant.',
      ],
      learningInputs: [
        'selected role',
        'draft abandonment field',
        'time in pending_review',
        'needs-information reason',
        'identity or ownership issue',
        'operator verification decision',
        'permission selection and withdrawal',
        'receiving-strategy acceptance',
        'later criteria-quality feedback',
      ],
      failureConditions: [
        'Identity or ownership conflict',
        'Missing or contradictory role evidence',
        'Invalid status transition',
        'Permission conflation or withdrawal',
        'Duplicate active profile or handoff',
        'Reminder after active handoff',
        'Unreviewed public field',
      ],
      stopRules: [
        ...UNIVERSAL_STOP_RULES,
        'Stop completion assistance at active, declined, withdrawn, or archived.',
        'Stop and route to an operator on identity conflict, ownership dispute, verification failure, or ambiguous role.',
        'After the first accepted active handoff, this strategy may not own any matching, opportunity, or profile-freshness communication.',
      ],
      handoffRules: [
        'Emit at most one idempotent handoff for the current profile role and active transition.',
        'The handoff must carry the profile ID, role, current matching permission, verification timestamp, source provenance, and no broader permission than the participant granted.',
        'The receiving strategy must explicitly accept ownership before activation can be treated as handed off; a rejected handoff returns an operator task, not outreach.',
      ],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        {
          integration: 'Participant profile service',
          status: 'available',
          evidence: 'participant_profiles persists draft, pending_review, needs_information, active, paused, declined, withdrawn, and archived plus operator verification and permission fields.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Profile status and permission event history',
          status: 'partial',
          evidence: 'Participant profile events exist, but canonical operating-version attribution and a reviewed permission snapshot are not yet enforced on every transition.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Idempotent role-strategy handoff and acceptance',
          status: 'missing',
          evidence: 'No canonical record currently proves one active-profile handoff, receiving-strategy acceptance, and permanent dispatch-ownership transfer.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Pre-activation completion reminder dispatch',
          status: 'blocked',
          evidence: 'Days 3 and 7 reminders are contract proposals only; no founder-approved version, strategy-version binding, or nonzero send capacity exists.',
          requiredBeforeActivation: true,
        },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: [
          'The role-aware profile destination exists.',
          'The current profile service persists the real status vocabulary, operator_verified_at, and separate permission fields.',
          'An active-profile outcome can be evaluated from current profile facts.',
        ],
        blockers: [
          'Canonical operating-strategy version binding is absent.',
          'No authoritative idempotent handoff-acceptance record transfers ownership to the receiving role strategy.',
          'External completion reminders remain unapproved with zero send capacity.',
          'No two complete 30-day learning windows meet the review threshold.',
        ],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 30-day windows each contain at least 40 participant-profile drafts and 20 profiles that become active with operator_verified_at and explicit matching permission, with no identity, consent, duplicate-handoff, or complaint regression.',
        'Revise a role journey when attributable abandonment, needs-information, verification, or permission evidence identifies a bounded correctable issue.',
        'Retire a role path after material identity or consent failure, repeated duplicate ownership, or two complete windows without verified active-profile progression.'
      ),
    },
    lifecycleContract: {
      states: ['draft', 'pending_review', 'needs_information', 'active', 'paused', 'declined', 'withdrawn', 'archived'],
      initialState: 'draft',
      terminalStates: ['archived'],
      transitions: [
        { from: 'draft', to: 'pending_review', event: 'owner_submits_draft_profile', persistence: 'current' },
        { from: 'draft', to: 'paused', event: 'owner_pauses_draft_profile', persistence: 'current' },
        { from: 'draft', to: 'withdrawn', event: 'owner_withdraws_draft_profile', persistence: 'current' },
        { from: 'draft', to: 'archived', event: 'operator_archives_draft_profile', persistence: 'current' },
        { from: 'pending_review', to: 'needs_information', event: 'operator_requests_pending_information', persistence: 'current' },
        { from: 'pending_review', to: 'active', event: 'operator_approves_pending_profile', persistence: 'current' },
        { from: 'pending_review', to: 'paused', event: 'profile_review_is_paused', persistence: 'current' },
        { from: 'pending_review', to: 'declined', event: 'operator_declines_pending_profile', persistence: 'current' },
        { from: 'pending_review', to: 'withdrawn', event: 'owner_withdraws_pending_profile', persistence: 'current' },
        { from: 'pending_review', to: 'archived', event: 'operator_archives_pending_profile', persistence: 'current' },
        { from: 'needs_information', to: 'pending_review', event: 'owner_submits_requested_information', persistence: 'current' },
        { from: 'needs_information', to: 'active', event: 'operator_approves_information_profile', persistence: 'current' },
        { from: 'needs_information', to: 'paused', event: 'information_profile_is_paused', persistence: 'current' },
        { from: 'needs_information', to: 'declined', event: 'operator_declines_information_profile', persistence: 'current' },
        { from: 'needs_information', to: 'withdrawn', event: 'owner_withdraws_information_profile', persistence: 'current' },
        { from: 'needs_information', to: 'archived', event: 'operator_archives_information_profile', persistence: 'current' },
        { from: 'active', to: 'needs_information', event: 'operator_reopens_active_information', persistence: 'current' },
        { from: 'active', to: 'paused', event: 'active_profile_is_paused', persistence: 'current' },
        { from: 'active', to: 'withdrawn', event: 'owner_withdraws_active_profile', persistence: 'current' },
        { from: 'active', to: 'archived', event: 'operator_archives_active_profile', persistence: 'current' },
        { from: 'paused', to: 'active', event: 'verified_profile_reactivates_active', persistence: 'current' },
        { from: 'paused', to: 'pending_review', event: 'unverified_profile_reactivates_review', persistence: 'current' },
        { from: 'paused', to: 'withdrawn', event: 'owner_withdraws_paused_profile', persistence: 'current' },
        { from: 'paused', to: 'archived', event: 'operator_archives_paused_profile', persistence: 'current' },
        { from: 'declined', to: 'pending_review', event: 'owner_resubmits_declined_profile', persistence: 'current' },
        { from: 'declined', to: 'withdrawn', event: 'owner_withdraws_declined_profile', persistence: 'current' },
        { from: 'declined', to: 'archived', event: 'operator_archives_declined_profile', persistence: 'current' },
        { from: 'withdrawn', to: 'archived', event: 'operator_archives_withdrawn_profile', persistence: 'current' },
      ],
      cadence: [
        'Immediate in-product acknowledgement after a valid draft or submission.',
        'One operator task when a complete profile enters pending_review.',
        'Proposed days 3 and 7 completion reminders remain externally disabled until a later approved activation.',
      ],
      stopConditions: ['active', 'declined', 'withdrawn', 'archived', 'identity_conflict', 'ownership_dispute', 'matching_permission_withdrawn'],
      recordAuthority: 'participant_profiles owns the real profile status and operator_verified_at/permission condition; participant_profile_events owns transition provenance. verified is a condition and event, not a database status.',
      persistedStates: ['draft', 'pending_review', 'needs_information', 'active', 'paused', 'declined', 'withdrawn', 'archived'],
      persistedEvents: ['participant profile created or updated', 'owner_resubmits_pending_profile idempotent event; pending_review state remains unchanged', 'operator_reissues_information_request idempotent event; needs_information state remains unchanged', 'profile status transition', 'operator verification recorded', 'permission selection or withdrawal recorded'],
      targetOnlyStages: [],
      stateNotes: lifecycleStateNotes(
        ['draft', 'pending_review', 'needs_information', 'active', 'paused', 'declined', 'withdrawn', 'archived'],
        [],
        'participant_profiles and participant_profile_events'
      ),
    },

    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'Participant profile service exclusively owns the pre-active profile, status, identity, criteria, permissions, and verification provenance.',
      humanOwner: 'A VestBlock operator owns identity, role, verification, public-field, conflict, and activation decisions.',
      handoffRules: [
        'At active, emit one idempotent handoff to the selected role strategy and require that strategy to accept ownership.',
        'After accepted handoff, this strategy permanently relinquishes completion reminders, criteria freshness, matching, opportunity communication, and outcome ownership.',
      ],
    },
    outcomeContract: {
      primaryConversionEvent: 'A participant profile becomes active with operator_verified_at and explicit current matching permission.',
      leadingIndicators: ['participant profile drafts', 'role-specific completion rate', 'pending-review entry', 'needs-information resolution', 'operator verification time', 'matching-permission completion', 'idempotent handoff attempts'],
      businessValue: 'A reusable, permissioned supply-and-demand identity layer with cleaner ownership and safer role-specific matching.',
      learningInputs: ['operating strategy version', 'profile ID', 'role', 'entry source', 'abandonment field', 'verification issue', 'status event', 'permission snapshot', 'operator', 'handoff result'],
      learningWindowDays: 30,
      minimumExposure: 40,
      exposureUnit: 'participant_profile_drafts',
      minimumPrimaryConversions: 20,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'profile role', 'entry source', 'verification path', 'permission snapshot', 'operator', 'receiving strategy'],
      safeguards: outcomeSafeguards(
        'Do not treat submitted, pending_review, needs_information, a legacy email match, or operator verification without active status and matching permission as conversion.',
        'verified is evaluated through operator_verified_at and supporting events; it must never be invented as a profile status.'
      ),
      verifiedOutcomeRule: 'Count a profile once when participant_profiles shows status=active, operator_verified_at is non-null, matching permission is explicitly true and current, and the authenticated owner has no unresolved identity or ownership conflict.',
      targetOutcomeObservable: true,
      observableCurrentOutcome: {
        available: true,
        evidence: 'participant_profiles can persist active status, operator_verified_at, role, authenticated ownership, and independent matching permission.',
        limitation: 'Current profile facts can prove the profile condition, but Gate 3C is still required for immutable strategy-version attribution and authoritative receiving-strategy handoff acceptance.',
      },
      stopConditions: ['identity conflict', 'ownership dispute', 'verification failure', 'matching-permission withdrawal', 'duplicate active profile', 'duplicate handoff', 'complaint or suppression breach'],
    },
    sourceProvenance: sourceProvenance('participant profile statuses, operator verification, consent fields, and role-handoff consumer audit'),
  },

  content_authority_intelligence: {
    strategyKey: 'content_authority_intelligence',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'no_send',
    destination: {
      mode: 'public_route',
      path: '/next-move',
      cta: 'Build my free Next Move roadmap',
    },
    externalSendCap: 0,
    activation: blockedActivation(
      'Attribution from a published content asset to a completed approved customer path is not yet authoritative.',
      'Per-asset destination and CTA snapshots, founder-approved Buffer publishing, and source-dependent refresh enforcement are incomplete.'
    ),
    operatingContract: {
      objective: 'Turn current authoritative research into cited, financially literate content that answers a real customer question and moves qualified readers into one approved VestBlock path.',
      targetParticipant: 'Prospective customers, participants, partners, and professionals seeking accurate guidance across capital, real estate, opportunity, DealVault, credit education, and business readiness.',
      problem: 'Uncited, stale, generic, or internally worded content erodes trust and creates traffic that cannot be connected to a responsible customer decision.',
      valueExchange: 'The audience receives useful cited education and a clear next step; VestBlock earns qualified attention, feedback, and permissioned progression into an approved customer path.',
      offer: 'Reviewed educational content and market intelligence with explicit evidence, freshness, audience intent, destination, CTA, and regulated-claim boundaries.',
      eligibilityCriteria: [
        'The asset is supported by a current primary or authoritative source and a reviewable research brief.',
        'Audience intent, VestBlock relevance, claims, statistics, content version, destination, CTA, and refresh date are explicit.',
        'The destination is live and approved; use /next-move only when no more specific approved path applies.',
      ],
      disqualificationCriteria: [
        'Fabricated proof, anonymous unverifiable sourcing, stale material facts, copied content, internal operating language, or generic AI-slop.',
        'Unreviewed financial, credit, investment, legal, tax, case-study, performance, or affiliate claim.',
        'Missing or broken destination, missing CTA, unsupported audience intent, or an asset that cannot be refreshed responsibly.',
      ],
      prioritizationRules: [
        'Prioritize high-consequence customer questions where a current authoritative answer removes a documented decision barrier.',
        'Prefer topics with a specific approved customer path and measurable completion event over traffic-only opportunities.',
        'Elevate material regulatory, market, product, security, or industry changes by source freshness and customer impact, never by sensational reach alone.',
      ],
      sourceData: [
        'research_briefs',
        'content_assets',
        'primary and authoritative source URLs',
        'content publication and indexing evidence',
        'per-asset destination and CTA snapshot',
        'qualified customer-path attribution events',
        'Buffer VestBlock-owned profile delivery results',
      ],
      sourceDataRequirements: [
        {
          source: 'research_briefs',
          authority: 'VestBlock research and continuous-improvement repository',
          requiredEvidence: ['topic or theme', 'audience intent', 'authoritative sources', 'material claims', 'source dates', 'priority', 'review status'],
          freshnessRule: 'Recheck each material source on its documented volatility SLA and immediately after a known regulatory, product, price, eligibility, or market change.',
        },
        {
          source: 'content_assets',
          authority: 'VestBlock content repository and content status fields',
          requiredEvidence: ['asset ID', 'slug', 'content type', 'language', 'versioned body', 'draft/ready/published/archived status', 'published_at when published', 'review evidence'],
          freshnessRule: 'A published asset must carry a refresh date derived from its most volatile material source and must be archived or returned to draft when that evidence expires.',
        },
        {
          source: 'asset destination and conversion attribution',
          authority: 'Target Gate 3C content-attribution record; not yet authoritative',
          requiredEvidence: ['content asset and version', 'approved destination and CTA snapshot', 'qualified visit', 'customer-path start', 'verified path completion', 'attribution window'],
          freshnessRule: 'Validate the live destination immediately before publication and attribute only events tied to the immutable asset and strategy versions.',
        },
      ],
      primaryChannels: ['website_notification', 'buffer_vestblock'],
      secondaryChannels: ['resend_email', 'operator_task', 'no_outreach'],
      channelSelectionRules: [
        'Publish the canonical asset on a VestBlock-owned website route only after editorial and claim review.',
        'Use buffer_vestblock only for official VestBlock-owned social profiles, an approved asset, an exact destination snapshot, and a founder-approved channel version.',
        'Use Resend only for a separately opted-in digest; PR or sensitive-topic outreach becomes an operator task and never inherits website permission.',
      ],
      followupCadence: [
        'Ingest current intelligence daily without auto-publishing a claim.',
        'Run a weekly editorial review of briefs, claims, destinations, and refresh risk.',
        'Evaluate a published asset only after at least 28 days of maturity inside each 56-day learning window.',
        'Refresh or retire according to the most volatile material source rather than a generic calendar.',
      ],
      cadenceSteps: [
        {
          timing: 'daily intelligence intake',
          purpose: 'Create or update a sourced research brief and flag material changes for review.',
          channels: ['operator_task', 'no_outreach'],
          condition: 'A current authoritative source materially affects an approved VestBlock audience or customer decision.',
        },
        {
          timing: 'weekly editorial review',
          purpose: 'Review evidence, claims, financial literacy, audience intent, destination, CTA, and refresh SLA.',
          channels: ['operator_task'],
          condition: 'A brief or asset is new, changed, approaching source expiry, or showing a material quality or compliance signal.',
        },
        {
          timing: 'after human approval and live-destination verification',
          purpose: 'Publish the canonical asset and, only in a later activated version, distribute an approved social variant.',
          channels: ['website_notification', 'buffer_vestblock'],
          condition: 'The exact asset, claims, sources, destination, CTA, channel copy, and VestBlock-owned social profile are approved and no send or publication guardrail is open.',
        },
        {
          timing: 'at source-specific refresh due date',
          purpose: 'Reverify, revise, return to draft, archive, or retire the asset.',
          channels: ['operator_task', 'no_outreach'],
          condition: 'A material source expires, changes, conflicts, or can no longer substantiate the published claim.',
        },
      ],
      nurtureRules: [
        'Let the approved destination strategy own the customer journey after a reader enters its path.',
        'A content digest may include only separately opted-in, relevant, current assets and may not infer interest from a page view.',
        'Do not recycle traffic-only content that has no verified decision value, live destination, or accountable refresh owner.',
      ],
      reactivationRules: [
        'Return an archived or retired topic to research only after new authoritative evidence and a current customer decision need are documented.',
        'Republish only as a new reviewed asset version with a revalidated destination, CTA, claim set, and refresh date.',
      ],
      crossLaneRoutes: [
        crossLane('next_move_free_roadmap', 'An educational asset has no more specific approved customer path.', 'Snapshot /next-move and its CTA on the approved asset version; Next Move independently owns intake and conversion.'),
        crossLane('capital_readiness_intake', 'A cited asset answers a capital-preparation question and the reviewed next step is Capital.', 'Snapshot the approved Capital destination and let Capital independently qualify the visitor.'),
        crossLane('credit_education_support', 'A cited educational asset appropriately leads to secure credit-report review.', 'Snapshot the secure credit destination without making a repair, deletion, or score claim.'),
        crossLane('dealvault_activation', 'A verified coordination-use-case asset appropriately leads to a private DealVault demo.', 'Snapshot the demo destination and distinguish content interest from demo qualification and product activation.'),
      ],
      humanApprovalPoints: [
        'Every material financial, credit, investment, legal, tax, regulatory, statistical, performance, or case-study claim',
        'Research brief and source sufficiency',
        'Asset readiness and publication',
        'Destination and CTA',
        'Affiliate or compensation disclosure',
        'PR pitch or sensitive-topic outreach',
        'Buffer social copy and VestBlock-owned account',
      ],
      complianceLimits: [
        ...UNIVERSAL_COMPLIANCE_LIMITS,
        'Cite authoritative sources near material claims and preserve source/version provenance.',
        'Do not publish internal strategy language, fabricated proof, anonymous unverifiable claims, copied work, or generic AI-slop.',
        'Only VestBlock-owned social profiles may be selected in Buffer, and no channel permission may be inferred from website engagement.',
      ],
      learningInputs: [
        'topic and customer question',
        'source set and freshness',
        'asset and content version',
        'audience and format',
        'destination and CTA snapshot',
        'qualified visit',
        'path start and verified completion',
        'citation or visibility evidence',
        'refresh outcome',
        'claim or brand review result',
      ],
      failureConditions: [
        'Stale or contradicted source',
        'Unsubstantiated or regulated claim',
        'Broken or unsnapshotted destination',
        'Unapproved CTA or social account',
        'Internal language or AI-slop',
        'Attribution ambiguity',
        'Sustained zero qualified progression after adequate exposure',
      ],
      stopRules: [
        ...UNIVERSAL_STOP_RULES,
        'Unpublish, return to draft, archive, or retire an asset immediately when a material source, claim, destination, disclosure, or access boundary fails.',
        'Stop social or digest distribution when the exact asset version is no longer approved or the destination changes.',
      ],
      handoffRules: [
        'The content asset must snapshot the exact approved destination, CTA, content version, and source attribution before a customer-path handoff.',
        'The receiving strategy independently owns eligibility, permission, lifecycle, communication, and conversion; a content click grants none of those authorities.',
        'CRM may attribute a completed path back to content only through a governed immutable event, not referral inference alone.',
      ],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        {
          integration: 'Content asset repository',
          status: 'available',
          evidence: 'content_assets persists draft, ready, published, and archived assets with publication timestamps and routes.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Research brief repository',
          status: 'available',
          evidence: 'research_briefs exists as a research and continuous-improvement source, but each future asset still requires human evidence review.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Per-asset destination, CTA, and source snapshot',
          status: 'missing',
          evidence: 'No canonical immutable record currently binds every published asset version to an approved strategy destination, CTA, material sources, and refresh SLA.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Qualified customer-path attribution',
          status: 'missing',
          evidence: 'Current content delivery and engagement signals do not prove a qualified visitor completed an approved customer path.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Human-review publication guard',
          status: 'blocked',
          evidence: 'Current publication paths can move a ready asset directly to published, including auto-publish behavior, without the reviewed and approved states required by this contract.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Buffer VestBlock-only publishing',
          status: 'blocked',
          evidence: 'Buffer is limited by policy to VestBlock-owned profiles, but this draft has no approved live channel version or send capacity.',
          requiredBeforeActivation: true,
        },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: [
          'Research briefs and content assets exist.',
          'The default /next-move route and CTA are approved when no specific destination applies.',
          'The approved channel vocabulary limits social publishing to buffer_vestblock.',
        ],
        blockers: [
          'Canonical operating-strategy version binding is absent.',
          'Per-asset destination, CTA, source, review, and refresh snapshots are incomplete.',
          'Current ready-to-published and auto-publish paths bypass the required human review and exact-version approval guard.',
          'Attribution from a published content asset to a completed approved customer path is not yet authoritative.',
          'Buffer and digest publishing remain unapproved with zero send capacity.',
        ],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 56-day windows each contain at least 12 approved published assets matured for 28 days and ten attributable completed customer paths, with no freshness, claim, destination, disclosure, complaint, or brand regression.',
        'Revise a topic, format, source, destination, or CTA when attributable path progression and editorial evidence identify a bounded correctable issue.',
        'Retire an asset or topic after a material claim or source failure, a broken destination that cannot be repaired, or two complete windows without qualified progression after adequate mature exposure.'
      ),
    },
    lifecycleContract: {
      states: ['draft', 'ready', 'reviewed', 'approved', 'published', 'indexed', 'qualified_visit', 'customer_path_started', 'assisted_conversion', 'refresh_due', 'retired', 'archived'],
      initialState: 'draft',
      terminalStates: ['assisted_conversion', 'retired', 'archived'],
      transitions: [
        { from: 'draft', to: 'ready', event: 'content_asset_marked_ready', persistence: 'current' },
        { from: 'draft', to: 'archived', event: 'draft_content_asset_archived', persistence: 'current' },
        { from: 'ready', to: 'reviewed', event: 'editorial_and_claim_review_completed', persistence: 'target_only' },
        { from: 'ready', to: 'published', event: 'current_content_asset_published', persistence: 'current' },
        { from: 'ready', to: 'archived', event: 'ready_content_asset_archived', persistence: 'current' },
        { from: 'reviewed', to: 'approved', event: 'content_asset_approved_for_exact_destination', persistence: 'target_only' },
        { from: 'reviewed', to: 'draft', event: 'reviewed_content_asset_returned_for_revision', persistence: 'target_only' },
        { from: 'approved', to: 'published', event: 'approved_content_version_published', persistence: 'target_only' },
        { from: 'approved', to: 'draft', event: 'approval_withdrawn_for_revision', persistence: 'target_only' },
        { from: 'published', to: 'indexed', event: 'published_asset_indexing_verified', persistence: 'target_only' },
        { from: 'published', to: 'qualified_visit', event: 'qualified_direct_visit_attributed', persistence: 'target_only' },
        { from: 'published', to: 'refresh_due', event: 'published_asset_source_refresh_due', persistence: 'target_only' },
        { from: 'published', to: 'archived', event: 'published_content_asset_archived', persistence: 'current' },
        { from: 'indexed', to: 'qualified_visit', event: 'indexed_asset_qualified_visit_attributed', persistence: 'target_only' },
        { from: 'indexed', to: 'refresh_due', event: 'indexed_asset_material_source_expires', persistence: 'target_only' },
        { from: 'qualified_visit', to: 'customer_path_started', event: 'visitor_starts_snapshotted_customer_path', persistence: 'target_only' },
        { from: 'qualified_visit', to: 'refresh_due', event: 'qualified_path_destination_or_source_expires', persistence: 'target_only' },
        { from: 'customer_path_started', to: 'assisted_conversion', event: 'attributed_customer_path_completed', persistence: 'target_only' },
        { from: 'customer_path_started', to: 'refresh_due', event: 'started_path_attribution_window_expires', persistence: 'target_only' },
        { from: 'refresh_due', to: 'draft', event: 'asset_returned_to_draft_for_refresh', persistence: 'target_only' },
        { from: 'refresh_due', to: 'retired', event: 'content_asset_retired_after_refresh_review', persistence: 'target_only' },
      ],
      cadence: [
        'Daily sourced intelligence intake.',
        'Weekly human editorial, claim, destination, and refresh review.',
        'Asset evaluation after at least 28 days of maturity inside a 56-day window.',
        'Refresh at the most volatile material source SLA.',
      ],
      stopConditions: ['assisted_conversion', 'retired', 'archived', 'material_source_stale', 'unsupported_claim', 'broken_destination', 'approval_withdrawn'],
      recordAuthority: 'content_assets currently owns draft, ready, published, and archived status; research_briefs stores research artifacts. Review/approval, indexing, qualified visits, customer-path attribution, refresh_due, and retired remain target lifecycle stages.',
      persistedStates: ['draft', 'ready', 'published', 'archived'],
      persistedEvents: ['content asset created or updated', 'content asset marked ready', 'content asset published with published_at', 'content asset archived'],
      targetOnlyStages: ['reviewed', 'approved', 'indexed', 'qualified_visit', 'customer_path_started', 'assisted_conversion', 'refresh_due', 'retired'],
      stateNotes: lifecycleStateNotes(
        ['draft', 'ready', 'published', 'archived'],
        ['reviewed', 'approved', 'indexed', 'qualified_visit', 'customer_path_started', 'assisted_conversion', 'refresh_due', 'retired'],
        'content_assets/research_briefs; canonical review, destination snapshot, attribution, and refresh lifecycle are incomplete'
      ),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'The content service owns research briefs, content assets, source provenance, publication state, destination snapshots, and refresh tasks; CRM must own future immutable path attribution.',
      humanOwner: 'A VestBlock editor owns claims, sources, financial literacy, brand quality, publication, destination, CTA, disclosure, and channel approval.',
      handoffRules: [
        'Content hands off only the approved asset/destination/CTA attribution context; it never transfers or infers customer permission.',
        'The receiving strategy owns qualification and conversion, and CRM may return only a verified attributed completion outcome to content learning.',
      ],
    },
    outcomeContract: {
      primaryConversionEvent: 'A qualified visitor attributable to an approved content version enters and completes the asset\'s snapshotted approved customer path.',
      leadingIndicators: ['approved research briefs', 'reviewed content assets', 'published assets matured 28 days', 'source freshness', 'qualified visits', 'CTA engagement', 'approved path starts', 'indexing and citation evidence'],
      businessValue: 'Lower-cost qualified acquisition, stronger trust and authority, current customer education, and increased demand for responsible VestBlock paths.',
      learningInputs: ['operating strategy version', 'asset and content version', 'topic', 'audience', 'source set and dates', 'format and channel', 'destination and CTA snapshot', 'qualified visit', 'path start', 'verified completion', 'refresh result'],
      learningWindowDays: 56,
      minimumExposure: 12,
      exposureUnit: 'approved_published_assets_matured_28_days',
      minimumPrimaryConversions: 10,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'content asset and version', 'topic', 'audience', 'source', 'channel', 'destination and CTA', 'receiving strategy', 'completed path'],
      safeguards: outcomeSafeguards(
        'Do not count publishing, indexing, impressions, page views, opens, social engagement, CTA clicks, or path starts as a completed customer path.',
        'Exclude an asset from the exposure denominator until it is approved, published, and matured for 28 days with a live destination.'
      ),
      verifiedOutcomeRule: 'Count once when an immutable content asset/version and approved destination/CTA snapshot are joined through governed attribution to a receiving-strategy-verified customer-path completion inside the declared window.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: {
        available: false,
        evidence: 'content_assets and research_briefs can prove research and publication artifacts, while delivery and engagement systems provide only leading signals.',
        limitation: 'Attribution from a published content asset to a completed approved customer path is not yet authoritative.',
      },
      stopConditions: ['source freshness failure', 'unsupported or regulated claim', 'broken destination', 'approval withdrawal', 'brand or AI-slop regression', 'complaint or disclosure failure', 'attribution integrity failure'],
    },
    sourceProvenance: sourceProvenance('content_assets, research_briefs, publication, indexing, Buffer, and customer-path attribution consumer audit'),
  },

  customer_lifecycle_orchestration: {
    strategyKey: 'customer_lifecycle_orchestration',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'internal_only',
    destination: { mode: 'internal_only', path: null, cta: null },
    externalSendCap: 0,
    activation: blockedActivation(
      'No canonical record currently proves an eligible idempotent lifecycle proposal and explicit receiving-strategy acceptance.',
      'The existing direct-reminder lifecycle monitor is legacy, unbound to this contract, and must not be treated as an approved sender.'
    ),
    operatingContract: {
      objective: 'Detect one valid unfinished, stale, or newly eligible next step and create a deduplicated internal ownership proposal for the exact responsible strategy without sending or publishing anything.',
      targetParticipant: 'Existing VestBlock customers and participants with a registered profile, case, questionnaire, record, or other governed customer state that may warrant one relevant next action.',
      problem: 'Disconnected lifecycle signals create stalled journeys, duplicate contact, generic nurture, conflicting owners, and messages whose purpose or destination cannot be justified.',
      valueExchange: 'The controller preserves continuity by proposing one evidence-backed next action to the correct owner while protecting the participant from duplicate, irrelevant, or unauthorized contact.',
      offer: 'An internal eligibility, suppression, capacity, and ownership decision that produces an auditable task proposal or closes with a reason; the controller never presents an external offer.',
      eligibilityCriteria: [
        'A registered customer, profile, case, questionnaire, or record has a current authoritative incomplete, stale, or newly eligible signal.',
        'The exact receiving strategy, active version, destination, CTA, owner, purpose, channel permission, contact history, suppression result, and capacity can be resolved.',
        'No open proposal, active owner, completed action, complaint, withdrawal, identity conflict, or path-specific cap already blocks the action.',
      ],
      disqualificationCriteria: [
        'Anonymous or unowned record, ambiguous identity, stale evidence, unresolved duplicate, or missing receiving strategy and destination.',
        'Suppression, DNC, opt-out, complaint, hard bounce, permission loss, completed action, exhausted path cap, or a prior response requiring human handling.',
        'A generic homepage fallback, transactional-to-marketing purpose change, direct n8n invocation, or direct channel-adapter call.',
      ],
      prioritizationRules: [
        'Prioritize customer-requested unfinished actions and time-sensitive safety or document needs before optional cross-lane proposals.',
        'Choose the existing accountable owner and exact approved destination over a higher-scoring but ambiguous next-best action.',
        'Apply global and path-specific caps, owner capacity, evidence freshness, and expected incremental customer value before proposing a task.',
      ],
      sourceData: [
        'authoritative customer, profile, case, questionnaire, and DealVault lifecycle records',
        'CRM tasks and owner capacity',
        'reply memory and prior contact history',
        'global and path-specific suppression state',
        'receiving strategy version, destination, CTA, and cadence contract',
        'legacy lifecycle-monitor observations without sender authority',
        'future idempotent lifecycle proposals and acceptance events',
      ],
      sourceDataRequirements: [
        {
          source: 'authoritative customer lifecycle signal',
          authority: 'The originating VestBlock case, profile, questionnaire, credit, DealVault, or other governed record service',
          requiredEvidence: ['entity namespace and ID', 'current lifecycle state or event', 'event time', 'customer owner', 'incomplete or newly eligible action', 'source strategy version when available'],
          freshnessRule: 'Re-read the authoritative record immediately before proposal creation and close the proposal if the state, owner, or completion evidence changes.',
        },
        {
          source: 'permission, contact, reply, and suppression context',
          authority: 'CRM communication permissions, suppression records, and reply memory',
          requiredEvidence: ['purpose-specific channel permission', 'global suppression result', 'path-specific cap', 'last contact', 'last reply and disposition', 'complaint, bounce, or DNC state'],
          freshnessRule: 'Recheck immediately before proposal creation and again by the receiving strategy before any later dispatch.',
        },
        {
          source: 'receiving strategy contract and owner capacity',
          authority: 'Target Gate 3C active strategy-version resolver and idempotent proposal ledger; not yet implemented',
          requiredEvidence: ['receiving strategy and active version', 'destination and CTA snapshot', 'eligible action', 'owner', 'capacity', 'acceptance or rejection event', 'idempotency key'],
          freshnessRule: 'Resolve the active receiving version and capacity at proposal time; expire the proposal on any version, destination, owner, or evidence change.',
        },
      ],
      primaryChannels: ['operator_task'],
      secondaryChannels: ['no_outreach'],
      channelSelectionRules: [
        'This controller may create an internal operator or receiving-strategy task proposal only.',
        'It may not select an external channel, write message copy, call n8n, call a channel adapter, publish a CTA, or use a generic fallback destination.',
        'After explicit acceptance, the receiving strategy independently rechecks eligibility, permission, suppression, destination, cadence, and capacity before any communication.',
      ],
      followupCadence: [
        'Evaluate a lifecycle signal once when a new authoritative event or scheduled freshness boundary occurs.',
        'Create at most one open idempotent proposal for the same participant, source event, purpose, and receiving strategy.',
        'Expire or close an unaccepted proposal at its evidence or owner-capacity SLA; do not create a reminder from this controller.',
      ],
      cadenceSteps: [
        {
          timing: 'on a new authoritative lifecycle event or due freshness boundary',
          purpose: 'Evaluate eligibility, ownership, contact history, suppression, destination, and capacity without external contact.',
          channels: ['no_outreach'],
          condition: 'The source event is new, attributable, current, and not already represented by an open or completed idempotency key.',
        },
        {
          timing: 'after all eligibility and safety checks pass',
          purpose: 'Create one internal proposal for the exact receiving strategy and accountable owner.',
          channels: ['operator_task'],
          condition: 'The active receiving strategy version, destination, CTA, owner, purpose, permission context, suppression result, and capacity are resolved and snapshotted.',
        },
        {
          timing: 'at proposal evidence or owner-capacity expiry',
          purpose: 'Close, suppress, or require fresh evaluation without sending a reminder.',
          channels: ['operator_task', 'no_outreach'],
          condition: 'The receiving strategy has not accepted before the source evidence, destination, strategy version, or capacity snapshot expires.',
        },
      ],
      nurtureRules: [
        'This controller performs no nurture and owns no message sequence.',
        'A receiving strategy may accept only the proposed purpose and must apply its own approved cadence, permissions, and stop rules.',
        'Repeated incomplete signals do not create repeated proposals while the same idempotency key or accountable owner remains open.',
      ],
      reactivationRules: [
        'A closed or suppressed proposal may be reconsidered only after a materially new authoritative event, permission restoration, destination repair, or owner-capacity change.',
        'Long-dormant reactivation, a new purpose, or a financial, credit, or investment route always requires human review before receiving-strategy acceptance.',
      ],
      crossLaneRoutes: [
        crossLane('next_move_free_roadmap', 'A registered participant requests a fresh broad sequencing path and no more specific owner applies.', 'Propose the exact /next-move route and require Next Move to accept before it owns any communication.'),
        crossLane('professional_participant_activation', 'A participant started but did not complete a role profile or must resolve verification.', 'Propose profile completion or review to the activation owner without preserving controller dispatch ownership.'),
        crossLane('capital_readiness_intake', 'A customer has a current separately requested capital-preparation action.', 'Propose the exact Capital action with purpose-specific context; Capital must independently accept and qualify it.'),
        crossLane('seller_options_intake', 'A seller case has a current customer-requested unfinished next step.', 'Propose the case-owned /sell action only if Seller accepts current ownership and the case is not complete or suppressed.'),
      ],
      humanApprovalPoints: [
        'Cross-lane financial, credit, investment, public-sector, or business-acquisition proposal',
        'Long-dormant reactivation',
        'Purpose or destination change',
        'Identity, ownership, duplicate, or conflicting lifecycle state',
        'Any response requiring interpretation',
        'Receiving-strategy rejection or capacity conflict',
      ],
      complianceLimits: [
        ...UNIVERSAL_COMPLIANCE_LIMITS,
        'Transactional permission may not be repurposed as marketing permission.',
        'The controller cannot send, publish, call n8n, call a channel adapter, or use a generic homepage fallback.',
        'A receiving strategy acceptance transfers only the proposed purpose and minimum approved context, never broad contact authority.',
      ],
      learningInputs: [
        'source entity and lifecycle event',
        'trigger and delay',
        'eligibility and suppression decision',
        'idempotency key',
        'proposed receiving strategy and version',
        'destination and CTA snapshot',
        'owner capacity',
        'acceptance or rejection reason',
        'downstream customer completion or accepted route',
        'complaint, opt-out, duplicate, or trust signal',
      ],
      failureConditions: [
        'Duplicate proposal',
        'Direct send or n8n invocation',
        'Missing or inactive receiving strategy version',
        'Broken or generic destination',
        'Stale source evidence',
        'Suppression or permission failure',
        'Unresolved owner conflict',
        'Receiving strategy cannot accept capacity',
      ],
      stopRules: [
        ...UNIVERSAL_STOP_RULES,
        'Close immediately on completion, accepted route, suppression, exhausted path cap, stale evidence, inactive receiving version, or owner rejection.',
        'Stop after any reply needing human handling and never automatically create a follow-up proposal from that reply.',
        'Disable proposal generation when evidence shows the controller increases complaints, duplicates, or loss of trust.',
      ],
      handoffRules: [
        'Create one proposal keyed by participant, source event, purpose, receiving strategy, and current source version.',
        'Snapshot the receiving strategy version, exact destination, CTA, owner, evidence, permissions, suppression result, and expiry without generating message copy.',
        'Only explicit receiving-strategy acceptance transfers ownership; rejection, expiry, or invalidation closes the proposal with no external action.',
        'Customer completion or route acceptance remains the receiving strategy\'s downstream business outcome, not an event this controller may fabricate.',
      ],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        {
          integration: 'Authoritative lifecycle source records',
          status: 'partial',
          evidence: 'Profiles, cases, questionnaires, workspace tasks, reply memory, and other records exist, but they do not share one canonical source-event and ownership contract.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Idempotent lifecycle proposal and acceptance ledger',
          status: 'missing',
          evidence: 'No canonical append-only record proves eligibility, one idempotency key, receiving-strategy acceptance, expiry, closure, and downstream ownership.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Global suppression, contact history, and owner capacity resolver',
          status: 'partial',
          evidence: 'Suppression, reply memory, tasks, and contact history exist in fragments and are not yet enforced through one pre-proposal decision.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Legacy lifecycle-monitor direct sender',
          status: 'blocked',
          evidence: 'The existing lifecycle monitor can perform direct reminder behavior, but it is legacy, unbound to this canonical contract, and is not certified for dispatch.',
          requiredBeforeActivation: true,
        },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: [
          'The approved architecture defines a strict internal-only control-plane boundary.',
          'Several source records, task surfaces, reply-memory signals, and suppression fragments exist.',
          'The contract requires receiving-strategy ownership before any communication.',
        ],
        blockers: [
          'Canonical operating-strategy version binding is absent.',
          'No canonical record currently proves an eligible idempotent lifecycle proposal and explicit receiving-strategy acceptance.',
          'Suppression, contact history, owner capacity, destination snapshots, and proposal expiry are not one enforced decision.',
          'The legacy direct-reminder lifecycle monitor must be cut off from sender authority before activation.',
        ],
      },
      versionDecisionRule: decisionRule(
        'Promote only after two complete 30-day windows each contain at least 50 eligible idempotent lifecycle proposals and 15 explicit receiving-strategy acceptances, with zero direct sends, duplicate proposals, suppression failures, or ownership conflicts.',
        'Revise trigger, eligibility, owner routing, or expiry logic when attributable rejection and downstream completion evidence identifies a bounded correctable issue.',
        'Retire a trigger or route after a direct-send boundary breach, material trust or compliance failure, or two complete windows without receiving-strategy acceptance after adequate eligible exposure.'
      ),
    },
    lifecycleContract: {
      states: ['triggered', 'eligible', 'owner_assigned', 'task_proposed', 'receiving_strategy_accepted', 'routed', 'suppressed', 'closed'],
      initialState: 'triggered',
      terminalStates: ['routed', 'suppressed', 'closed'],
      transitions: [
        { from: 'triggered', to: 'eligible', event: 'lifecycle_signal_passes_initial_eligibility', persistence: 'target_only' },
        { from: 'triggered', to: 'suppressed', event: 'lifecycle_signal_fails_safety_or_permission_check', persistence: 'target_only' },
        { from: 'triggered', to: 'closed', event: 'lifecycle_signal_is_stale_duplicate_or_completed', persistence: 'target_only' },
        { from: 'eligible', to: 'owner_assigned', event: 'accountable_receiving_owner_resolved', persistence: 'target_only' },
        { from: 'eligible', to: 'suppressed', event: 'eligible_signal_blocked_by_fresh_suppression', persistence: 'target_only' },
        { from: 'eligible', to: 'closed', event: 'eligible_signal_loses_incremental_value', persistence: 'target_only' },
        { from: 'owner_assigned', to: 'task_proposed', event: 'idempotent_owner_task_proposal_created', persistence: 'target_only' },
        { from: 'owner_assigned', to: 'closed', event: 'owner_capacity_or_destination_unavailable', persistence: 'target_only' },
        { from: 'task_proposed', to: 'receiving_strategy_accepted', event: 'receiving_strategy_accepts_proposal_ownership', persistence: 'target_only' },
        { from: 'task_proposed', to: 'suppressed', event: 'proposal_invalidated_by_permission_or_suppression_change', persistence: 'target_only' },
        { from: 'task_proposed', to: 'closed', event: 'proposal_rejected_expired_or_source_changed', persistence: 'target_only' },
        { from: 'receiving_strategy_accepted', to: 'routed', event: 'accepted_proposal_handoff_recorded', persistence: 'target_only' },
        { from: 'receiving_strategy_accepted', to: 'closed', event: 'accepted_proposal_invalidated_before_handoff', persistence: 'target_only' },
      ],
      cadence: [
        'Evaluate once per new authoritative source event or freshness boundary.',
        'Permit at most one open idempotent proposal per participant, source event, purpose, and receiving strategy.',
        'Expire without contact when evidence, destination, version, permission, or owner capacity becomes stale.',
      ],
      stopConditions: ['routed', 'suppressed', 'closed', 'direct_send_attempted', 'identity_conflict', 'duplicate_proposal', 'receiving_version_inactive'],
      recordAuthority: 'No canonical lifecycle-orchestration proposal authority exists. Workspace tasks, reply memory, source records, and the legacy lifecycle monitor are partial evidence and do not persist this governed controller lifecycle.',
      persistedStates: [],
      persistedEvents: [],
      targetOnlyStages: ['triggered', 'eligible', 'owner_assigned', 'task_proposed', 'receiving_strategy_accepted', 'routed', 'suppressed', 'closed'],
      stateNotes: lifecycleStateNotes(
        [],
        ['triggered', 'eligible', 'owner_assigned', 'task_proposed', 'receiving_strategy_accepted', 'routed', 'suppressed', 'closed'],
        'a future idempotent lifecycle-proposal and receiving-strategy-acceptance ledger'
      ),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'vestblock_application',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'CRM must own future eligibility, suppression, idempotency, owner routing, proposal, acceptance, expiry, and closure records; current sources remain owned by their originating service.',
      humanOwner: 'A VestBlock operator owns ambiguous identity, dormant reactivation, purpose changes, sensitive cross-lane routes, owner conflicts, and rejected proposals.',
      handoffRules: [
        'The controller transfers one exact proposal only after the receiving strategy explicitly accepts its current version and ownership.',
        'The receiving strategy alone owns any message, cadence, destination, dispatch, reply, and customer outcome; this controller never regains sender authority.',
      ],
    },
    outcomeContract: {
      primaryConversionEvent: 'The selected receiving strategy explicitly accepts ownership of an eligible, idempotent lifecycle proposal.',
      leadingIndicators: ['authoritative lifecycle signals', 'signals passing eligibility', 'suppression pass rate', 'owner resolution', 'idempotent task proposals', 'proposal response time', 'receiving-strategy rejection reasons', 'downstream customer completions'],
      businessValue: 'Cleaner ownership and recoverable customer journeys without generic nurture; customer completion or route acceptance remains a separately verified downstream business outcome.',
      learningInputs: ['operating strategy version', 'source entity and event', 'trigger', 'delay', 'eligibility result', 'suppression and contact context', 'idempotency key', 'receiving strategy and version', 'destination snapshot', 'acceptance or rejection', 'downstream outcome'],
      learningWindowDays: 30,
      minimumExposure: 50,
      exposureUnit: 'eligible_idempotent_lifecycle_proposals',
      minimumPrimaryConversions: 15,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'source entity and version', 'trigger', 'purpose', 'receiving strategy version', 'owner', 'proposal', 'acceptance', 'downstream outcome'],
      safeguards: outcomeSafeguards(
        'Do not treat signal detection, eligibility, task creation, delivery, open, click, or a direct reminder as receiving-strategy acceptance.',
        'Receiving-strategy acceptance is the controller outcome and must not be represented as customer completion, route acceptance, or business conversion.'
      ),
      verifiedOutcomeRule: 'Count once when a canonical idempotent proposal records current source evidence, suppression and permission checks, an exact active receiving strategy version, destination/CTA snapshot, accountable owner, and that strategy\'s explicit acceptance event.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: {
        available: false,
        evidence: 'Workspace tasks, source records, reply memory, suppression fragments, and a lifecycle monitor exist, but none is the canonical governed proposal-and-acceptance authority.',
        limitation: 'No canonical record currently proves an eligible idempotent lifecycle proposal and explicit receiving-strategy acceptance.',
      },
      stopConditions: ['direct send or n8n invocation', 'duplicate proposal', 'suppression or permission failure', 'stale source evidence', 'inactive receiving version', 'broken destination', 'owner conflict', 'trust or complaint regression'],
    },
    sourceProvenance: sourceProvenance('workspace task, reply-memory, suppression, lifecycle-monitor, and receiving-strategy ownership consumer audit'),
  },

  business_acquisition_network: {
    strategyKey: 'business_acquisition_network',
    version: 1,
    versionStatus: 'draft',
    executionMode: 'inactive',
    destination: { mode: 'unresolved', path: null, cta: null },
    externalSendCap: 0,
    activation: blockedActivation(
      'No governed record currently proves a qualified confidential business-acquisition intake and bilateral acceptance of an operator-controlled introduction.',
      'The confidential intake, opportunity authority, disclosure lifecycle, licensing and compensation decision, and approved matching destination do not exist.'
    ),
    operatingContract: {
      objective: 'Prepare a future confidential network in which verified business sellers and qualified prospective buyers can be reviewed, matched, and introduced under explicit disclosure and operator control.',
      targetParticipant: 'Business owners considering a confidential sale and verified prospective buyers, sponsors, or operators seeking an acquisition that fits documented criteria and capacity.',
      problem: 'Business-acquisition interest is sensitive and unusable without verified authority, confidentiality boundaries, structured criteria, disclosure control, capacity evidence, conflicts review, and a governed destination.',
      valueExchange: 'A future participant would provide verified identity, authority, confidential business facts or acquisition criteria, and purpose-specific permissions in exchange for a controlled review and relevant operator-led introduction.',
      offer: 'Proposed for later approval: a confidential business-acquisition review with qualified intake, disclosure staging, matching, and bilateral operator-led introductions; no current public offer is active.',
      eligibilityCriteria: [
        'Seller authority or buyer identity/entity, role, and capacity path are verified.',
        'Confidentiality consent, permitted disclosure fields, geography, industry, size, timing, structure, conflicts, and separate matching/outreach permissions are complete.',
        'Any valuation, securities, business-broker, licensing, financing, compensation, and conflict boundary has an explicit operator disposition.',
      ],
      disqualificationCriteria: [
        'Missing authority, identity mismatch, fabricated capacity, confidentiality conflict, or permission withdrawal.',
        'Unsupported valuation, guaranteed financing, guaranteed buyer or seller, undisclosed conflict or compensation, or a request to bypass disclosure controls.',
        'Legal, securities, business-broker, licensing, or other regulatory uncertainty that lacks qualified human review.',
      ],
      prioritizationRules: [
        'Keep the strategy inactive until the confidential intake, opportunity record, disclosure lifecycle, approved destination, and operator decision framework exist.',
        'In a later activated version, prioritize complete verified intakes with compatible timing, geography, industry, size, structure, disclosure stage, and capacity evidence.',
        'Never prioritize by an unsupported valuation, promised close, promised financing, compensation, or a single party\'s willingness to be contacted.',
      ],
      sourceData: [
        'capital_cases with path=business_acquisition as financing-readiness context only',
        'historical Next Move business-acquisition focus as noncanonical interest only',
        'future confidential seller and buyer intakes',
        'future business opportunity and permitted-disclosure records',
        'future operator-reviewed matches and bilateral acceptance events',
        'future LOI, diligence, withdrawal, disqualification, and verified-close evidence',
      ],
      sourceDataRequirements: [
        {
          source: 'business-acquisition financing context',
          authority: 'capital_cases for financing readiness only; it has no matching or confidential-opportunity authority',
          requiredEvidence: ['capital case ID', 'business_acquisition path', 'financing purpose', 'customer ownership', 'current consent and case state'],
          freshnessRule: 'Use only after a separate acquisition-network record exists and the customer explicitly permits the minimum financing handoff; never treat a capital case as a seller, buyer, opportunity, or match.',
        },
        {
          source: 'confidential business-acquisition intake and opportunity',
          authority: 'Missing future business opportunity service and CRM authority',
          requiredEvidence: ['party and role', 'identity/entity and authority', 'confidentiality consent', 'business summary or acquisition criteria', 'permitted disclosure fields', 'geography/industry/size', 'timing and structure', 'capacity path', 'conflicts', 'matching and outreach permissions'],
          freshnessRule: 'Reverify authority, confidentiality, criteria, capacity, conflicts, and permissions before every disclosure stage or match review.',
        },
        {
          source: 'controlled match, disclosure, and bilateral response',
          authority: 'Missing future operator-reviewed match and introduction ledger',
          requiredEvidence: ['seller intake and version', 'buyer intake and version', 'fit factors', 'disclosure package and stage', 'operator approval', 'seller acceptance', 'buyer acceptance', 'response times', 'decline reasons'],
          freshnessRule: 'Invalidate the match immediately when either party, authority, criteria, capacity, confidentiality permission, disclosure stage, conflict, or operator decision changes.',
        },
      ],
      primaryChannels: ['no_outreach', 'operator_task'],
      secondaryChannels: ['website_notification', 'resend_email', 'outlook_graph', 'manual_phone_task'],
      channelSelectionRules: [
        'Current channel posture is no_outreach; an operator task may document missing prerequisites but may not contact a prospect.',
        'A future secure website intake becomes eligible only after its route, confidentiality, privacy, access, and record contracts are approved.',
        'Future email, Outlook, or phone tasks require an activated version, bilateral purpose-specific permission, disclosure-stage approval, suppression clearance, and operator ownership.',
      ],
      followupCadence: [
        'No current intake, nurture, matching, or outreach cadence is active.',
        'A future complete confidential intake receives human-first review before any party is contacted or any information is disclosed.',
        'Proposed follow-up is limited to consented days 7 and 21 for exact missing intake or review actions after activation.',
      ],
      cadenceSteps: [
        {
          timing: 'current Gate 3B posture',
          purpose: 'Record missing integration and governance prerequisites without sourcing or contacting acquisition participants.',
          channels: ['no_outreach', 'operator_task'],
          condition: 'The strategy remains draft, inactive, unresolved, and externally capped at zero.',
        },
        {
          timing: 'future immediate review after a complete confidential intake',
          purpose: 'Verify identity, authority, confidentiality, criteria, capacity, conflicts, legal boundaries, and permitted disclosure.',
          channels: ['operator_task'],
          condition: 'A later approved destination and confidential opportunity service have persisted a complete intake under an active strategy version.',
        },
        {
          timing: 'future days 7 and 21 after an incomplete or review-blocked intake',
          purpose: 'Request the exact missing participant-owned fact without disclosing another party or implying a match.',
          channels: ['website_notification', 'resend_email', 'outlook_graph', 'manual_phone_task'],
          condition: 'A later active version authorizes the selected channel, the participant gave purpose-specific permission, suppression is clear, and an operator approved the exact request.',
        },
      ],
      nurtureRules: [
        'No current nurture is authorized.',
        'A future sequence may address only the participant\'s own incomplete confidential intake, verification, criteria, capacity, or permitted disclosure decision.',
        'Never disclose another party, imply a match, advertise availability, or introduce financing until the responsible strategy independently accepts the handoff.',
      ],
      reactivationRules: [
        'There is no current external participant sequence to reactivate.',
        'A future withdrawn, paused, or stale intake requires fresh authority, confidentiality, criteria, capacity, conflicts, permissions, and operator review before any matching work.',
      ],
      crossLaneRoutes: [
        crossLane('capital_readiness_intake', 'A verified acquisition participant separately requests acquisition financing readiness.', 'Create a purpose-specific Capital case containing only permitted financing facts; /capital remains a financing route, not the acquisition-network destination.'),
        crossLane('dealvault_activation', 'Both parties accept a controlled introduction and request governed diligence, proof, milestone, or agreement coordination.', 'Offer a separate permissioned DealVault review without automatically sharing confidential acquisition records.'),
        crossLane('professional_participant_activation', 'A prospective participant needs a reusable approved-role identity profile before a future confidential intake.', 'Offer the shared profile path only if the selected role is supported; profile activation is not acquisition qualification or match consent.'),
      ],
      humanApprovalPoints: [
        'Confidential destination and intake design',
        'Identity, authority, capacity, and conflict review',
        'Valuation, securities, business-broker, licensing, financing, and compensation boundaries',
        'Every disclosure-stage change',
        'Every match and bilateral introduction',
        'LOI, diligence, closing, and verified-outcome representation',
      ],
      complianceLimits: [
        ...UNIVERSAL_COMPLIANCE_LIMITS,
        'No confidential business or participant fact may be disclosed outside the exact permissioned disclosure stage.',
        'VestBlock must not represent valuation, buyer or seller availability, financing, suitability, LOI, diligence, close, or return beyond verified facts.',
        'Licensing, securities, business-broker, compensation, conflict, and referral requirements must be resolved before activation and rechecked for each relevant introduction.',
      ],
      learningInputs: [
        'participant role and authority',
        'industry, geography, size, timing, and structure',
        'capacity evidence',
        'confidentiality and disclosure stage',
        'fit factors and operator decision',
        'bilateral acceptance and decline reasons',
        'price or structure gap',
        'LOI and diligence progression',
        'withdrawal, disqualification, and verified close',
        'complaint or confidentiality incident',
      ],
      failureConditions: [
        'Missing confidential intake or destination',
        'Identity or authority dispute',
        'Confidentiality or disclosure conflict',
        'Unsupported valuation or financing claim',
        'Unverified capacity',
        'Licensing, securities, compensation, or conflict uncertainty',
        'Single-party or unreviewed introduction',
      ],
      stopRules: [
        ...UNIVERSAL_STOP_RULES,
        'Remain inactive until the approved confidential destination, opportunity authority, disclosure lifecycle, operator framework, and outcome ledger exist.',
        'Stop immediately on confidentiality conflict, authority dispute, identity mismatch, unsupported valuation, permission withdrawal, or legal/licensing uncertainty.',
        'Stop matching or disclosure when either party\'s evidence, capacity, criteria, permission, or operator approval becomes stale.',
      ],
      handoffRules: [
        'A future acquisition record owns confidentiality, permitted disclosure, matching, and bilateral response; a Capital or Next Move record cannot substitute for it.',
        'An operator must approve the exact disclosure package and match before either party is invited to accept an introduction.',
        'Both parties must independently accept the same controlled introduction before any downstream LOI, diligence, Capital, or DealVault route.',
      ],
      integrationDependencies: [
        GATE_3C_DEPENDENCY,
        {
          integration: 'Confidential business-acquisition destination and intake',
          status: 'missing',
          evidence: 'No approved secure destination captures the governed seller/buyer intake, confidentiality, disclosure, criteria, capacity, conflict, and permission contract.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Business opportunity and participant authority',
          status: 'missing',
          evidence: 'No canonical confidential opportunity model owns business facts, participant roles, permitted fields, evidence, status, and access.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Match, disclosure, and bilateral introduction ledger',
          status: 'missing',
          evidence: 'No governed record proves fit review, operator approval, disclosure stage, separate party acceptance, LOI/diligence progression, or verified close.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Licensing, compensation, conflict, and confidentiality decision',
          status: 'blocked',
          evidence: 'The operational and legal boundary for business-broker activity, securities, compensation, referral, conflicts, and disclosure has not been founder-approved.',
          requiredBeforeActivation: true,
        },
        {
          integration: 'Business-acquisition Capital path',
          status: 'available',
          evidence: '/capital?path=business-acquisition and capital_cases support financing-readiness context only and are explicitly not the acquisition-network matching destination.',
          requiredBeforeActivation: false,
        },
      ],
      activationReadiness: {
        status: 'blocked',
        readyElements: [
          'The canonical strategy identity and parent portfolio are registered.',
          'Gate 2 defines the proposed future confidential review offer and human-first boundary.',
          'Capital and DealVault have explicit future cross-lane purposes that do not substitute for acquisition matching.',
        ],
        blockers: [
          'Canonical operating-strategy version binding is absent.',
          'No approved confidential destination, intake, opportunity authority, access model, or disclosure lifecycle exists.',
          'No governed record currently proves a qualified confidential business-acquisition intake and bilateral acceptance of an operator-controlled introduction.',
          'Licensing, securities, business-broker, compensation, conflicts, privacy, and confidentiality decisions are unresolved.',
        ],
      },
      versionDecisionRule: decisionRule(
        'Promote only after a later approved activation produces two complete 90-day windows each with at least ten qualified confidential intakes and three operator-controlled introductions accepted by both parties, with zero confidentiality, authority, licensing, compensation, or complaint failures.',
        'Revise intake, disclosure, criteria, or match logic when attributable operator and bilateral decline evidence identifies a bounded correctable fit problem.',
        'Retire a path after a material confidentiality, authority, legal, licensing, securities, compensation, or conflict failure, or two complete windows without bilateral acceptance after adequate qualified intake exposure.'
      ),
    },
    lifecycleContract: {
      states: ['confidential_intake', 'identity_verified', 'qualified', 'opportunity_prepared', 'matching', 'operator_review', 'introduction_accepted', 'loi', 'diligence', 'closed', 'withdrawn', 'disqualified'],
      initialState: 'confidential_intake',
      terminalStates: ['closed', 'withdrawn', 'disqualified'],
      transitions: [
        { from: 'confidential_intake', to: 'identity_verified', event: 'confidential_party_identity_and_authority_verified', persistence: 'target_only' },
        { from: 'confidential_intake', to: 'withdrawn', event: 'confidential_intake_withdrawn_by_party', persistence: 'target_only' },
        { from: 'confidential_intake', to: 'disqualified', event: 'confidential_intake_fails_initial_boundary_review', persistence: 'target_only' },
        { from: 'identity_verified', to: 'qualified', event: 'party_criteria_capacity_and_permissions_qualified', persistence: 'target_only' },
        { from: 'identity_verified', to: 'withdrawn', event: 'verified_party_withdraws_before_qualification', persistence: 'target_only' },
        { from: 'identity_verified', to: 'disqualified', event: 'verified_party_fails_qualification_or_conflict_review', persistence: 'target_only' },
        { from: 'qualified', to: 'opportunity_prepared', event: 'permissioned_opportunity_or_buy_box_prepared', persistence: 'target_only' },
        { from: 'qualified', to: 'withdrawn', event: 'qualified_party_withdraws_before_preparation', persistence: 'target_only' },
        { from: 'qualified', to: 'disqualified', event: 'qualified_party_evidence_becomes_invalid', persistence: 'target_only' },
        { from: 'opportunity_prepared', to: 'matching', event: 'approved_opportunity_enters_controlled_matching', persistence: 'target_only' },
        { from: 'opportunity_prepared', to: 'withdrawn', event: 'prepared_opportunity_withdrawn', persistence: 'target_only' },
        { from: 'opportunity_prepared', to: 'disqualified', event: 'prepared_opportunity_fails_disclosure_review', persistence: 'target_only' },
        { from: 'matching', to: 'operator_review', event: 'candidate_match_submitted_for_operator_review', persistence: 'target_only' },
        { from: 'matching', to: 'withdrawn', event: 'party_withdraws_during_matching', persistence: 'target_only' },
        { from: 'matching', to: 'disqualified', event: 'matching_reveals_conflict_or_ineligible_fit', persistence: 'target_only' },
        { from: 'operator_review', to: 'introduction_accepted', event: 'both_parties_accept_operator_controlled_introduction', persistence: 'target_only' },
        { from: 'operator_review', to: 'withdrawn', event: 'party_withdraws_during_operator_review', persistence: 'target_only' },
        { from: 'operator_review', to: 'disqualified', event: 'operator_rejects_disclosure_or_introduction', persistence: 'target_only' },
        { from: 'introduction_accepted', to: 'loi', event: 'accepted_parties_record_letter_of_intent', persistence: 'target_only' },
        { from: 'introduction_accepted', to: 'diligence', event: 'accepted_parties_begin_diligence_without_loi', persistence: 'target_only' },
        { from: 'introduction_accepted', to: 'withdrawn', event: 'accepted_introduction_terminated_before_diligence', persistence: 'target_only' },
        { from: 'loi', to: 'diligence', event: 'letter_of_intent_advances_to_diligence', persistence: 'target_only' },
        { from: 'loi', to: 'withdrawn', event: 'letter_of_intent_terminated', persistence: 'target_only' },
        { from: 'loi', to: 'disqualified', event: 'letter_of_intent_reveals_prohibited_or_invalid_structure', persistence: 'target_only' },
        { from: 'diligence', to: 'closed', event: 'verified_business_acquisition_closes', persistence: 'target_only' },
        { from: 'diligence', to: 'withdrawn', event: 'party_withdraws_during_diligence', persistence: 'target_only' },
        { from: 'diligence', to: 'disqualified', event: 'diligence_reveals_disqualifying_fact', persistence: 'target_only' },
      ],
      cadence: [
        'Inactive with no current public intake or outreach cadence.',
        'Future human-first review immediately after a complete confidential intake.',
        'Future consented days 7 and 21 requests only for exact participant-owned missing actions.',
      ],
      stopConditions: ['closed', 'withdrawn', 'disqualified', 'confidentiality_conflict', 'authority_dispute', 'permission_withdrawal', 'legal_or_licensing_uncertainty'],
      recordAuthority: 'No confidential business-acquisition intake, opportunity, matching, disclosure, bilateral response, or close authority currently exists. Capital financing cases and historical journey interests are not substitutes.',
      persistedStates: [],
      persistedEvents: [],
      targetOnlyStages: ['confidential_intake', 'identity_verified', 'qualified', 'opportunity_prepared', 'matching', 'operator_review', 'introduction_accepted', 'loi', 'diligence', 'closed', 'withdrawn', 'disqualified'],
      stateNotes: lifecycleStateNotes(
        [],
        ['confidential_intake', 'identity_verified', 'qualified', 'opportunity_prepared', 'matching', 'operator_review', 'introduction_accepted', 'loi', 'diligence', 'closed', 'withdrawn', 'disqualified'],
        'a future confidential business-opportunity and bilateral introduction service'
      ),
    },
    ownerContract: {
      crmAuthority: 'vestblock_crm',
      automationRole: 'operator_manual',
      dispatchAuthority: 'none_in_gate_3b',
      recordOwner: 'A future confidential business-opportunity service and CRM ledger must own intake, access, disclosure, matching, bilateral responses, and transaction-stage evidence; no current record has that authority.',
      humanOwner: 'A VestBlock operator must own identity, authority, confidentiality, valuation, licensing, compensation, conflict, disclosure, match, introduction, and transaction-stage review.',
      handoffRules: [
        'Do not accept a financing case, generic lead, questionnaire focus, or participant profile as a confidential acquisition opportunity.',
        'Capital and DealVault receive only separately consented minimum facts after the acquisition strategy and receiving strategy each accept the handoff.',
      ],
    },
    outcomeContract: {
      primaryConversionEvent: 'A verified seller and qualified prospective buyer both accept the same operator-controlled confidential introduction.',
      leadingIndicators: ['qualified confidential intakes', 'identity and authority verification', 'criteria completeness', 'capacity evidence', 'permissioned opportunities prepared', 'operator-reviewed matches', 'bilateral response time', 'LOI and diligence progression'],
      businessValue: 'A governed advisory and referral opportunity with responsible paths into acquisition financing and DealVault coordination.',
      learningInputs: ['operating strategy version', 'seller and buyer intake versions', 'industry, geography, size, timing, and structure', 'capacity evidence', 'disclosure stage', 'fit factors', 'operator decision', 'separate party responses', 'decline reason', 'LOI, diligence, and verified close'],
      learningWindowDays: 90,
      minimumExposure: 10,
      exposureUnit: 'qualified_confidential_business_acquisition_intakes',
      minimumPrimaryConversions: 3,
      requiredCompleteWindows: 2,
      attributionDimensions: ['portfolio', 'operating strategy version', 'seller intake', 'buyer intake', 'opportunity version', 'match version', 'disclosure stage', 'operator', 'bilateral introduction', 'downstream stage'],
      safeguards: outcomeSafeguards(
        'Do not count a Capital case, questionnaire interest, generic lead, profile, one-sided response, disclosure, LOI, diligence event, or close claim as bilateral introduction acceptance.',
        'Never expose confidential party or business facts in learning records beyond the minimum governed references and approved attribution dimensions.'
      ),
      verifiedOutcomeRule: 'Count once when a governed seller intake, buyer intake, opportunity/disclosure version, operator-approved match, and separate seller and buyer acceptance events share one controlled introduction ID under the immutable strategy version.',
      targetOutcomeObservable: false,
      observableCurrentOutcome: {
        available: false,
        evidence: 'Capital can record business-acquisition financing context, but no confidential acquisition opportunity, match, disclosure, or bilateral response authority exists.',
        limitation: 'No governed record currently proves a qualified confidential business-acquisition intake and bilateral acceptance of an operator-controlled introduction.',
      },
      stopConditions: ['confidentiality failure', 'identity or authority dispute', 'permission withdrawal', 'unsupported valuation or financing claim', 'capacity failure', 'licensing, securities, compensation, or conflict uncertainty', 'complaint or disclosure breach'],
    },
    sourceProvenance: sourceProvenance('Capital business-acquisition financing path, historical journey interest, and missing confidential acquisition-network consumer audit'),
  },
}
