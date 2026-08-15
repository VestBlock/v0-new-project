import assert from 'node:assert/strict'

import {
  APPROVED_STRATEGY_CHANNELS,
  OPERATING_STRATEGY_VERSION_CONTRACTS,
} from '../lib/strategy/operating-contracts'
import {
  getStrategyIdentifierMapping,
  OPERATING_STRATEGY_DEFINITIONS,
  type OperatingStrategyKey,
  type StrategyDestination,
} from '../lib/strategy/registry'
import {
  buildGate3BOperatingContractManifest,
  EXPECTED_GATE_3A_OPERATING_CONTRACT_FINGERPRINTS,
  serializeGate3BOperatingContractManifest,
  serializeGate3BOperatingContractUpdateSql,
} from './generate-gate3b-operating-contract-manifest'

const expectedDestinations = {
  capital_readiness_intake: {
    mode: 'public_route', path: '/capital', cta: 'Start your capital readiness review',
  },
  seller_options_intake: {
    mode: 'public_route', path: '/sell', cta: 'Review my selling options',
  },
  property_opportunity_discovery: { mode: 'internal_only', path: null, cta: null },
  buyer_buy_box_activation: {
    mode: 'public_route', path: '/workspace/profiles/new?role=buyer', cta: 'Create your free buyer profile',
  },
  lender_provider_criteria: {
    mode: 'public_route', path: '/workspace/profiles/new?role=lender', cta: 'Add your lending criteria',
  },
  next_move_free_roadmap: {
    mode: 'public_route', path: '/next-move', cta: 'Build my free Next Move roadmap',
  },
  credit_education_support: {
    mode: 'public_route', path: '/credit-upload', cta: 'Review my credit report and build an action plan',
  },
  business_formation_readiness: {
    mode: 'public_route', path: '/next-move?focus=start-business', cta: 'Build my business readiness roadmap',
  },
  dealvault_activation: {
    mode: 'public_route', path: '/dealvault/demo', cta: 'Request a private demo',
  },
  service_provider_network: {
    mode: 'public_route', path: '/workspace/profiles/new?role=service_provider', cta: 'Create your service provider profile',
  },
  partner_referral_network: { mode: 'unresolved', path: null, cta: null },
  investor_capital_relationships: {
    mode: 'public_route', path: '/workspace/profiles/new?role=investor', cta: 'Create your real estate investor profile',
  },
  public_sector_opportunity_readiness: { mode: 'internal_only', path: null, cta: null },
  professional_participant_activation: {
    mode: 'public_route', path: '/workspace/profiles', cta: 'Create your free participant profile',
  },
  content_authority_intelligence: {
    mode: 'public_route', path: '/next-move', cta: 'Build my free Next Move roadmap',
  },
  customer_lifecycle_orchestration: { mode: 'internal_only', path: null, cta: null },
  business_acquisition_network: { mode: 'unresolved', path: null, cta: null },
} as const satisfies Record<OperatingStrategyKey, StrategyDestination>

const expectedKeys = Object.keys(expectedDestinations).sort() as OperatingStrategyKey[]

const nonblank = (value: string, message: string) => {
  assert.equal(typeof value, 'string', message)
  assert.ok(value.trim().length > 0, message)
}

const nonblankArray = (values: readonly string[], message: string) => {
  assert.ok(Array.isArray(values), message)
  assert.ok(values.length > 0, message)
  assert.equal(new Set(values).size, values.length, `${message} must not contain duplicates.`)
  for (const value of values) nonblank(value, message)
}

const fingerprint = (value: unknown) => JSON.stringify(value)

const allReachable = (initial: string, adjacency: Map<string, Set<string>>) => {
  const reached = new Set([initial])
  const queue = [initial]
  while (queue.length > 0) {
    const state = queue.shift()!
    for (const next of adjacency.get(state) ?? []) {
      if (!reached.has(next)) {
        reached.add(next)
        queue.push(next)
      }
    }
  }
  return reached
}

