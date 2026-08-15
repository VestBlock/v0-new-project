import { OPERATING_STRATEGY_VERSION_CONTRACTS } from '@/lib/strategy/operating-contracts'

export const GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT =
  'efa545b486dd79f4b4c9e0c429398448c028d0fe' as const

export const GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT =
  '74c3fb77e802a30d001db78e48e21747' as const

// Filled from private.gate3b_operating_contract_fingerprint in the rollback-only
// database rehearsal. The migration refuses to commit unless PostgreSQL
// produces this exact fingerprint from this source manifest.
export const GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT =
  'b321ad591bffc099f3197a84c5c38028' as const

export const GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY =
  'gate3d1-seller-positive-inbound-reply-v1' as const

export const GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE =
  'gate3d1_graph_reply_v1' as const

export const GATE3D1_SELLER_REPLY_CANARY_PURPOSE =
  'seller_reply_followup' as const

const historicalSellerContract =
  OPERATING_STRATEGY_VERSION_CONTRACTS.seller_options_intake

/**
 * A prepared draft, not an activation or send grant.
 *
 * This overlay deliberately narrows version 1 to one founder-authorized,
 * positive-inbound, exact-same-thread Outlook reply. It does not authorize a
 * new thread, sourced first contact, sequence, fallback provider, or a second
 * recipient. Broader seller outreach requires a separately reviewed version.
 */
