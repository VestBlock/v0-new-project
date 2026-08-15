import {
  GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
  GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT,
  GATE3D1_SELLER_REPLY_CANARY_CANDIDATE,
  GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
  GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT,
  GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
} from '../lib/strategy/gate3d1-seller-reply-canary'

type JsonPrimitive = boolean | number | string | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export const GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS = Object.freeze({
  business_acquisition_network: 'a96aae4117fade695c15e93a903802cf',
  business_formation_readiness: '8e04e350de6912f13523248c81103762',
  buyer_buy_box_activation: '050db76162fc612456c29d9e357b713f',
  capital_readiness_intake: 'f5bad84ec7a3aa69c0801b8658771b04',
  content_authority_intelligence: '086b8447a085f8a88f2b843b548ad1da',
  credit_education_support: '06d89433fdee05d5689f156a323822ca',
  customer_lifecycle_orchestration: '470951941abfca8b6f58304e2f93ebf3',
  dealvault_activation: 'd73c205b8a67a551bec9532a69e8b804',
  investor_capital_relationships: '34be21e3c62c2444ff8f35f360fce70b',
  lender_provider_criteria: '432e0cc465f8f841949badab0693d9d3',
  next_move_free_roadmap: 'a31a6d07a6e75c31516e79c248ea1282',
  partner_referral_network: '1db7783037a719bb5ea44a203742767e',
  professional_participant_activation: '5c8f3bff2bd292fe79ddc2181d6bf7e3',
  property_opportunity_discovery: '38381df614e5c739c8de5f0bd9e3b870',
  public_sector_opportunity_readiness: '52cc09671efc4caaa4ebcf292ffdb7b7',
  service_provider_network: '0c59eae475c405662b0015b84f939dfe',
} as const)

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortJson(nested)])
    )
  }
  return value
}

export function buildGate3d1SellerReplyCanaryManifest() {
  const candidate = GATE3D1_SELLER_REPLY_CANARY_CANDIDATE
  return {
    manifest_version: 1,
    gate: '3D.1',
    manifest_key: GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
    source_commit: GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT,
    intent: 'prepare_one_reviewable_seller_reply_canary_draft_without_activation',
    expected_before_fingerprint: GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT,
    expected_after_fingerprint: GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
    required_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    required_current_status: 'draft',
    strategy_key: candidate.strategyKey,
    version: candidate.version,
    execution_mode: candidate.executionMode,
    destination_mode: candidate.destination.mode,
    destination_path: candidate.destination.path,
    cta_label: candidate.destination.cta,
    contract_json: candidate.operatingContract,
    lifecycle_contract_json: candidate.lifecycleContract,
    owner_contract_json: candidate.ownerContract,
    outcome_contract_json: candidate.outcomeContract,
    source_provenance_json: candidate.sourceProvenance,
    crm_owner_key: candidate.ownerContract.crmAuthority,
    automation_owner_key: candidate.ownerContract.automationRole,
    external_send_cap: candidate.externalSendCap,
    activation_evidence: candidate.activation,
    unchanged_gate3c_fingerprints: GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS,
  } as const
}

