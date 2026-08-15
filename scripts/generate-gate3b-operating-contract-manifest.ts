import { OPERATING_STRATEGY_VERSION_CONTRACTS } from '../lib/strategy/operating-contracts'
import type { OperatingStrategyKey } from '../lib/strategy/registry'

type JsonPrimitive = boolean | number | string | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export const EXPECTED_GATE_3A_OPERATING_CONTRACT_FINGERPRINTS = Object.freeze({
  business_acquisition_network: '6936da8cad6b053dd46c84e4fa35ded5',
  business_formation_readiness: '8ee6205d21e7692fc2599f85cb769c1a',
  buyer_buy_box_activation: '547bbf6dd2092408a72002abe5ee2962',
  capital_readiness_intake: '4957eee1c3a14b890af9d6a8f89f1ed4',
  content_authority_intelligence: 'f6a00c11fbbe4ec0bceac7ddf623e5d8',
  credit_education_support: 'a5fbafef7c1a5d6479119fdced6ffdea',
  customer_lifecycle_orchestration: '77a0e59192c2ff424bd37b73c59ab20d',
  dealvault_activation: 'fde1e02bf64adad6bc2080b2d7f110a3',
  investor_capital_relationships: '7b83c30995b085b4b2280a622f6a435c',
  lender_provider_criteria: 'cd6f9483b30f1a673bb51d6f10e0593e',
  next_move_free_roadmap: '6d95539184d91f860f4198a894dc6244',
  partner_referral_network: 'd4d077c8276354853e81ca9dd54078df',
  professional_participant_activation: '7e42d0758603fc63a841d9569c405cee',
  property_opportunity_discovery: 'e748f764c9b428a3d41a426cc9fb5ede',
  public_sector_opportunity_readiness: 'a6429114c850a326b50d68c07766daa2',
  seller_options_intake: '1cad4e5ea289def47ed697c61580f163',
  service_provider_network: '0ecea1d24aaffb454e55bba68e1955ed',
} satisfies Record<OperatingStrategyKey, string>)