export const GATE3D1_SELLER_REPLY_CANARY_CANDIDATE = Object.freeze({
  strategyKey: 'seller_options_intake',
  version: 1,
  versionStatus: 'draft',
  executionMode: 'approved_live',
  destination: historicalSellerContract.destination,
  externalSendCap: 1,
  activation: Object.freeze({
    externalActivation: 'pending_founder_review',
    blockers: Object.freeze([
      'Draft preparation does not activate this version; an exact authenticated founder review and activation decision are still required.',
      'The global and seller-strategy outbound controls remain engaged until the authenticated founder separately releases them for the one-recipient canary.',
    ]),
  }),
  operatingContract: Object.freeze({
    ...historicalSellerContract.operatingContract,
    offer:
      'One human-reviewed continuation of an owner\'s positive inbound property reply, sent only in the exact Microsoft Outlook thread for the identified property and purpose.',
    eligibilityCriteria: Object.freeze([
      'The sender is the exact lead associated with the identified property and has provided a positive, non-automatic inbound reply in the VestBlock acquisitions mailbox.',
      'An authenticated founder reviewed the inbound reply and the exact authored response, then issued an unexpired one-shot continuation authorization.',
      'The mailbox object, immutable inbound message, conversation, Internet Message-ID, recipient, property, purpose, message version, and content fingerprints all match the authorization.',
      'Suppression, opt-out, complaint, bounce, identity, newer-reply, quiet-hours, capacity, writer-release, and both kill-switch checks pass immediately before send.',
    ]),
    disqualificationCriteria: Object.freeze([
      'The inbound item is automatic, operational, spam, ambiguous, negative, an opt-out, or has not been positively classified by the founder.',
      'Any mailbox, message, conversation, sender, property, purpose, content, strategy, authorization, or writer-release identity is missing, stale, reused, or mismatched.',
      'A newer reply, suppression, complaint, bounce, identity conflict, property conflict, expired or revoked authorization, consumed canary, closed control, or out-of-window time is present.',
    ]),
    prioritizationRules: Object.freeze([
      'This candidate contains exactly one pinned recipient and one reviewed inbound thread; no ranking or batch selection is authorized.',
      'A founder-reviewed positive inbound continuation takes precedence only for its exact property and purpose.',
      'Any ambiguity is quarantined for manual review and receives no automated fallback.',
    ]),
    sourceData: Object.freeze([
      'command_center_reply_memory immutable Microsoft Graph thread evidence',
      'private one-shot inbound-reply continuation authorization',
      'leads property and recipient identity',
      'governed outbound enrollment, dispatch reservation, and strategy activity ledgers',
    ]),
    sourceDataRequirements: Object.freeze([
      {
        source: 'Immutable Microsoft Graph inbound reply',
        authority: 'The acquisitions mailbox item retrieved with Prefer: IdType="ImmutableId"',
        requiredEvidence: Object.freeze([
          'tenant and sender application identity',
          'mailbox object and address',
          'immutable inbound message ID',
          'conversation ID',
          'inbound Internet Message-ID',
          'sender and recipient identity',
          'received timestamp',
          'human positive-reply review',
        ]),
        freshnessRule:
          'Refetch the exact item and reject any identity mismatch or newer sender reply immediately before creating or sending the reply draft.',
      },
      {
        source: 'Founder-issued one-shot continuation authorization',
        authority: 'Authenticated founder RPC with append-only authorization, revocation, claim, and outcome evidence',
        requiredEvidence: Object.freeze([
          'authorization ID and fingerprint',
          'reply-memory and lead IDs',
          'property reference and seller_reply_followup purpose',
          'approved authored-content fingerprint and message version',
          'approval and expiry timestamps',
          'one-shot claim and reconciliation state',
        ]),
        freshnessRule:
          'Authorization must be unexpired, unrevoked, unconsumed, and reasserted with both outbound controls and the exact writer release immediately before provider send.',
      },
    ]),
    primaryChannels: Object.freeze(['operator_task'] as const),
    secondaryChannels: Object.freeze(['outlook_graph', 'no_outreach'] as const),
    channelSelectionRules: Object.freeze([
      'Only outlook_graph may dispatch, by createReply on the exact immutable inbound message followed by send of the persisted immutable reply draft.',
      'No Resend, Gmail, new-message, manual-recipient, CC, BCC, forwarding, batch, provider fallback, or n8n live-send path is authorized.',
      'The exact authored comment is fingerprinted before founder approval and must be byte-for-byte equivalent after canonical trimming at execution.',
    ]),
    followupCadence: Object.freeze([
      'One founder-authorized same-thread reply during the pinned recipient-local business window, then stop.',
    ]),
    cadenceSteps: Object.freeze([
      {
        timing: 'before any provider mutation',
        purpose: 'Review the positive inbound reply, property identity, exact authored response, authorization, and all stop controls.',
        channels: Object.freeze(['operator_task'] as const),
        condition: 'The candidate remains draft or the founder has not completed every activation and release control.',
      },
      {
        timing: 'one time during the approved local business window',
        purpose: 'Continue the exact positive inbound seller conversation without opening a new outreach thread.',
        channels: Object.freeze(['outlook_graph'] as const),
        condition: 'The active cap-one version, one-shot authorization, reservation, quiet-hours rule, immutable thread, and both outbound controls pass immediately before send.',
      },
    ]),
    nurtureRules: Object.freeze([
      'No nurture sequence, unanswered follow-up, cross-sell, or second message is authorized by this canary.',
      'Any later communication requires a new customer action and a separately approved strategy version and authorization.',
    ]),
    reactivationRules: Object.freeze([
      'This one-recipient canary cannot reactivate automatically.',
      'An ambiguous provider outcome requires exact immutable-ID reconciliation; it must never create or send a replacement reply automatically.',
    ]),
    humanApprovalPoints: Object.freeze([
      'Positive, non-automatic inbound classification',
      'Exact lead, property, mailbox, thread, and purpose identity',
      'Exact authored response and message-version fingerprint',
      'Version activation and both outbound-control releases',
      'Any ambiguous provider result or callback attribution',
    ]),
    complianceLimits: Object.freeze([
      ...historicalSellerContract.operatingContract.complianceLimits,
      'A positive inbound reply authorizes only the exact reviewed continuation; it is not blanket marketing consent and cannot support another purpose, property, recipient, or thread.',
      'Send only in the stored recipient-local weekday business window and stop immediately on any newer reply or suppression signal.',
    ]),
    learningInputs: Object.freeze([
      'authorization and content fingerprints',
      'immutable inbound and outbound thread identities',
      'provider draft, send, and reconciliation state',
      'seller callback and exact In-Reply-To attribution',
      'stop-control and suppression outcomes',
    ]),
    failureConditions: Object.freeze([
      'Any identity, fingerprint, authorization, writer, reservation, or control mismatch',
      'Duplicate draft or send ambiguity without exact reconciliation',
      'Newer reply, suppression, opt-out, complaint, bounce, or quiet-hours failure',
      'Provider fallback, new-thread composition, or a second recipient or send',
    ]),
    stopRules: Object.freeze([
      ...historicalSellerContract.operatingContract.stopRules,
      'Stop after the single provider send is accepted or becomes ambiguous; re-engage the global and strategy controls before any evaluation.',
      'Stop and quarantine when exact immutable callback attribution cannot be proven by mailbox, conversation, sender, recipient, and In-Reply-To identities.',
    ]),
    integrationDependencies: Object.freeze([
      {
        integration: 'Gate 3D.1 selective canonical binding and writer enforcement',
        status: 'available',
        evidence: 'The canary control migrations bind the one strategy version, exact writer release, reservation, runtime rows, and global and strategy kill switches.',
        requiredBeforeActivation: true,
      },
      {
        integration: 'Scoped Microsoft Graph same-thread reply adapter',
        status: 'available',
        evidence: 'The dedicated application uses Exchange Application RBAC for the acquisitions mailbox, immutable IDs, createReply, persisted draft identity, and no fallback.',
        requiredBeforeActivation: true,
      },
      {
        integration: 'Founder-reviewed positive-inbound continuation authority',
        status: 'available',
        evidence: 'Append-only authorization and revocation evidence plus one-shot claim and reconciliation state bind the exact thread, property, purpose, recipient, and content.',
        requiredBeforeActivation: true,
      },
      {
        integration: 'Exact delivery and reply attribution',
        status: 'available',
        evidence: 'The governed enrollment and strategy activity ledgers persist immutable outbound identity and accept callbacks only when exact thread and In-Reply-To evidence match.',
        requiredBeforeActivation: true,
      },
    ]),
    activationReadiness: Object.freeze({
      status: 'ready',
      readyElements: Object.freeze([
        'The activation scope is one recipient, one positive inbound message, one property, one purpose, one authored response, and one Outlook same-thread send.',
        'The exact writer release and both fail-closed outbound controls are executable database invariants.',
        'Founder authorization, immutable Graph identity, quiet hours, suppression, reservation, one-shot consumption, and ambiguous-result reconciliation are required immediately before send.',
        'Broader seller sourcing, new-thread outreach, sequences, fallback providers, and n8n live sending remain unauthorized.',
      ]),
      blockers: Object.freeze([] as const),
    }),
    canaryScope: Object.freeze({
      manifestKey: GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
      authorizationBasis: 'positive_inbound_reply_continuation',
      purpose: GATE3D1_SELLER_REPLY_CANARY_PURPOSE,
      provider: 'outlook_graph',
      writerRelease: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
      maximumLifetimeRecipients: 1,
      maximumLifetimeSends: 1,
      exactSameThreadOnly: true,
      providerFallbackAllowed: false,
      newThreadAllowed: false,
      automaticSequenceAllowed: false,
    }),
  }),
  lifecycleContract: historicalSellerContract.lifecycleContract,
  ownerContract: Object.freeze({
    ...historicalSellerContract.ownerContract,
    dispatchAuthority: 'vestblock_application',
    recordOwner:
      'Seller case records own customer context; the governed enrollment, strategy activity, immutable Graph thread, and one-shot continuation ledgers jointly own canary dispatch evidence.',
    humanOwner:
      'The authenticated VestBlock founder owns positive-inbound classification, exact response approval, activation, outbound-control release, and ambiguous-result review.',
    handoffRules: Object.freeze([
      'No source, cron, n8n workflow, generic email adapter, or other strategy may dispatch this reply.',
      'The dedicated Graph adapter receives only the exact claimed authorization and must re-engage both outbound stops after the one canary attempt.',
    ]),
  }),
  outcomeContract: Object.freeze({
    ...historicalSellerContract.outcomeContract,
    primaryConversionEvent:
      'The exact founder-authorized same-thread seller reply is accepted by Microsoft Graph once and reconciled to its immutable outbound message identity.',
    leadingIndicators: Object.freeze([
      'positive inbound reply reviewed',
      'one-shot authorization issued',
      'dispatch reservation claimed',
      'immutable reply draft persisted',
      'provider send accepted or exactly reconciled',
      'exact seller callback attributed',
    ]),
    businessValue:
      'A controlled proof that VestBlock can continue one real seller conversation safely, with exact attribution and immediate stop authority.',
    learningInputs: Object.freeze([
      'authorization evidence',
      'content and thread fingerprints',
      'Graph draft and send state',
      'suppression and stop-control state',
      'exact callback identity',
      'operator reconciliation outcome',
    ]),
    learningWindowDays: 7,
    minimumExposure: 1,
    exposureUnit: 'founder_authorized_same_thread_reply',
    minimumPrimaryConversions: 1,
    attributionDimensions: Object.freeze([
      'operating strategy version',
      'authorization',
      'lead and property',
      'mailbox and immutable thread',
      'message version and content fingerprint',
      'writer release',
      'founder reviewer',
    ]),
    verifiedOutcomeRule:
      'Count once only when the one-shot authorization, reservation, canonical enrollment activity, immutable outbound Graph identity, provider acceptance or reconciliation, and re-engaged stop evidence all agree.',
    targetOutcomeObservable: true,
    observableCurrentOutcome: Object.freeze({
      available: true,
      evidence:
        'The one-shot authorization, dispatch reservation, governed enrollment, operating-strategy activity, and immutable Graph thread evidence persist the canary outcome.',
      limitation:
        'One canary proves only this exact continuation path and cannot justify broader seller outreach, another recipient, a new thread, or another provider.',
    }),
    stopConditions: Object.freeze([
      'one send accepted or provider result ambiguous',
      'authorization expired, revoked, or consumed',
      'identity or fingerprint mismatch',
      'suppression, complaint, bounce, opt-out, or newer reply',
      'global or strategy control engaged',
    ]),
  }),
  sourceProvenance: Object.freeze([
    ...historicalSellerContract.sourceProvenance,
    Object.freeze({
      source: 'Gate 3D.1 seller positive-inbound same-thread canary manifest',
      kind: 'gate_3d1_canary_candidate',
      observedAt: '2026-08-15',
      sourceCommit: GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT,
      manifestKey: GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
      priorFingerprint: GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT,
      writerRelease: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    }),
  ]),
} as const)