export function serializeGate3d1SellerReplyCanaryManifest() {
  return `${JSON.stringify(
    sortJson(buildGate3d1SellerReplyCanaryManifest() as unknown as JsonValue),
    null,
    2
  )}\n`
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function unchangedFingerprintValues() {
  return Object.entries(GATE3D1_UNCHANGED_GATE3C_FINGERPRINTS)
    .map(([strategyKey, fingerprint]) =>
      `      (${sqlLiteral(strategyKey)}, ${sqlLiteral(fingerprint)})`
    )
    .join(',\n')
}

export function serializeGate3d1SellerReplyCanaryCandidateSql() {
  const manifest = JSON.stringify(
    sortJson(buildGate3d1SellerReplyCanaryManifest() as unknown as JsonValue)
  )

  return `-- Gate 3D.1 seller same-thread reply candidate preparation.
--
-- This deterministic migration changes exactly one still-unapproved draft from
-- the reviewed Gate 3C fingerprint into a founder-reviewable cap-one candidate.
-- It does not approve or activate a version, grant reviewer authority, release
-- either outbound control, create an authorization, reserve capacity, or send.

DO $gate3d1_seller_candidate$
DECLARE
  manifest CONSTANT JSONB := $gate3d1_manifest$${manifest}$gate3d1_manifest$::JSONB;
  candidate public.operating_strategy_versions;
  candidate_id UUID;
  changed_count INTEGER;
  mismatch_count INTEGER;
BEGIN
  IF to_regclass('public.operating_strategy_outbound_controls') IS NULL
    OR to_regclass('private.inbound_reply_continuation_authorizations') IS NULL
    OR to_regprocedure(
      'public.stage_gate3d1_canary_review(uuid,text,uuid,text,text)'
    ) IS NULL
    OR to_regprocedure(
      'public.record_inbound_reply_continuation_authorization(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,time,time,smallint[],timestamptz,uuid,text,text,text)'
    ) IS NULL
    OR to_regprocedure(
      'public.claim_gate3d1_canary_dispatch(uuid,uuid,uuid,uuid,text,text,text,text,text,text)'
    ) IS NULL THEN
    RAISE EXCEPTION 'Gate 3D.1 controls, founder staging, exact continuation authority, and one-shot claim must be installed before candidate preparation.';
  END IF;

  IF manifest ->> 'source_commit' <> '${GATE3D1_SELLER_REPLY_CANARY_SOURCE_COMMIT}'
    OR manifest ->> 'manifest_key' <> '${GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY}'
    OR manifest ->> 'expected_before_fingerprint' <> '${GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT}'
    OR manifest ->> 'expected_after_fingerprint' <> '${GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT}'
    OR manifest ->> 'required_writer_release' <> '${GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE}' THEN
    RAISE EXCEPTION 'Gate 3D.1 candidate manifest identity is not the reviewed source.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND controls.enforcement_mode = 'compatibility'
      AND controls.canary_enforcement_status = 'disabled'
      AND controls.canary_operating_strategy_version_id IS NULL
      AND controls.outbound_kill_switch
  ) OR EXISTS (
    SELECT 1
    FROM public.operating_strategy_outbound_controls controls
    WHERE NOT controls.paused
  ) OR EXISTS (
    SELECT 1
    FROM public.orchestration_controls controls
    WHERE controls.integration_key = 'n8n' AND controls.live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Candidate preparation requires every outbound path to remain fail-closed.';
  END IF;

  IF (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17 THEN
    RAISE EXCEPTION 'Candidate preparation requires the exact 17-version Gate 3C registry.';
  END IF;

  WITH expected(strategy_key, fingerprint) AS (
    VALUES
${unchangedFingerprintValues()}
  )
  SELECT COUNT(*)::INTEGER INTO mismatch_count
  FROM expected
  LEFT JOIN public.operating_strategies strategy
    ON strategy.strategy_key = expected.strategy_key
  LEFT JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.version = 1
  WHERE version.id IS NULL
     OR private.gate3b_operating_contract_fingerprint(
       ROW(version.*)::public.operating_strategy_versions
     ) <> expected.fingerprint
     OR version.status <> 'draft'
     OR version.external_send_cap <> 0
     OR version.owner_contract_json ->> 'dispatchAuthority' <> 'none_in_gate_3b'
     OR version.approved_by_user_id IS NOT NULL
     OR version.approved_at IS NOT NULL
     OR version.activated_at IS NOT NULL
     OR version.retired_at IS NOT NULL;
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'A non-seller Gate 3C draft changed before candidate preparation.';
  END IF;

  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  JOIN public.operating_strategies strategy
    ON strategy.id = version.operating_strategy_id
  WHERE strategy.strategy_key = manifest ->> 'strategy_key'
    AND version.version = (manifest ->> 'version')::INTEGER
  FOR UPDATE;
  IF NOT FOUND
    OR candidate.status <> 'draft'
    OR candidate.execution_mode <> 'no_send'
    OR candidate.external_send_cap <> 0
    OR candidate.owner_contract_json ->> 'dispatchAuthority' <> 'none_in_gate_3b'
    OR candidate.approved_by_user_id IS NOT NULL
    OR candidate.approved_at IS NOT NULL
    OR candidate.activated_at IS NOT NULL
    OR candidate.retired_at IS NOT NULL
    OR candidate.supersedes_id IS NOT NULL
    OR private.gate3b_operating_contract_fingerprint(candidate)
      <> manifest ->> 'expected_before_fingerprint' THEN
    RAISE EXCEPTION 'Seller candidate no longer matches the exact untouched Gate 3C draft.';
  END IF;
  candidate_id := candidate.id;
  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_version_events event
    WHERE event.version_id = candidate_id
      AND event.event_type IN ('activated', 'retired')
  ) THEN
    RAISE EXCEPTION 'Candidate preparation cannot rewrite active or retired history.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_dispatch_reservations reservation
    WHERE reservation.operating_strategy_version_id = candidate_id
  ) OR EXISTS (
    SELECT 1 FROM public.operating_strategy_activities activity
    WHERE activity.operating_strategy_version_id = candidate_id
  ) THEN
    RAISE EXCEPTION 'Candidate preparation requires no prior runtime activity or reservation.';
  END IF;

  UPDATE public.operating_strategy_versions version
  SET execution_mode = manifest ->> 'execution_mode',
      destination_mode = manifest ->> 'destination_mode',
      destination_path = manifest ->> 'destination_path',
      cta_label = manifest ->> 'cta_label',
      contract_json = manifest -> 'contract_json',
      lifecycle_contract_json = manifest -> 'lifecycle_contract_json',
      owner_contract_json = manifest -> 'owner_contract_json',
      outcome_contract_json = manifest -> 'outcome_contract_json',
      source_provenance_json = manifest -> 'source_provenance_json',
      crm_owner_key = manifest ->> 'crm_owner_key',
      automation_owner_key = manifest ->> 'automation_owner_key',
      external_send_cap = (manifest ->> 'external_send_cap')::INTEGER
  WHERE version.id = candidate_id
    AND version.status = 'draft'
    AND private.gate3b_operating_contract_fingerprint(
      ROW(version.*)::public.operating_strategy_versions
    )
      = manifest ->> 'expected_before_fingerprint';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Candidate preparation did not update exactly one reviewed draft.';
  END IF;

  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = candidate_id;
  IF private.gate3b_operating_contract_fingerprint(candidate)
      <> manifest ->> 'expected_after_fingerprint'
    OR candidate.status <> 'draft'
    OR candidate.execution_mode <> 'approved_live'
    OR candidate.external_send_cap <> 1
    OR candidate.owner_contract_json ->> 'dispatchAuthority' <> 'vestblock_application'
    OR candidate.contract_json #>> '{activationReadiness,status}' <> 'ready'
    OR jsonb_array_length(candidate.contract_json #> '{activationReadiness,blockers}') <> 0
    OR candidate.contract_json #>> '{canaryScope,manifestKey}'
      <> manifest ->> 'manifest_key'
    OR candidate.contract_json #>> '{canaryScope,writerRelease}'
      <> manifest ->> 'required_writer_release'
    OR candidate.approved_by_user_id IS NOT NULL
    OR candidate.approved_at IS NOT NULL
    OR candidate.activated_at IS NOT NULL
    OR candidate.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'Prepared seller candidate does not match the generated after fingerprint and safe draft shape.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_versions version
    WHERE version.status = 'active'
       OR version.approved_at IS NOT NULL
       OR version.activated_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.operating_strategy_outbound_controls controls
    WHERE NOT controls.paused
  ) OR EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND NOT controls.outbound_kill_switch
  ) THEN
    RAISE EXCEPTION 'Candidate preparation changed approval, activation, or outbound-control state.';
  END IF;
END
$gate3d1_seller_candidate$;
`
}

/** Read-only production-state check used once to freeze the PostgreSQL hash. */
export function serializeGate3d1SellerReplyCanaryFingerprintSql() {
  const manifest = JSON.stringify(
    sortJson(buildGate3d1SellerReplyCanaryManifest() as unknown as JsonValue)
  )
  return `WITH manifest AS (
  SELECT $gate3d1_manifest$${manifest}$gate3d1_manifest$::JSONB AS value
), candidate AS (
  SELECT version.*, manifest.value AS manifest
  FROM public.operating_strategy_versions version
  JOIN public.operating_strategies strategy
    ON strategy.id = version.operating_strategy_id
  CROSS JOIN manifest
  WHERE strategy.strategy_key = 'seller_options_intake'
    AND version.version = 1
    AND version.status = 'draft'
    AND private.gate3b_operating_contract_fingerprint(
      ROW(version.*)::public.operating_strategy_versions
    )
      = '${GATE3D1_SELLER_REPLY_CANARY_BEFORE_FINGERPRINT}'
)
SELECT md5(jsonb_build_object(
  'version', candidate.version,
  'status', candidate.status,
  'execution_mode', candidate.manifest ->> 'execution_mode',
  'title', candidate.title,
  'destination_mode', candidate.manifest ->> 'destination_mode',
  'destination_path', candidate.manifest ->> 'destination_path',
  'cta_label', candidate.manifest ->> 'cta_label',
  'contract_json', candidate.manifest -> 'contract_json',
  'lifecycle_contract_json', candidate.manifest -> 'lifecycle_contract_json',
  'owner_contract_json', candidate.manifest -> 'owner_contract_json',
  'outcome_contract_json', candidate.manifest -> 'outcome_contract_json',
  'source_provenance_json', candidate.manifest -> 'source_provenance_json',
  'crm_owner_key', candidate.manifest ->> 'crm_owner_key',
  'automation_owner_key', candidate.manifest ->> 'automation_owner_key',
  'external_send_cap', (candidate.manifest ->> 'external_send_cap')::INTEGER,
  'approved_by_user_id', candidate.approved_by_user_id,
  'approved_at', candidate.approved_at,
  'activated_at', candidate.activated_at,
  'retired_at', candidate.retired_at,
  'supersedes_id', candidate.supersedes_id
)::TEXT) AS expected_after_fingerprint
FROM candidate;
`
}

if (require.main === module) {
  process.stdout.write(
    process.argv.includes('--fingerprint-sql')
      ? serializeGate3d1SellerReplyCanaryFingerprintSql()
      : serializeGate3d1SellerReplyCanaryCandidateSql()
  )
}