const canReachTerminal = (
  start: string,
  terminalStates: ReadonlySet<string>,
  adjacency: Map<string, Set<string>>
) => {
  const visited = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    const state = queue.shift()!
    if (terminalStates.has(state)) return true
    for (const next of adjacency.get(state) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return false
}

const contractKeys = Object.keys(OPERATING_STRATEGY_VERSION_CONTRACTS).sort()
const registryKeys = OPERATING_STRATEGY_DEFINITIONS.map(({ key }) => key).sort()
assert.deepEqual(contractKeys, expectedKeys)
assert.deepEqual(contractKeys, registryKeys)
assert.equal(contractKeys.length, 17)

const destinationCounts = new Map<string, number>()
const lifecycleFingerprints = new Map<string, OperatingStrategyKey>()
const cadenceFingerprints = new Map<string, OperatingStrategyKey>()
const indicatorFingerprints = new Map<string, OperatingStrategyKey>()
const contractFingerprints = new Map<string, OperatingStrategyKey>()
const thresholdProfiles = new Set<string>()
const exposureMinimums = new Set<number>()

const gate3AGenericStates = [
  'draft', 'submitted', 'needs_information', 'under_review', 'ready',
  'active', 'completed', 'declined', 'withdrawn',
]
const gate3AGenericIndicators = [
  'eligible records', 'complete intakes or profiles', 'operator reviews', 'accepted handoffs',
]

const transitionSignature = (transition: { from: string; event: string; to: string }) =>
  `${transition.from}->${transition.event}->${transition.to}`

const capitalLifecycle = OPERATING_STRATEGY_VERSION_CONTRACTS.capital_readiness_intake.lifecycleContract
assert.deepEqual(capitalLifecycle.persistedStates, [
  'draft',
  'submitted',
  'needs_information',
  'under_review',
  'readiness_plan',
  'ready_for_provider_review',
  'provider_review',
  'approved',
  'declined',
  'withdrawn',
  'closed',
])
assert.deepEqual(
  capitalLifecycle.transitions
    .filter((transition) => transition.persistence === 'current')
    .map(transitionSignature),
  [
    'draft->participant_submits_draft->submitted',
    'draft->participant_withdraws_draft->withdrawn',
    'submitted->submitted_case_needs_information->needs_information',
    'submitted->operator_accepts_submitted_review->under_review',
    'submitted->participant_withdraws_submitted_case->withdrawn',
    'needs_information->participant_resubmits_information->submitted',
    'needs_information->operator_accepts_received_information->under_review',
    'needs_information->participant_withdraws_information_case->withdrawn',
    'under_review->operator_finds_material_gap->needs_information',
    'under_review->operator_prepares_readiness_plan->readiness_plan',
    'under_review->operator_confirms_direct_review_readiness->ready_for_provider_review',
    'under_review->operator_declines_review_case->declined',
    'under_review->participant_withdraws_review_case->withdrawn',
    'readiness_plan->readiness_plan_finds_new_gap->needs_information',
    'readiness_plan->readiness_plan_returns_to_review->under_review',
    'readiness_plan->readiness_plan_requirements_met->ready_for_provider_review',
    'readiness_plan->readiness_plan_closed->closed',
    'readiness_plan->participant_withdraws_readiness_plan->withdrawn',
    'ready_for_provider_review->provider_review_authorized->provider_review',
    'ready_for_provider_review->provider_readiness_gap_reopens_plan->readiness_plan',
    'ready_for_provider_review->ready_case_declined->declined',
    'ready_for_provider_review->participant_withdraws_ready_case->withdrawn',
    'provider_review->provider_confirms_approval->approved',
    'provider_review->provider_confirms_decline->declined',
    'provider_review->provider_requests_information->needs_information',
    'provider_review->participant_withdraws_provider_review->withdrawn',
    'approved->approved_case_closed->closed',
    'declined->declined_case_returns_to_readiness->readiness_plan',
    'declined->declined_case_closed->closed',
    'withdrawn->withdrawn_case_closed->closed',
  ]
)

const sellerLifecycle = OPERATING_STRATEGY_VERSION_CONTRACTS.seller_options_intake.lifecycleContract
assert.deepEqual(sellerLifecycle.persistedStates, [
  'draft',
  'submitted',
  'needs_information',
  'under_review',
  'options_review',
  'declined',
  'withdrawn',
  'closed',
])
assert.deepEqual(
  sellerLifecycle.transitions
    .filter((transition) => transition.persistence === 'current')
    .map(transitionSignature),
  [
    'draft->seller_submits_case->submitted',
    'draft->seller_withdraws_draft->withdrawn',
    'submitted->required_information_missing->needs_information',
    'submitted->operator_accepts_review->under_review',
    'submitted->seller_withdraws_submitted_case->withdrawn',
    'needs_information->seller_resubmits_information->submitted',
    'needs_information->information_received->under_review',
    'needs_information->seller_withdraws_information_case->withdrawn',
    'under_review->new_material_gap_found->needs_information',
    'under_review->operator_opens_options_review->options_review',
    'under_review->operator_declines_case->declined',
    'under_review->seller_withdraws_review_case->withdrawn',
    'options_review->options_review_needs_information->needs_information',
    'options_review->options_review_reopens_review->under_review',
    'options_review->options_review_declined->declined',
    'options_review->seller_withdraws_options_review->withdrawn',
    'options_review->options_review_closed->closed',
    'declined->declined_case_closed->closed',
    'withdrawn->withdrawn_case_closed->closed',
  ]
)

const participantLifecycle =
  OPERATING_STRATEGY_VERSION_CONTRACTS.professional_participant_activation.lifecycleContract
assert.deepEqual(participantLifecycle.persistedStates, [
  'draft',
  'pending_review',
  'needs_information',
  'active',
  'paused',
  'declined',
  'withdrawn',
  'archived',
])
for (const selfEvent of [
  { event: 'owner_resubmits_pending_profile', state: 'pending_review' },
  { event: 'operator_reissues_information_request', state: 'needs_information' },
]) {
  assert.ok(
    !participantLifecycle.transitions.some((transition) =>
      transition.event === selfEvent.event && transition.from === transition.to
    ),
    `${selfEvent.event} is a persisted idempotent event, not a lifecycle transition.`
  )
  assert.ok(
    participantLifecycle.persistedEvents.some((event) =>
      event.includes(selfEvent.event)
      && /idempotent/i.test(event)
      && new RegExp(`${selfEvent.state}|state (?:does not change|remains)`, 'i').test(event)
    ),
    `${selfEvent.event} must be documented as an idempotent persisted event with no state change.`
  )
}

assert.equal(
  OPERATING_STRATEGY_VERSION_CONTRACTS.professional_participant_activation.destination.path,
  '/workspace/profiles'
)
const lenderInvestorHandoff =
  OPERATING_STRATEGY_VERSION_CONTRACTS.lender_provider_criteria.operatingContract.crossLaneRoutes
    .find((route) => route.to === 'investor_capital_relationships')
assert.ok(lenderInvestorHandoff)
assert.match(lenderInvestorHandoff.trigger, /verified real-estate investor/i)
assert.match(lenderInvestorHandoff.handoff, /broader capital-partner intent remains in operator review/i)

const participantInvestorHandoff =
  OPERATING_STRATEGY_VERSION_CONTRACTS.professional_participant_activation.operatingContract.crossLaneRoutes
    .find((route) => route.to === 'investor_capital_relationships')
assert.ok(participantInvestorHandoff)
assert.match(participantInvestorHandoff.trigger, /real-estate investor profile/i)
assert.match(participantInvestorHandoff.handoff, /broader capital-partner intent remains an operator task/i)

const contentContract = OPERATING_STRATEGY_VERSION_CONTRACTS.content_authority_intelligence
const humanReviewPublicationGuard = contentContract.operatingContract.integrationDependencies
  .find((dependency) => dependency.integration === 'Human-review publication guard')
assert.ok(humanReviewPublicationGuard)
assert.equal(humanReviewPublicationGuard.status, 'blocked')
assert.equal(humanReviewPublicationGuard.requiredBeforeActivation, true)
assert.match(humanReviewPublicationGuard.evidence, /ready asset directly to published.*auto-publish/i)
assert.ok(
  contentContract.operatingContract.activationReadiness.blockers.some((blocker) =>
    /ready-to-published.*auto-publish.*human review/i.test(blocker)
  ),
  'Content activation must remain blocked by the current review-bypassing publication path.'
)

for (const [capitalPath, owner] of Object.entries({
  capital_provider: 'lender_provider_criteria',
  business_credit: 'business_formation_readiness',
  business_acquisition: 'business_acquisition_network',
} satisfies Record<string, OperatingStrategyKey>)) {
  assert.equal(
    getStrategyIdentifierMapping('capital_path', capitalPath)?.operatingStrategy,
    owner,
    `${capitalPath} must remain owned by ${owner}.`
  )
}

for (const definition of OPERATING_STRATEGY_DEFINITIONS) {
  const key = definition.key
  const contract = OPERATING_STRATEGY_VERSION_CONTRACTS[key]
  assert.ok(contract, `Missing Gate 3B contract for ${key}.`)
  assert.equal(contract.strategyKey, key)
  assert.equal(contract.version, 1)
  assert.equal(contract.versionStatus, 'draft')
  assert.ok(['no_send', 'internal_only', 'inactive'].includes(contract.executionMode))
  assert.equal(contract.externalSendCap, 0)
  assert.equal(contract.activation.externalActivation, 'blocked')
  nonblankArray(contract.activation.blockers, `${key} activation blockers`)
  assert.ok(
    contract.activation.blockers.some((blocker) => /no founder-approved activation event/i.test(blocker)),
    `${key} must disclose that it has no activation approval.`
  )
  assert.equal(contract.ownerContract.dispatchAuthority, 'none_in_gate_3b')
  assert.deepEqual(contract.destination, expectedDestinations[key])
  assert.deepEqual(contract.destination, definition.destination)
  destinationCounts.set(contract.destination.mode, (destinationCounts.get(contract.destination.mode) ?? 0) + 1)
  if (contract.destination.mode === 'public_route') {
    assert.match(contract.destination.path, /^\//)
    nonblank(contract.destination.cta, `${key} CTA`)
  } else {
    assert.equal(contract.destination.path, null)
    assert.equal(contract.destination.cta, null)
  }

  const operating = contract.operatingContract
  for (const [field, value] of Object.entries({
    objective: operating.objective,
    targetParticipant: operating.targetParticipant,
    problem: operating.problem,
    valueExchange: operating.valueExchange,
    offer: operating.offer,
  })) nonblank(value, `${key} ${field}`)
  for (const [field, values] of Object.entries({
    eligibilityCriteria: operating.eligibilityCriteria,
    disqualificationCriteria: operating.disqualificationCriteria,
    prioritizationRules: operating.prioritizationRules,
    sourceData: operating.sourceData,
    channelSelectionRules: operating.channelSelectionRules,
    followupCadence: operating.followupCadence,
    nurtureRules: operating.nurtureRules,
    reactivationRules: operating.reactivationRules,
    humanApprovalPoints: operating.humanApprovalPoints,
    complianceLimits: operating.complianceLimits,
    learningInputs: operating.learningInputs,
    failureConditions: operating.failureConditions,
    stopRules: operating.stopRules,
    handoffRules: operating.handoffRules,
  })) nonblankArray(values, `${key} ${field}`)
  nonblankArray(operating.primaryChannels, `${key} primary channels`)
  assert.ok(Array.isArray(operating.secondaryChannels))
  for (const channel of [...operating.primaryChannels, ...operating.secondaryChannels]) {
    assert.ok(APPROVED_STRATEGY_CHANNELS.includes(channel))
  }
  assert.ok(operating.sourceDataRequirements.length > 0, `${key} needs sourced-data requirements.`)
  for (const source of operating.sourceDataRequirements) {
    nonblank(source.source, `${key} source name`)
    nonblank(source.authority, `${key} source authority`)
    nonblankArray(source.requiredEvidence, `${key} source evidence`)
    nonblank(source.freshnessRule, `${key} source freshness`)
  }
  assert.ok(operating.cadenceSteps.length > 0, `${key} needs structured cadence steps.`)
  for (const step of operating.cadenceSteps) {
    nonblank(step.timing, `${key} cadence timing`)
    nonblank(step.purpose, `${key} cadence purpose`)
    nonblank(step.condition, `${key} cadence condition`)
    assert.ok(step.channels.length > 0, `${key} cadence step needs an approved channel.`)
    for (const channel of step.channels) assert.ok(APPROVED_STRATEGY_CHANNELS.includes(channel))
  }
  for (const route of operating.crossLaneRoutes) {
    assert.ok(expectedKeys.includes(route.to))
    assert.notEqual(route.to, key)
    nonblank(route.trigger, `${key} cross-lane trigger`)
    nonblank(route.handoff, `${key} cross-lane handoff`)
    assert.equal(route.requiresReceivingStrategyAcceptance, true)
  }
  assert.ok(operating.integrationDependencies.length > 0, `${key} needs integration evidence.`)
  const blockingDependencies = operating.integrationDependencies.filter(
    (dependency) => dependency.requiredBeforeActivation && dependency.status !== 'available'
  )
  assert.ok(blockingDependencies.length > 0, `${key} needs an explicit integration blocker.`)
  for (const dependency of operating.integrationDependencies) {
    nonblank(dependency.integration, `${key} integration name`)
    nonblank(dependency.evidence, `${key} integration evidence`)
    assert.equal(typeof dependency.requiredBeforeActivation, 'boolean')
  }
  assert.equal(operating.activationReadiness.status, 'blocked')
  nonblankArray(operating.activationReadiness.blockers, `${key} readiness blockers`)
  assert.equal(operating.versionDecisionRule.requiredCompleteWindows, 2)
  assert.equal(operating.versionDecisionRule.autonomousMaterialChange, false)

  const lifecycle = contract.lifecycleContract
  nonblankArray(lifecycle.states, `${key} lifecycle states`)
  nonblankArray(lifecycle.terminalStates, `${key} lifecycle terminal states`)
  nonblankArray(lifecycle.cadence, `${key} lifecycle cadence`)
  nonblankArray(lifecycle.stopConditions, `${key} lifecycle stop conditions`)
  nonblank(lifecycle.initialState, `${key} lifecycle initial state`)
  nonblank(lifecycle.recordAuthority, `${key} lifecycle record authority`)
  assert.ok(lifecycle.states.includes(lifecycle.initialState))
  assert.ok(!lifecycle.terminalStates.includes(lifecycle.initialState))

  const terminalStateSet = new Set(lifecycle.terminalStates)
  const persistedStateSet = new Set(lifecycle.persistedStates)
  const targetOnlySet = new Set(lifecycle.targetOnlyStages)
  assert.ok(Array.isArray(lifecycle.persistedEvents))
  assert.equal(new Set(lifecycle.persistedEvents).size, lifecycle.persistedEvents.length)
  for (const eventAuthority of lifecycle.persistedEvents) {
    nonblank(eventAuthority, `${key} persisted-event authority`)
  }
  if (lifecycle.persistedStates.length > 0) {
    assert.ok(lifecycle.persistedEvents.length > 0, `${key} persisted states require an event authority.`)
  }
  assert.deepEqual(Object.keys(lifecycle.stateNotes).sort(), [...lifecycle.states].sort())
  assert.deepEqual(
    [...new Set([...lifecycle.persistedStates, ...lifecycle.targetOnlyStages])].sort(),
    [...lifecycle.states].sort(),
    `${key} must classify every lifecycle state as persisted or target-only.`
  )
  for (const state of lifecycle.states) {
    const note = lifecycle.stateNotes[state]
    nonblank(note, `${key} note for ${state}`)
    assert.ok(persistedStateSet.has(state) !== targetOnlySet.has(state))
    if (persistedStateSet.has(state)) assert.match(note, /persist|current|stored|record|table|source/i)
    else assert.match(note, /target|future|not (?:yet )?persisted|planned/i)
  }

  assert.ok(lifecycle.transitions.length > 0, `${key} needs lifecycle transitions.`)
  const transitionEdges = new Set<string>()
  const adjacency = new Map(lifecycle.states.map((state) => [state, new Set<string>()]))
  for (const transition of lifecycle.transitions) {
    assert.ok(lifecycle.states.includes(transition.from))
    assert.ok(lifecycle.states.includes(transition.to))
    assert.notEqual(transition.from, transition.to)
    assert.ok(!terminalStateSet.has(transition.from), `${key} terminal states cannot transition outward.`)
    nonblank(transition.event, `${key} transition event`)
    const transitionEdge = `${transition.from}:${transition.event}:${transition.to}`
    assert.ok(!transitionEdges.has(transitionEdge), `${key} lifecycle contains a duplicate transition.`)
    transitionEdges.add(transitionEdge)
    adjacency.get(transition.from)!.add(transition.to)
    if (transition.persistence === 'current') {
      assert.ok(persistedStateSet.has(transition.from))
      assert.ok(persistedStateSet.has(transition.to))
    } else {
      assert.ok(
        targetOnlySet.has(transition.from) || targetOnlySet.has(transition.to),
        `${key} target-only transition must touch a disclosed target-only stage.`
      )
    }
  }
  const reachable = allReachable(lifecycle.initialState, adjacency)
  assert.deepEqual([...reachable].sort(), [...lifecycle.states].sort(), `${key} has unreachable states.`)
  for (const state of lifecycle.states) {
    if (!terminalStateSet.has(state)) {
      assert.ok(canReachTerminal(state, terminalStateSet, adjacency), `${key} ${state} cannot reach a terminal state.`)
    }
  }

  const lifecycleFingerprint = fingerprint({
    states: lifecycle.states, transitions: lifecycle.transitions, terminalStates: lifecycle.terminalStates,
  })
  const cadenceFingerprint = fingerprint({
    followupCadence: operating.followupCadence,
    cadenceSteps: operating.cadenceSteps,
    lifecycleCadence: lifecycle.cadence,
  })
  const indicatorFingerprint = fingerprint(contract.outcomeContract.leadingIndicators)
  const contractFingerprint = fingerprint({
    objective: operating.objective,
    participant: operating.targetParticipant,
    offer: operating.offer,
    eligibility: operating.eligibilityCriteria,
    conversion: contract.outcomeContract.primaryConversionEvent,
  })
  assert.ok(!lifecycleFingerprints.has(lifecycleFingerprint), `${key} repeats another lifecycle.`)
  assert.ok(!cadenceFingerprints.has(cadenceFingerprint), `${key} repeats another cadence.`)
  assert.ok(!indicatorFingerprints.has(indicatorFingerprint), `${key} repeats another indicator set.`)
  assert.ok(!contractFingerprints.has(contractFingerprint), `${key} repeats another operating contract.`)
  lifecycleFingerprints.set(lifecycleFingerprint, key)
  cadenceFingerprints.set(cadenceFingerprint, key)
  indicatorFingerprints.set(indicatorFingerprint, key)
  contractFingerprints.set(contractFingerprint, key)
  assert.notDeepEqual(lifecycle.states, gate3AGenericStates)
  assert.notDeepEqual(contract.outcomeContract.leadingIndicators, gate3AGenericIndicators)

  const owner = contract.ownerContract
  assert.equal(owner.crmAuthority, definition.crmOwner)
  assert.equal(owner.automationRole, definition.automationOwner)
  nonblank(owner.recordOwner, `${key} record owner`)
  nonblank(owner.humanOwner, `${key} human owner`)
  nonblankArray(owner.handoffRules, `${key} owner handoff rules`)

  const outcome = contract.outcomeContract
  nonblank(outcome.primaryConversionEvent, `${key} primary conversion event`)
  nonblank(outcome.businessValue, `${key} business value`)
  nonblankArray(outcome.leadingIndicators, `${key} leading indicators`)
  nonblankArray(outcome.learningInputs, `${key} outcome learning inputs`)
  nonblankArray(outcome.attributionDimensions, `${key} outcome attribution dimensions`)
  nonblankArray(outcome.safeguards, `${key} outcome safeguards`)
  nonblankArray(outcome.stopConditions, `${key} outcome stop conditions`)
  nonblank(outcome.exposureUnit, `${key} exposure unit`)
  nonblank(outcome.verifiedOutcomeRule, `${key} verified outcome rule`)
  nonblank(outcome.observableCurrentOutcome.evidence, `${key} current outcome evidence`)
  nonblank(outcome.observableCurrentOutcome.limitation, `${key} current outcome limitation`)
  assert.ok(Number.isInteger(outcome.minimumExposure) && outcome.minimumExposure > 1)
  assert.ok(Number.isInteger(outcome.minimumPrimaryConversions) && outcome.minimumPrimaryConversions > 0)
  assert.ok(outcome.minimumPrimaryConversions <= outcome.minimumExposure)
  assert.ok(Number.isInteger(outcome.learningWindowDays) && outcome.learningWindowDays > 0)
  assert.equal(outcome.requiredCompleteWindows, 2)
  assert.equal(outcome.targetOutcomeObservable, outcome.observableCurrentOutcome.available)
  if (!outcome.targetOutcomeObservable) {
    assert.ok(
      contract.activation.blockers.some((blocker) =>
        /target-only|not currently observable|not observable|unobservable|not (?:yet )?persisted|not joined|cannot (?:yet )?prove|\bno\b.{0,120}\b(?:authority|record|event|model|destination)\b|missing|incomplete/i.test(blocker)
      ),
      `${key} must make its unobservable target outcome an activation blocker.`
    )
  }
  thresholdProfiles.add(
    `${outcome.learningWindowDays}:${outcome.minimumExposure}:${outcome.exposureUnit}:${outcome.minimumPrimaryConversions}`
  )
  exposureMinimums.add(outcome.minimumExposure)

  assert.ok(contract.sourceProvenance.length > 0)
  for (const source of contract.sourceProvenance) {
    nonblank(source.source, `${key} provenance source`)
    nonblank(source.kind, `${key} provenance kind`)
    assert.equal(source.observedAt, '2026-08-15')
  }
}

assert.deepEqual(Object.fromEntries(destinationCounts), { public_route: 12, internal_only: 3, unresolved: 2 })
assert.equal(lifecycleFingerprints.size, 17)
assert.equal(cadenceFingerprints.size, 17)
assert.equal(indicatorFingerprints.size, 17)
assert.equal(contractFingerprints.size, 17)
assert.ok(exposureMinimums.size >= 4, 'Gate 3B must not reuse one generic exposure threshold.')
assert.ok(thresholdProfiles.size >= 9, 'Gate 3B needs lane-specific measurement profiles.')

const manifest = buildGate3BOperatingContractManifest()
assert.equal(manifest.generator_database_write, false)
assert.equal(manifest.activation_policy, 'draft_only_no_external_send')
assert.equal(manifest.contracts.length, 17)
assert.deepEqual(Object.keys(EXPECTED_GATE_3A_OPERATING_CONTRACT_FINGERPRINTS).sort(), expectedKeys)
const serializedManifest = serializeGate3BOperatingContractManifest()
assert.equal(serializedManifest, serializeGate3BOperatingContractManifest())
assert.doesNotMatch(serializedManifest, /generated_at|generatedAt/)
for (const row of manifest.contracts) {
  assert.match(row.expected_prior_fingerprint, /^[a-f0-9]{32}$/)
  assert.equal(
    row.expected_prior_fingerprint,
    EXPECTED_GATE_3A_OPERATING_CONTRACT_FINGERPRINTS[row.strategy_key]
  )
  assert.equal(row.required_current_status, 'draft')
  assert.equal(row.external_send_cap, 0)
  assert.equal(row.external_activation, 'blocked')
}

const updateSql = serializeGate3BOperatingContractUpdateSql()
assert.equal(updateSql, serializeGate3BOperatingContractUpdateSql())
assert.match(updateSql, /UPDATE public\.operating_strategy_versions version/)
assert.match(updateSql, /version\.version = 1/)
assert.match(updateSql, /version\.status = 'draft'/)
assert.match(updateSql, /previously active or retired history/)
assert.match(updateSql, /private\.gate3b_operating_contract_fingerprint\(strategy_version\)/)
assert.match(updateSql, /Gate 3B did not update exactly 17 untouched version-1 drafts/)
assert.match(updateSql, /all 17 contracts unapproved, inactive, and zero-send/)
assert.match(updateSql, /n8n live sending to remain disabled/)
assert.match(updateSql, /manifest\.external_send_cap = 0/)
assert.doesNotMatch(updateSql, /NOW\(\)|CURRENT_TIMESTAMP|generated_at|generatedAt/)
for (const fingerprint of Object.values(EXPECTED_GATE_3A_OPERATING_CONTRACT_FINGERPRINTS)) {
  assert.ok(updateSql.includes(fingerprint))
}

console.log(JSON.stringify({
  ok: true,
  gate: '3B',
  strategies: contractKeys.length,
  destinationModes: Object.fromEntries(destinationCounts),
  uniqueLifecycles: lifecycleFingerprints.size,
  uniqueCadences: cadenceFingerprints.size,
  uniqueIndicatorSets: indicatorFingerprints.size,
  thresholdProfiles: thresholdProfiles.size,
  generatorDatabaseWrite: manifest.generator_database_write,
}, null, 2))