const sortJson = (value: JsonValue): JsonValue => {
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

export const buildGate3BOperatingContractManifest = () => {
  const contracts = Object.values(OPERATING_STRATEGY_VERSION_CONTRACTS)
    .sort((left, right) => left.strategyKey.localeCompare(right.strategyKey))
    .map((contract) => ({
      strategy_key: contract.strategyKey,
      expected_prior_fingerprint:
        EXPECTED_GATE_3A_OPERATING_CONTRACT_FINGERPRINTS[contract.strategyKey],
      expected_current_version: contract.version,
      required_current_status: contract.versionStatus,
      execution_mode: contract.executionMode,
      destination_mode: contract.destination.mode,
      destination_path: contract.destination.path,
      cta_label: contract.destination.cta,
      contract_json: contract.operatingContract,
      lifecycle_contract_json: contract.lifecycleContract,
      owner_contract_json: contract.ownerContract,
      outcome_contract_json: contract.outcomeContract,
      source_provenance_json: contract.sourceProvenance,
      crm_owner_key: contract.ownerContract.crmAuthority,
      automation_owner_key: contract.ownerContract.automationRole,
      external_send_cap: contract.externalSendCap,
      external_activation: contract.activation.externalActivation,
      activation_blockers: contract.activation.blockers,
    }))

  return {
    manifest_version: 1,
    gate: '3B',
    intent: 'replace_existing_version_1_draft_contracts_only',
    generator_database_write: false,
    activation_policy: 'draft_only_no_external_send',
    preconditions: [
      'Each operating strategy already exists in the Gate 3A registry.',
      'Version 1 is still draft and has never been active or retired.',
      'external_send_cap remains zero and dispatchAuthority remains none_in_gate_3b.',
      'A separately reviewed migration must consume this manifest; this generator never connects to a database.',
    ],
    contracts,
  } as const
}

export const serializeGate3BOperatingContractManifest = () =>
  `${JSON.stringify(sortJson(buildGate3BOperatingContractManifest() as unknown as JsonValue), null, 2)}\n`

const sqlTextArray = (values: readonly string[]) =>
  `ARRAY[${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')}]::TEXT[]`

export const serializeGate3BOperatingContractUpdateSql = () => {
  const manifest = buildGate3BOperatingContractManifest()
  const strategyKeys = manifest.contracts.map((contract) => contract.strategy_key)
  const priorFingerprintPayload = JSON.stringify(
    manifest.contracts.map(({ strategy_key, expected_prior_fingerprint }) => ({
      strategy_key,
      expected_prior_fingerprint,
    }))
  )
  const updatePayload = JSON.stringify(
    sortJson(manifest.contracts as unknown as JsonValue)
  )

  return `-- Deterministic Gate 3B draft-contract update generated from TypeScript contracts.
-- This output is inert until it is separately reviewed, timestamped, and executed as a migration.
-- It does not activate a strategy, grant send capacity, or connect to a database.
DO $gate3b_guard$
DECLARE
  expected_strategy_keys CONSTANT TEXT[] := ${sqlTextArray(strategyKeys)};
BEGIN
  IF (
    SELECT count(*)
    FROM public.operating_strategies strategy
    JOIN public.operating_strategy_versions version
      ON version.operating_strategy_id = strategy.id
    WHERE strategy.strategy_key = ANY(expected_strategy_keys)
      AND version.version = 1
  ) <> 17 THEN
    RAISE EXCEPTION 'Gate 3B requires exactly 17 existing version-1 operating contracts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategies strategy
    JOIN public.operating_strategy_versions version
      ON version.operating_strategy_id = strategy.id
    WHERE strategy.strategy_key = ANY(expected_strategy_keys)
      AND version.version = 1
      AND (
        version.status <> 'draft'
        OR version.external_send_cap <> 0
        OR version.owner_contract_json ->> 'dispatchAuthority' <> 'none_in_gate_3a'
        OR version.outcome_contract_json ->> 'minimumExposure' <> '1'
        OR jsonb_array_length(version.source_provenance_json) <> 1
        OR NOT version.source_provenance_json @> '[{"source":"Gate 2 canonical strategy registry"}]'::JSONB
      )
  ) THEN
    RAISE EXCEPTION 'Gate 3B refuses to update a non-draft, send-capable, or non-Gate-3A version';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategies strategy
    JOIN public.operating_strategy_versions version
      ON version.operating_strategy_id = strategy.id
    JOIN public.operating_strategy_version_events event
      ON event.version_id = version.id
    WHERE strategy.strategy_key = ANY(expected_strategy_keys)
      AND version.version = 1
      AND event.event_type IN ('activated', 'retired')
  ) THEN
    RAISE EXCEPTION 'Gate 3B refuses to rewrite previously active or retired history';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset($gate3b_prior_fingerprints$${priorFingerprintPayload}$gate3b_prior_fingerprints$::JSONB) AS expected(
      strategy_key TEXT,
      expected_prior_fingerprint TEXT
    )
    JOIN public.operating_strategies strategy
      ON strategy.strategy_key = expected.strategy_key
    JOIN public.operating_strategy_versions strategy_version
      ON strategy_version.operating_strategy_id = strategy.id
      AND strategy_version.version = 1
    WHERE private.gate3b_operating_contract_fingerprint(strategy_version)
      <> expected.expected_prior_fingerprint
  ) THEN
    RAISE EXCEPTION 'Gate 3B refuses to overwrite a version-1 draft whose exact Gate 3A fingerprint changed';
  END IF;
END
$gate3b_guard$;

WITH gate3b_manifest AS (
  SELECT *
  FROM jsonb_to_recordset($gate3b_json$${updatePayload}$gate3b_json$::JSONB) AS row(
    strategy_key TEXT,
    expected_prior_fingerprint TEXT,
    expected_current_version INTEGER,
    required_current_status TEXT,
    execution_mode TEXT,
    destination_mode TEXT,
    destination_path TEXT,
    cta_label TEXT,
    contract_json JSONB,
    lifecycle_contract_json JSONB,
    owner_contract_json JSONB,
    outcome_contract_json JSONB,
    source_provenance_json JSONB,
    crm_owner_key TEXT,
    automation_owner_key TEXT,
    external_send_cap INTEGER,
    external_activation TEXT,
    activation_blockers JSONB
  )
)
UPDATE public.operating_strategy_versions version
SET
  execution_mode = manifest.execution_mode,
  destination_mode = manifest.destination_mode,
  destination_path = manifest.destination_path,
  cta_label = manifest.cta_label,
  contract_json = manifest.contract_json,
  lifecycle_contract_json = manifest.lifecycle_contract_json,
  owner_contract_json = manifest.owner_contract_json,
  outcome_contract_json = manifest.outcome_contract_json,
  source_provenance_json = manifest.source_provenance_json,
  crm_owner_key = manifest.crm_owner_key,
  automation_owner_key = manifest.automation_owner_key,
  external_send_cap = manifest.external_send_cap
FROM gate3b_manifest manifest
JOIN public.operating_strategies strategy
  ON strategy.strategy_key = manifest.strategy_key
WHERE version.operating_strategy_id = strategy.id
  AND version.version = manifest.expected_current_version
  AND version.status = manifest.required_current_status
  AND version.version = 1
  AND version.status = 'draft'
  AND version.external_send_cap = 0
  AND manifest.external_activation = 'blocked'
  AND manifest.external_send_cap = 0;

DO $gate3b_postconditions$
DECLARE
  expected_strategy_keys CONSTANT TEXT[] := ${sqlTextArray(strategyKeys)};
BEGIN
  IF (
    SELECT count(*)
    FROM public.operating_strategies strategy
    JOIN public.operating_strategy_versions version
      ON version.operating_strategy_id = strategy.id
    WHERE strategy.strategy_key = ANY(expected_strategy_keys)
      AND version.version = 1
      AND version.status = 'draft'
      AND version.external_send_cap = 0
      AND version.owner_contract_json ->> 'dispatchAuthority' = 'none_in_gate_3b'
  ) <> 17 THEN
    RAISE EXCEPTION 'Gate 3B did not update exactly 17 untouched version-1 drafts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategies strategy
    JOIN public.operating_strategy_versions version
      ON version.operating_strategy_id = strategy.id
    WHERE strategy.strategy_key = ANY(expected_strategy_keys)
      AND (
        version.status <> 'draft'
        OR version.external_send_cap <> 0
        OR version.approved_by_user_id IS NOT NULL
        OR version.approved_at IS NOT NULL
        OR version.activated_at IS NOT NULL
        OR version.retired_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Gate 3B must leave all 17 contracts unapproved, inactive, and zero-send';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_versions
    WHERE status = 'active'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3B must not activate any operating strategy or sending';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orchestration_controls
    WHERE integration_key = 'n8n'
      AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3B requires n8n live sending to remain disabled';
  END IF;
END
$gate3b_postconditions$;
`
}

if (require.main === module) {
  process.stdout.write(serializeGate3BOperatingContractUpdateSql())
}
