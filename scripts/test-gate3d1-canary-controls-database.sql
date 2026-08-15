\set ON_ERROR_STOP on

-- Gate 3D.1 rollback-only database regression.
--
-- The three Gate 3D.1 migrations are applied before this file by the rehearsal
-- runner inside one transaction. Every founder decision, activation, fixture,
-- reservation, and state transition below is rolled back. No provider is
-- called, no production authority survives, and no trigger is bypassed.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(
  p_condition BOOLEAN,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(p_condition, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Gate 3D.1 assertion failed: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  p_sql TEXT,
  p_message TEXT,
  p_expected_sqlstate TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  failed BOOLEAN := FALSE;
  observed_sqlstate TEXT;
  observed_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    failed := TRUE;
    GET STACKED DIAGNOSTICS
      observed_sqlstate = RETURNED_SQLSTATE,
      observed_message = MESSAGE_TEXT;
  END;
  IF NOT failed THEN
    RAISE EXCEPTION 'Gate 3D.1 expected failure did not occur: %', p_message;
  END IF;
  IF p_expected_sqlstate IS NOT NULL
    AND observed_sqlstate IS DISTINCT FROM p_expected_sqlstate THEN
    RAISE EXCEPTION 'Gate 3D.1 failure % returned SQLSTATE %, expected % (message: %).',
      p_message, observed_sqlstate, p_expected_sqlstate, observed_message;
  END IF;
END;
$$;

-- Make quiet-hours checks deterministic without adding a production override.
-- 2026-08-17 17:00 UTC is Monday noon in America/Chicago.
CREATE OR REPLACE FUNCTION private.gate3d1_dispatch_evaluation_time()
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT '2026-08-17 17:00:00+00'::TIMESTAMPTZ;
$$;

SELECT set_config('gate3d1.test.founder_id',
  'db0e9822-637b-4038-bc18-2a4b020cedce', TRUE);
SELECT set_config('gate3d1.test.writer', 'gate3d1_graph_reply_v1', TRUE);
SELECT set_config('gate3d1.test.contract_fingerprint',
  'b321ad591bffc099f3197a84c5c38028', TRUE);
SELECT set_config('gate3d1.test.tenant_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.client_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.mailbox_object_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.out_scope_mailbox_object_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.mailbox_address', 'acquisitions@vestblock.io', TRUE);
SELECT set_config('gate3d1.test.lead_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.reply_memory_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.outreach_message_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.enrollment_id', gen_random_uuid()::TEXT, TRUE);
SELECT set_config('gate3d1.test.inbound_message_id', 'AAMk-GATE3D1-Immutable-CaseSensitive', TRUE);
SELECT set_config('gate3d1.test.conversation_id', 'AAQk-GATE3D1-Conversation-CaseSensitive', TRUE);
SELECT set_config('gate3d1.test.internet_message_id', '<gate3d1-positive-reply@example.test>', TRUE);
SELECT set_config('gate3d1.test.sender_email', 'warm-seller@example.test', TRUE);
SELECT set_config('gate3d1.test.recipient_email', 'acquisitions@vestblock.io', TRUE);
SELECT set_config('gate3d1.test.property', '101 Test Street', TRUE);
SELECT set_config('gate3d1.test.draft_key', 'seller-reply-gate3d1-v1', TRUE);
SELECT set_config('gate3d1.test.approved_body',
  '  Thank you for replying. We can review your selling options together.  ', TRUE);
SELECT set_config('gate3d1.test.canonical_body',
  private.gate3d1_canonical_authored_body(
    current_setting('gate3d1.test.approved_body')
  ), TRUE);
SELECT set_config('gate3d1.test.sender_hash',
  private.gate3d1_sha256_text('warm-seller@example.test'), TRUE);
SELECT set_config('gate3d1.test.recipient_hash',
  private.gate3d1_sha256_text('acquisitions@vestblock.io'), TRUE);
SELECT set_config('gate3d1.test.content_hash',
  private.gate3d1_sha256_text(
    current_setting('gate3d1.test.canonical_body')
  ), TRUE);
SELECT set_config('gate3d1.test.positive_review_hash',
  private.gate3d1_sha256_text('founder-human-positive-review-gate3d1'), TRUE);
SELECT set_config('gate3d1.test.rbac_expires_at',
  (statement_timestamp() + INTERVAL '6 hours')::TEXT, TRUE);
SELECT set_config('gate3d1.test.authorization_expires_at',
  (statement_timestamp() + INTERVAL '4 hours')::TEXT, TRUE);

SELECT set_config('gate3d1.test.version_id', version.id::TEXT, TRUE),
       set_config('gate3d1.test.strategy_id', version.operating_strategy_id::TEXT, TRUE)
FROM public.operating_strategy_versions version
JOIN public.operating_strategies strategy
  ON strategy.id = version.operating_strategy_id
WHERE strategy.strategy_key = 'seller_options_intake'
  AND version.version = 1;

-- Candidate and migration baseline: only the seller overlay changed, while all
-- authority and every outbound path remain closed.
SELECT pg_temp.assert_true(
  (SELECT private.gate3b_operating_contract_fingerprint(
      (version.*)::public.operating_strategy_versions
    ) = current_setting('gate3d1.test.contract_fingerprint')
   FROM public.operating_strategy_versions version
   WHERE version.id = current_setting('gate3d1.test.version_id')::UUID),
  'the deterministic seller candidate fingerprint must be exact'
);
SELECT pg_temp.assert_true(
  (SELECT status = 'draft' AND execution_mode = 'approved_live'
      AND external_send_cap = 1 AND approved_at IS NULL AND activated_at IS NULL
   FROM public.operating_strategy_versions
   WHERE id = current_setting('gate3d1.test.version_id')::UUID),
  'candidate preparation must remain draft and unapproved'
);
SELECT pg_temp.assert_true(
  (SELECT canary_enforcement_status = 'disabled'
      AND enforcement_mode = 'compatibility' AND outbound_kill_switch
   FROM public.operating_strategy_runtime_controls
   WHERE control_key = 'canonical_binding')
  AND NOT EXISTS (SELECT 1 FROM public.operating_strategy_outbound_controls WHERE NOT paused)
  AND NOT EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities)
  AND NOT EXISTS (SELECT 1 FROM private.inbound_reply_continuation_authorizations)
  AND NOT EXISTS (SELECT 1 FROM private.exchange_application_rbac_attestations)
  AND NOT EXISTS (SELECT 1 FROM private.gate3d1_canary_dispatch_claims),
  'Gate 3D.1 must begin fail-closed with no seeded authority'
);
SELECT pg_temp.assert_true(
  (SELECT COUNT(*) = 18 FROM private.gate3d1_outbound_control_events)
  AND NOT EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ),
  'baseline stop events must exist and n8n must remain disabled'
);

-- Reviewer authority is bootstrapped once by the exact verified Auth identity.
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  format('SELECT public.bootstrap_gate3d1_founder_reviewer(%L::UUID)',
    current_setting('gate3d1.test.founder_id')),
  'service role cannot bootstrap founder authority', '42501'
);
SELECT pg_temp.expect_error(
  format('SELECT public.assert_gate3d1_founder_actor(%L::UUID)',
    current_setting('gate3d1.test.founder_id')),
  'service role cannot use the authenticated founder assertion', '42501'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, TRUE);
SELECT pg_temp.expect_error(
  format('SELECT public.bootstrap_gate3d1_founder_reviewer(%L::UUID)',
    current_setting('gate3d1.test.founder_id')),
  'a different authenticated identity cannot bootstrap founder authority', '42501'
);
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT pg_temp.assert_true(
  public.bootstrap_gate3d1_founder_reviewer(
    current_setting('gate3d1.test.founder_id')::UUID
  ) = current_setting('gate3d1.test.founder_id')::UUID,
  'exact founder bootstrap must succeed'
);
SELECT pg_temp.assert_true(
  public.bootstrap_gate3d1_founder_reviewer(
    current_setting('gate3d1.test.founder_id')::UUID
  ) = current_setting('gate3d1.test.founder_id')::UUID,
  'exact founder bootstrap retry must be idempotent'
);
SELECT pg_temp.assert_true(
  public.assert_gate3d1_founder_actor(
    current_setting('gate3d1.test.founder_id')::UUID
  ) = current_setting('gate3d1.test.founder_id')::UUID,
  'read-only founder assertion must return the exact authenticated founder'
);
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, TRUE);
SELECT pg_temp.expect_error(
  format('SELECT public.assert_gate3d1_founder_actor(%L::UUID)',
    current_setting('gate3d1.test.founder_id')),
  'read-only founder assertion must reject a different authenticated identity', '42501'
);
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);

SELECT pg_temp.expect_error(
  format(
    'SELECT public.stage_gate3d1_canary_review(%L::UUID,%L,%L::UUID,%L,%L)',
    current_setting('gate3d1.test.version_id'), repeat('0', 32),
    current_setting('gate3d1.test.founder_id'), current_setting('gate3d1.test.writer'),
    'Founder reviewed the exact seller canary candidate.'
  ),
  'staging must reject any caller-substituted fingerprint', '23514'
);
SELECT pg_temp.expect_error(
  format(
    'SELECT public.stage_gate3d1_canary_review(%L::UUID,%L,%L::UUID,%L,%L)',
    current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.contract_fingerprint'),
    current_setting('gate3d1.test.founder_id'), 'wrong_writer',
    'Founder reviewed the exact seller canary candidate.'
  ),
  'staging must reject any writer other than the frozen Graph release', '23514'
);
SELECT pg_temp.assert_true(
  public.stage_gate3d1_canary_review(
    current_setting('gate3d1.test.version_id')::UUID,
    current_setting('gate3d1.test.contract_fingerprint'),
    current_setting('gate3d1.test.founder_id')::UUID,
    current_setting('gate3d1.test.writer'),
    'Founder reviewed the exact seller same-thread cap-one candidate.'
  ) ->> 'canaryEnforcementStatus' = 'reviewed_cap_one',
  'exact founder staging must establish only the selective cap-one posture'
);
RESET ROLE;

-- The service can propose, but only the authenticated founder can approve and
-- activate the exact fingerprint while both stops are engaged.
SET LOCAL ROLE service_role;
SELECT set_config('gate3d1.test.manifest_id',
  public.submit_operating_strategy_review_manifest(
    current_setting('gate3d1.test.version_id')::UUID,
    'activation_review',
    'gate3d1-seller-one-shot-activation',
    '{"autoApply":false,"targetStatus":"active","scope":"one founder-authorized same-thread seller reply"}'::JSONB,
    ARRAY[]::UUID[],
    'agent',
    'gate3d1_activation_agent',
    NULL,
    'gate3d1-seller-one-shot-activation',
    current_setting('gate3d1.test.writer')
  )::TEXT, TRUE);
SELECT set_config('gate3d1.test.manifest_fingerprint', manifest.proposal_fingerprint, TRUE)
FROM public.operating_strategy_review_manifests manifest
WHERE manifest.id = current_setting('gate3d1.test.manifest_id')::UUID;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT set_config('gate3d1.test.decision_id',
  public.record_operating_strategy_review_decision(
    current_setting('gate3d1.test.manifest_id')::UUID,
    'approved',
    current_setting('gate3d1.test.founder_id')::UUID,
    'vestblock_founder',
    'Founder approved the exact seller reply canary fingerprint and stop controls.',
    current_setting('gate3d1.test.manifest_fingerprint'),
    'gate3d1-seller-one-shot-decision'
  )::TEXT, TRUE);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.activate_operating_strategy_version(
      current_setting('gate3d1.test.version_id')::UUID,
      current_setting('gate3d1.test.founder_id')::UUID
    ) activated
    WHERE activated.status = 'active' AND activated.external_send_cap = 1
  ),
  'founder-approved exact cap-one candidate must activate while stops remain engaged'
);
RESET ROLE;

-- Activation timestamps and founder identity are part of the canonical
-- operating fingerprint, so every dispatch row binds the post-activation
-- fingerprint rather than the frozen draft-review fingerprint.
SELECT set_config(
  'gate3d1.test.contract_fingerprint',
  private.gate3b_operating_contract_fingerprint(
    (version.*)::public.operating_strategy_versions
  ),
  TRUE
)
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3d1.test.version_id')::UUID;

SELECT pg_temp.assert_true(
  (SELECT outbound_kill_switch FROM public.operating_strategy_runtime_controls
   WHERE control_key = 'canonical_binding')
  AND (SELECT paused FROM public.operating_strategy_outbound_controls
       WHERE operating_strategy_id = current_setting('gate3d1.test.strategy_id')::UUID),
  'activation must not release either outbound stop'
);

-- Founder-reviewed Exchange Application RBAC proof is exact, additive roles
-- fail, proof is short-lived, and service can only assert it.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT pg_temp.expect_error(
  format(
    'SELECT public.record_exchange_application_rbac_attestation(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L::JSONB,%L,%L,%L::TIMESTAMPTZ,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.tenant_id'), current_setting('gate3d1.test.client_id'),
    current_setting('gate3d1.test.mailbox_object_id'), current_setting('gate3d1.test.out_scope_mailbox_object_id'),
    current_setting('gate3d1.test.mailbox_address'),
    '["Application Mail.ReadWrite","Application Mail.Send","Application Mail.FullAccess"]',
    'e32f7a27d945ebcc42ef641c9b7696fcf972c9db28a21c7fcc38946f66543cec',
    'bf16cd1ed6f3bdf48c670fa9bc7d42f6b97b50c600604f215cd569cc60ab4c10',
    current_setting('gate3d1.test.rbac_expires_at'), current_setting('gate3d1.test.founder_id'),
    'Founder reviewed exact in-scope allow and out-of-scope deny proof.',
    current_setting('gate3d1.test.writer'), 'gate3d1-rbac-extra-role'
  ),
  'Exchange RBAC attestation must reject every additive role', '23514'
);
SELECT pg_temp.expect_error(
  format(
    'SELECT public.record_exchange_application_rbac_attestation(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L::JSONB,%L,%L,statement_timestamp()-interval ''1 minute'',%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.tenant_id'), current_setting('gate3d1.test.client_id'),
    current_setting('gate3d1.test.mailbox_object_id'), current_setting('gate3d1.test.out_scope_mailbox_object_id'),
    current_setting('gate3d1.test.mailbox_address'),
    '["Application Mail.ReadWrite","Application Mail.Send"]',
    'e32f7a27d945ebcc42ef641c9b7696fcf972c9db28a21c7fcc38946f66543cec',
    'bf16cd1ed6f3bdf48c670fa9bc7d42f6b97b50c600604f215cd569cc60ab4c10',
    current_setting('gate3d1.test.founder_id'),
    'Founder reviewed exact in-scope allow and out-of-scope deny proof.',
    current_setting('gate3d1.test.writer'), 'gate3d1-rbac-expired'
  ),
  'expired Exchange RBAC evidence must be rejected', '23514'
);
SELECT set_config('gate3d1.test.rbac_attestation_id',
  public.record_exchange_application_rbac_attestation(
    current_setting('gate3d1.test.tenant_id')::UUID,
    current_setting('gate3d1.test.client_id')::UUID,
    current_setting('gate3d1.test.mailbox_object_id')::UUID,
    current_setting('gate3d1.test.out_scope_mailbox_object_id')::UUID,
    current_setting('gate3d1.test.mailbox_address'),
    '["Application Mail.ReadWrite","Application Mail.Send"]'::JSONB,
    'e32f7a27d945ebcc42ef641c9b7696fcf972c9db28a21c7fcc38946f66543cec',
    'bf16cd1ed6f3bdf48c670fa9bc7d42f6b97b50c600604f215cd569cc60ab4c10',
    current_setting('gate3d1.test.rbac_expires_at')::TIMESTAMPTZ,
    current_setting('gate3d1.test.founder_id')::UUID,
    'Founder reviewed the dedicated acquisitions allow and contact-mailbox deny proof.',
    current_setting('gate3d1.test.writer'),
    'gate3d1-rbac-exact'
  )::TEXT, TRUE);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(
  (SELECT attestation_id = current_setting('gate3d1.test.rbac_attestation_id')::UUID
      AND rbac_roles = ARRAY['Application Mail.ReadWrite','Application Mail.Send']::TEXT[]
      AND in_scope_proof_fingerprint = 'e32f7a27d945ebcc42ef641c9b7696fcf972c9db28a21c7fcc38946f66543cec'
      AND out_of_scope_deny_proof_fingerprint = 'bf16cd1ed6f3bdf48c670fa9bc7d42f6b97b50c600604f215cd569cc60ab4c10'
   FROM public.assert_gate3d1_graph_rbac_attestation_current(
     current_setting('gate3d1.test.tenant_id')::UUID,
     current_setting('gate3d1.test.client_id')::UUID,
     current_setting('gate3d1.test.mailbox_object_id')::UUID,
     current_setting('gate3d1.test.mailbox_address')
   )),
  'service assertion must return the exact two-role scoped Exchange proof'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_gate3d1_graph_rbac_attestation_current(%L::UUID,%L::UUID,%L::UUID,%L)',
    current_setting('gate3d1.test.tenant_id'), current_setting('gate3d1.test.client_id'),
    current_setting('gate3d1.test.out_scope_mailbox_object_id'), 'contact@vestblock.io'),
  'out-of-scope mailbox identity must fail closed', '23514'
);
RESET ROLE;

-- Warm, positive, exact-thread fixture. The reply property is deliberately
-- blank: the canonical lead property is authority; a conflicting nonblank
-- reply property will be rejected below.
INSERT INTO public.leads(
  id, lead_type, status, contact_info, form_data, name, email,
  property_address, source, outreach_status, delivery_status
) VALUES (
  current_setting('gate3d1.test.lead_id')::UUID,
  'sell_house', 'new', '{}'::JSONB, '{}'::JSONB, 'Warm Seller',
  current_setting('gate3d1.test.sender_email'),
  current_setting('gate3d1.test.property'), 'gate3d1_rollback_fixture',
  'not_started', 'not_sent'
);
INSERT INTO public.command_center_reply_memory(
  id, lead_id, strategy_key, mailbox, thread_id, message_id,
  from_email, to_email, subject, property_address, received_at,
  classification, next_step, reply_summary, metadata_json
) VALUES (
  current_setting('gate3d1.test.reply_memory_id')::UUID,
  current_setting('gate3d1.test.lead_id')::UUID,
  'seller_options_intake', current_setting('gate3d1.test.mailbox_address'),
  current_setting('gate3d1.test.conversation_id'),
  current_setting('gate3d1.test.inbound_message_id'),
  current_setting('gate3d1.test.sender_email'),
  current_setting('gate3d1.test.recipient_email'),
  'Re: selling options', NULL, statement_timestamp() - INTERVAL '1 hour',
  'hot_seller_lead', 'founder_review', 'Positive human reply requesting next steps.',
  jsonb_build_object(
    'internetMessageId', current_setting('gate3d1.test.internet_message_id'),
    'explicitOptOut', FALSE,
    'graphIdType', 'ImmutableId'
  )
);
INSERT INTO public.outreach_messages(
  id, lead_id, channel, subject, body, generated_with, status,
  variant_key, approved_at, approved_by_user_id
) VALUES (
  current_setting('gate3d1.test.outreach_message_id')::UUID,
  current_setting('gate3d1.test.lead_id')::UUID,
  'email', 'Re: selling options', current_setting('gate3d1.test.approved_body'),
  'gate3d1_graph_reply', 'needs_review', current_setting('gate3d1.test.draft_key'),
  NULL, NULL
);

CREATE OR REPLACE FUNCTION pg_temp.authorize_gate3d1(
  p_idempotency_key TEXT,
  p_start TIME DEFAULT '10:30',
  p_end TIME DEFAULT '16:30',
  p_weekdays SMALLINT[] DEFAULT ARRAY[1,2,3,4,5]::SMALLINT[],
  p_sender_hash TEXT DEFAULT NULL,
  p_property TEXT DEFAULT NULL,
  p_content_hash TEXT DEFAULT NULL,
  p_outreach_message_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE SQL
AS $$
  SELECT public.record_inbound_reply_continuation_authorization(
    current_setting('gate3d1.test.version_id')::UUID,
    current_setting('gate3d1.test.lead_id')::UUID,
    current_setting('gate3d1.test.reply_memory_id')::UUID,
    COALESCE(p_outreach_message_id,
      current_setting('gate3d1.test.outreach_message_id')::UUID),
    current_setting('gate3d1.test.rbac_attestation_id')::UUID,
    current_setting('gate3d1.test.tenant_id')::UUID,
    current_setting('gate3d1.test.client_id')::UUID,
    current_setting('gate3d1.test.mailbox_object_id')::UUID,
    current_setting('gate3d1.test.mailbox_address'),
    current_setting('gate3d1.test.inbound_message_id'),
    current_setting('gate3d1.test.conversation_id'),
    current_setting('gate3d1.test.internet_message_id'),
    COALESCE(p_sender_hash, current_setting('gate3d1.test.sender_hash')),
    current_setting('gate3d1.test.recipient_hash'),
    COALESCE(p_property, current_setting('gate3d1.test.property')),
    'seller_reply_followup',
    COALESCE(p_content_hash, current_setting('gate3d1.test.content_hash')),
    current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.positive_review_hash'),
    'America/Chicago', p_start, p_end, p_weekdays,
    current_setting('gate3d1.test.authorization_expires_at')::TIMESTAMPTZ,
    current_setting('gate3d1.test.founder_id')::UUID,
    'Founder reviewed a positive human reply, exact property, thread, and authored response.',
    current_setting('gate3d1.test.writer'), p_idempotency_key
  );
$$;

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  'SELECT pg_temp.authorize_gate3d1(''service-cannot-authorize'')',
  'service role cannot create founder continuation authority', '42501'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT pg_temp.expect_error(
  'SELECT pg_temp.authorize_gate3d1(''quiet-start-too-early'',''09:00''::TIME,''16:30''::TIME)',
  '09:00 local authorization must be rejected', '23514'
);
SELECT pg_temp.expect_error(
  'SELECT pg_temp.authorize_gate3d1(''quiet-end-too-late'',''10:30''::TIME,''16:31''::TIME)',
  'a window extending past 16:30 must be rejected', '23514'
);
SELECT pg_temp.expect_error(
  'SELECT pg_temp.authorize_gate3d1(''quiet-weekend'',''10:30''::TIME,''16:30''::TIME,ARRAY[1,6]::SMALLINT[])',
  'weekend authorization must be rejected', '23514'
);

SAVEPOINT conflicting_reply_property;
UPDATE public.command_center_reply_memory
SET property_address = '999 Conflicting Property'
WHERE id = current_setting('gate3d1.test.reply_memory_id')::UUID;
SELECT pg_temp.expect_error(
  'SELECT pg_temp.authorize_gate3d1(''conflicting-reply-property'')',
  'a conflicting nonblank reply-memory property must be rejected', '23514'
);
ROLLBACK TO SAVEPOINT conflicting_reply_property;

SAVEPOINT mismatched_lead_sender;
UPDATE public.leads SET email = 'wrong-person@example.test'
WHERE id = current_setting('gate3d1.test.lead_id')::UUID;
SELECT pg_temp.expect_error(
  'SELECT pg_temp.authorize_gate3d1(''mismatched-lead-sender'')',
  'canonical lead email must match the reviewed inbound sender', '23514'
);
ROLLBACK TO SAVEPOINT mismatched_lead_sender;

SELECT pg_temp.expect_error(
  format('SELECT pg_temp.authorize_gate3d1(%L,''10:30''::TIME,''16:30''::TIME,ARRAY[1,2,3,4,5]::SMALLINT[],NULL,NULL,%L)',
    'altered-approved-body-hash', repeat('a', 64)),
  'altered approved body content must be rejected', '23514'
);
SELECT pg_temp.expect_error(
  format('SELECT pg_temp.authorize_gate3d1(%L,''10:30''::TIME,''16:30''::TIME,ARRAY[1,2,3,4,5]::SMALLINT[],NULL,NULL,NULL,%L::UUID)',
    'altered-outreach-id', gen_random_uuid()),
  'an unbound outreach message ID must be rejected', '23514'
);

SELECT set_config('gate3d1.test.authorization_id',
  pg_temp.authorize_gate3d1('gate3d1-continuation-exact')::TEXT, TRUE);
SELECT pg_temp.assert_true(
  (SELECT status = 'approved'
      AND approved_by_user_id = current_setting('gate3d1.test.founder_id')::UUID
      AND approved_at IS NOT NULL
   FROM public.outreach_messages
   WHERE id = current_setting('gate3d1.test.outreach_message_id')::UUID),
  'founder authorization must atomically approve only its exact needs-review draft'
);
SELECT pg_temp.assert_true(
  pg_temp.authorize_gate3d1('gate3d1-continuation-exact')
    = current_setting('gate3d1.test.authorization_id')::UUID,
  'exact founder authorization retry must be idempotent'
);
RESET ROLE;

-- Exact body trimming is canonical, but a material body, new reply, terminal
-- lead signal, revocation, or quiet-hours failure must fail closed.
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(
  (SELECT authorization_id = current_setting('gate3d1.test.authorization_id')::UUID
      AND length(authorization_fingerprint) = 32
   FROM public.assert_inbound_reply_continuation_authorized(
     current_setting('gate3d1.test.authorization_id')::UUID,
     current_setting('gate3d1.test.version_id')::UUID,
     current_setting('gate3d1.test.lead_id')::UUID,
     current_setting('gate3d1.test.reply_memory_id')::UUID,
     current_setting('gate3d1.test.content_hash'),
     current_setting('gate3d1.test.draft_key'),
     current_setting('gate3d1.test.writer')
   )),
  'exact current continuation authority must assert'
);

SAVEPOINT outer_whitespace_equivalence;
UPDATE public.outreach_messages SET body = E'\n\t' || btrim(body) || E'  \n'
WHERE id = current_setting('gate3d1.test.outreach_message_id')::UUID;
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.assert_inbound_reply_continuation_authorized(
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.version_id')::UUID,
    current_setting('gate3d1.test.lead_id')::UUID,
    current_setting('gate3d1.test.reply_memory_id')::UUID,
    current_setting('gate3d1.test.content_hash'),
    current_setting('gate3d1.test.draft_key'), current_setting('gate3d1.test.writer'))),
  'canonical outer whitespace must not change the approved authored body'
);
ROLLBACK TO SAVEPOINT outer_whitespace_equivalence;

SAVEPOINT material_body_change;
UPDATE public.outreach_messages SET body = btrim(body) || ' Changed.'
WHERE id = current_setting('gate3d1.test.outreach_message_id')::UUID;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'material approved body mutation must fail closed', '23514'
);
ROLLBACK TO SAVEPOINT material_body_change;

SAVEPOINT newer_inbound_reply;
INSERT INTO public.command_center_reply_memory(
  lead_id, strategy_key, mailbox, thread_id, message_id, from_email, to_email,
  subject, received_at, classification, metadata_json
) VALUES (
  current_setting('gate3d1.test.lead_id')::UUID, 'seller_options_intake',
  current_setting('gate3d1.test.mailbox_address'), current_setting('gate3d1.test.conversation_id'),
  'AAMk-Newer-Immutable', current_setting('gate3d1.test.sender_email'),
  current_setting('gate3d1.test.recipient_email'), 'Re: newer reply',
  statement_timestamp(), 'hot_seller_lead',
  '{"internetMessageId":"<newer@example.test>","explicitOptOut":false}'::JSONB
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'a newer inbound reply must require new founder review', '23514'
);
ROLLBACK TO SAVEPOINT newer_inbound_reply;

SAVEPOINT terminal_lead_status;
UPDATE public.leads SET status = 'do_not_contact'
WHERE id = current_setting('gate3d1.test.lead_id')::UUID;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'terminal lead status must suppress continuation', '23514'
);
ROLLBACK TO SAVEPOINT terminal_lead_status;

SAVEPOINT terminal_outreach_status;
UPDATE public.leads SET outreach_status = 'failed'
WHERE id = current_setting('gate3d1.test.lead_id')::UUID;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'terminal lead outreach status must suppress continuation', '23514'
);
ROLLBACK TO SAVEPOINT terminal_outreach_status;

SAVEPOINT terminal_delivery_status;
UPDATE public.leads SET delivery_status = 'complained'
WHERE id = current_setting('gate3d1.test.lead_id')::UUID;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'complained delivery status must suppress continuation', '23514'
);
ROLLBACK TO SAVEPOINT terminal_delivery_status;

RESET ROLE;
SAVEPOINT weekend_runtime;
CREATE OR REPLACE FUNCTION private.gate3d1_dispatch_evaluation_time()
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT '2026-08-16 17:00:00+00'::TIMESTAMPTZ $$;
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'runtime weekend quiet hours must fail closed', '23514'
);
RESET ROLE;
ROLLBACK TO SAVEPOINT weekend_runtime;
RESET ROLE;

-- Server-only manifest resolves exact raw execution inputs; no request body can
-- substitute a recipient, property, thread, draft, or authored response.
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(
  (SELECT reply_memory_id = current_setting('gate3d1.test.reply_memory_id')::UUID
      AND lead_id = current_setting('gate3d1.test.lead_id')::UUID
      AND outreach_message_id = current_setting('gate3d1.test.outreach_message_id')::UUID
      AND recipient_email = current_setting('gate3d1.test.sender_email')
      AND property_reference_key = current_setting('gate3d1.test.property')
      AND approved_comment = current_setting('gate3d1.test.canonical_body')
      AND approved_content_fingerprint = current_setting('gate3d1.test.content_hash')
      AND inbound_message_id = current_setting('gate3d1.test.inbound_message_id')
   FROM public.resolve_gate3d1_canary_execution_manifest(
     current_setting('gate3d1.test.authorization_id')::UUID,
     current_setting('gate3d1.test.outreach_message_id')::UUID,
     current_setting('gate3d1.test.writer')
   )),
  'execution manifest must resolve only persisted exact authorization inputs'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.resolve_gate3d1_canary_execution_manifest(%L::UUID,%L::UUID,%L)',
    current_setting('gate3d1.test.authorization_id'), gen_random_uuid(),
    current_setting('gate3d1.test.writer')),
  'execution manifest must reject an altered outreach ID', '23514'
);

-- A claim is impossible while either stop remains engaged.
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.claim_gate3d1_canary_dispatch(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.rbac_attestation_id'),
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.lead_id'),
    'outlook_graph', current_setting('gate3d1.test.content_hash'),
    current_setting('gate3d1.test.draft_key'), 'gate3d1-reservation',
    current_setting('gate3d1.test.writer'), 'gate3d1-claim'),
  'claim must fail while outbound stops are engaged', '23514'
);
RESET ROLE;

-- Founder releases the selected strategy first and global stop second. Service
-- can only reduce authority; a no-claim failure re-engages both stops.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT public.set_operating_strategy_outbound_control(
  current_setting('gate3d1.test.strategy_id')::UUID, FALSE,
  current_setting('gate3d1.test.founder_id')::UUID,
  'Founder releases only the reviewed seller reply canary strategy.',
  current_setting('gate3d1.test.writer')
);
SELECT public.set_operating_strategy_outbound_control(
  NULL::UUID, FALSE, current_setting('gate3d1.test.founder_id')::UUID,
  'Founder releases the global stop for one exact canary claim.',
  current_setting('gate3d1.test.writer')
);
RESET ROLE;

SET LOCAL ROLE service_role;
SAVEPOINT no_claim_emergency_stop;
SELECT public.engage_gate3d1_canary_stop(
  current_setting('gate3d1.test.version_id')::UUID,
  current_setting('gate3d1.test.writer'),
  'Pre-claim execution failed; engage every Gate 3D.1 stop now.',
  repeat('9', 64), 'gate3d1-no-claim-emergency-stop'
);
SELECT pg_temp.assert_true(
  (SELECT outbound_kill_switch FROM public.operating_strategy_runtime_controls
   WHERE control_key = 'canonical_binding')
  AND (SELECT paused FROM public.operating_strategy_outbound_controls
       WHERE operating_strategy_id = current_setting('gate3d1.test.strategy_id')::UUID),
  'service no-claim fail-safe must only re-engage both stops'
);
ROLLBACK TO SAVEPOINT no_claim_emergency_stop;

SELECT set_config('gate3d1.test.claim_id', claim_id::TEXT, TRUE),
       set_config('gate3d1.test.consent_snapshot', consent_basis_snapshot_json::TEXT, TRUE)
FROM public.claim_gate3d1_canary_dispatch(
  current_setting('gate3d1.test.authorization_id')::UUID,
  current_setting('gate3d1.test.rbac_attestation_id')::UUID,
  current_setting('gate3d1.test.version_id')::UUID,
  current_setting('gate3d1.test.lead_id')::UUID,
  'outlook_graph', current_setting('gate3d1.test.content_hash'),
  current_setting('gate3d1.test.draft_key'), 'gate3d1-reservation',
  current_setting('gate3d1.test.writer'), 'gate3d1-claim'
);
SELECT pg_temp.assert_true(
  (current_setting('gate3d1.test.consent_snapshot')::JSONB -> 'dispatchAuthorized') = 'true'::JSONB
  AND NULLIF(current_setting('gate3d1.test.consent_snapshot')::JSONB ->> 'evidenceKey', '') IS NOT NULL
  AND jsonb_array_length(current_setting('gate3d1.test.consent_snapshot')::JSONB -> 'provenance') = 1
  AND (SELECT dispatch_state = 'claimed' AND automatic_provider_retry_allowed
       FROM public.get_gate3d1_canary_dispatch_state(
         current_setting('gate3d1.test.claim_id')::UUID,
         current_setting('gate3d1.test.authorization_id')::UUID,
         current_setting('gate3d1.test.writer'))),
  'claim must carry complete immutable consent evidence and claimed recovery state'
);
SELECT pg_temp.assert_true(
  (SELECT claim_id = current_setting('gate3d1.test.claim_id')::UUID
   FROM public.claim_gate3d1_canary_dispatch(
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.rbac_attestation_id')::UUID,
    current_setting('gate3d1.test.version_id')::UUID,
    current_setting('gate3d1.test.lead_id')::UUID,
    'outlook_graph', current_setting('gate3d1.test.content_hash'),
    current_setting('gate3d1.test.draft_key'), 'gate3d1-reservation',
    current_setting('gate3d1.test.writer'), 'gate3d1-claim')),
  'exact claim retry must be idempotent'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.claim_gate3d1_canary_dispatch(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.rbac_attestation_id'),
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.lead_id'),
    'outlook_graph', current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    'gate3d1-reservation-other', current_setting('gate3d1.test.writer'), 'gate3d1-claim-other'),
  'a lifetime canary cannot create a second claim', '23505'
);

SELECT pg_temp.expect_error(
  format('SELECT * FROM public.reserve_operating_strategy_dispatch(%L::UUID,%L,%L,1,%L,%L,900,ARRAY[]::TEXT[])',
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.contract_fingerprint'),
    'resend_email', 'gate3d1-reservation', current_setting('gate3d1.test.writer')),
  'canary reservation must reject every non-Outlook channel', '23514'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.reserve_operating_strategy_dispatch(%L::UUID,%L,%L,1,%L,%L,900,ARRAY[%L]::TEXT[])',
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.contract_fingerprint'),
    'outlook_graph', 'gate3d1-reservation', current_setting('gate3d1.test.writer'), 'resend_email'),
  'canary reservation must reject every fallback provider', '23514'
);
SELECT set_config('gate3d1.test.reservation_id', reservation_id::TEXT, TRUE)
FROM public.reserve_operating_strategy_dispatch(
  current_setting('gate3d1.test.version_id')::UUID,
  current_setting('gate3d1.test.contract_fingerprint'),
  'outlook_graph', 1, 'gate3d1-reservation',
  current_setting('gate3d1.test.writer'), 900, ARRAY[]::TEXT[]
);
SELECT public.bind_gate3d1_canary_reservation(
  current_setting('gate3d1.test.claim_id')::UUID,
  current_setting('gate3d1.test.reservation_id')::UUID,
  current_setting('gate3d1.test.version_id')::UUID,
  current_setting('gate3d1.test.writer'), 'gate3d1-bind-reservation'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'reservation_bound' AND reservation_id = current_setting('gate3d1.test.reservation_id')::UUID
   FROM public.get_gate3d1_canary_dispatch_state(
     current_setting('gate3d1.test.claim_id')::UUID,
     current_setting('gate3d1.test.authorization_id')::UUID,
     current_setting('gate3d1.test.writer'))),
  'reservation binding must be visible in recovery state'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.reserve_operating_strategy_dispatch(%L::UUID,%L,%L,1,%L,%L,900,ARRAY[]::TEXT[])',
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.contract_fingerprint'),
    'outlook_graph', 'gate3d1-reservation-tomorrow', current_setting('gate3d1.test.writer')),
  'lifetime one-recipient control must reject another reservation regardless of daily cap', '23514'
);

SELECT set_config('gate3d1.test.intent_at', statement_timestamp()::TEXT, TRUE);
SELECT set_config('gate3d1.test.suppression_snapshot', jsonb_build_object(
  'suppressionCleared', TRUE,
  'checkedAt', statement_timestamp(),
  'evidenceKey', 'gate3d1-suppression:' || current_setting('gate3d1.test.lead_id'),
  'recipientHash', current_setting('gate3d1.test.sender_hash')
)::TEXT, TRUE);

INSERT INTO public.command_center_outbound_enrollments(
  id, lead_id, strategy_key, channel, recipient, recipient_hash, property_address,
  status, last_message_id, metadata_json, operating_strategy_id,
  strategy_identifier_namespace, operating_strategy_version_id,
  strategy_binding_mode, strategy_binding_recorded_at, strategy_writer_release,
  destination_mode_snapshot, destination_path_snapshot, cta_label_snapshot,
  operating_contract_fingerprint, governed_stage, dispatch_reservation_id,
  dispatch_channel, dispatch_intent_at, outreach_purpose,
  consent_basis_snapshot_json, suppression_snapshot_json, message_version_key
)
SELECT
  current_setting('gate3d1.test.enrollment_id')::UUID,
  current_setting('gate3d1.test.lead_id')::UUID,
  'seller_options_intake', 'email', current_setting('gate3d1.test.sender_email'),
  current_setting('gate3d1.test.sender_hash'), current_setting('gate3d1.test.property'),
  'queued', current_setting('gate3d1.test.outreach_message_id'),
  '{"gate":"3D.1","provider":"outlook_graph"}'::JSONB,
  version.operating_strategy_id, 'operating_strategy', version.id,
  'governed_v1', statement_timestamp(), current_setting('gate3d1.test.writer'),
  version.destination_mode, version.destination_path, version.cta_label,
  current_setting('gate3d1.test.contract_fingerprint'), 'dispatch_intent',
  current_setting('gate3d1.test.reservation_id')::UUID, 'outlook_graph',
  current_setting('gate3d1.test.intent_at')::TIMESTAMPTZ,
  'seller_reply_followup',
  current_setting('gate3d1.test.consent_snapshot')::JSONB,
  current_setting('gate3d1.test.suppression_snapshot')::JSONB,
  current_setting('gate3d1.test.draft_key')
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3d1.test.version_id')::UUID;

SAVEPOINT wrong_activity_subject_namespace;
SELECT set_config('gate3d1.test.wrong_activity_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3d1.test.version_id')::UUID,
    p_activity_type => 'enrollment',
    p_activity_namespace => 'command_center_outbound_enrollment',
    p_activity_key => current_setting('gate3d1.test.enrollment_id'),
    p_subject_namespace => 'seller_case',
    p_subject_key => current_setting('gate3d1.test.lead_id'),
    p_idempotency_key => 'gate3d1-wrong-subject-activity',
    p_writer_release => current_setting('gate3d1.test.writer'),
    p_occurred_at => current_setting('gate3d1.test.intent_at')::TIMESTAMPTZ,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_outbound_enrollment_id => current_setting('gate3d1.test.enrollment_id')::UUID,
    p_dispatch_reservation_id => current_setting('gate3d1.test.reservation_id')::UUID,
    p_dispatch_channel => 'outlook_graph',
    p_dispatch_intent_at => current_setting('gate3d1.test.intent_at')::TIMESTAMPTZ,
    p_outreach_purpose => 'seller_reply_followup',
    p_consent_basis_snapshot_json => current_setting('gate3d1.test.consent_snapshot')::JSONB,
    p_suppression_snapshot_json => current_setting('gate3d1.test.suppression_snapshot')::JSONB,
    p_message_version_key => current_setting('gate3d1.test.draft_key'),
    p_provenance_json => '[{"source":"wrong subject namespace rollback probe"}]'::JSONB,
    p_metadata_json => '{"gate":"3D.1","negative":true}'::JSONB
  )::TEXT, TRUE);
UPDATE public.command_center_outbound_enrollments
SET canonical_activity_id = current_setting('gate3d1.test.wrong_activity_id')::UUID
WHERE id = current_setting('gate3d1.test.enrollment_id')::UUID;
SELECT pg_temp.expect_error(
  format('SELECT public.confirm_gate3d1_canary_dispatch_intent(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L,%L)',
    current_setting('gate3d1.test.claim_id'), current_setting('gate3d1.test.reservation_id'),
    current_setting('gate3d1.test.enrollment_id'), current_setting('gate3d1.test.wrong_activity_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer'), 'gate3d1-intent-wrong-subject'),
  'canonical activity must use the exact lead subject namespace', '23514'
);
ROLLBACK TO SAVEPOINT wrong_activity_subject_namespace;

SELECT set_config('gate3d1.test.activity_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3d1.test.version_id')::UUID,
    p_activity_type => 'enrollment',
    p_activity_namespace => 'command_center_outbound_enrollment',
    p_activity_key => current_setting('gate3d1.test.enrollment_id'),
    p_subject_namespace => 'lead',
    p_subject_key => current_setting('gate3d1.test.lead_id'),
    p_idempotency_key => 'gate3d1-canonical-enrollment-activity',
    p_writer_release => current_setting('gate3d1.test.writer'),
    p_occurred_at => current_setting('gate3d1.test.intent_at')::TIMESTAMPTZ,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_outbound_enrollment_id => current_setting('gate3d1.test.enrollment_id')::UUID,
    p_dispatch_reservation_id => current_setting('gate3d1.test.reservation_id')::UUID,
    p_dispatch_channel => 'outlook_graph',
    p_dispatch_intent_at => current_setting('gate3d1.test.intent_at')::TIMESTAMPTZ,
    p_outreach_purpose => 'seller_reply_followup',
    p_consent_basis_snapshot_json => current_setting('gate3d1.test.consent_snapshot')::JSONB,
    p_suppression_snapshot_json => current_setting('gate3d1.test.suppression_snapshot')::JSONB,
    p_message_version_key => current_setting('gate3d1.test.draft_key'),
    p_provenance_json => '[{"source":"gate3d1 founder-reviewed inbound continuation"}]'::JSONB,
    p_metadata_json => '{"gate":"3D.1"}'::JSONB
  )::TEXT, TRUE);
UPDATE public.command_center_outbound_enrollments
SET canonical_activity_id = current_setting('gate3d1.test.activity_id')::UUID
WHERE id = current_setting('gate3d1.test.enrollment_id')::UUID;

SELECT pg_temp.expect_error(
  format('UPDATE public.command_center_outbound_enrollments SET strategy_writer_release=%L WHERE id=%L::UUID',
    'wrong_writer', current_setting('gate3d1.test.enrollment_id')),
  'selected canary enrollment UPDATE must enforce exact writer release', '23514'
);

SELECT pg_temp.expect_error(
  format('UPDATE public.command_center_outbound_enrollments SET suppression_snapshot_json=suppression_snapshot_json-%L WHERE id=%L::UUID',
    'checkedAt', current_setting('gate3d1.test.enrollment_id')),
  'suppression checkedAt evidence must be immutable after intent persistence', '23514'
);

SELECT public.confirm_gate3d1_canary_dispatch_intent(
  current_setting('gate3d1.test.claim_id')::UUID,
  current_setting('gate3d1.test.reservation_id')::UUID,
  current_setting('gate3d1.test.enrollment_id')::UUID,
  current_setting('gate3d1.test.activity_id')::UUID,
  current_setting('gate3d1.test.content_hash'),
  current_setting('gate3d1.test.draft_key'),
  current_setting('gate3d1.test.writer'), 'gate3d1-intent-ready'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'intent_ready'
      AND outbound_enrollment_id = current_setting('gate3d1.test.enrollment_id')::UUID
      AND canonical_activity_id = current_setting('gate3d1.test.activity_id')::UUID
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'canonical enrollment/activity must move recovery state to intent_ready'
);

SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'intent_ready' AND length(authorization_fingerprint) = 64
   FROM public.assert_operating_strategy_dispatch_authorized(
    current_setting('gate3d1.test.reservation_id')::UUID,
    current_setting('gate3d1.test.version_id')::UUID,
    'outlook_graph', current_setting('gate3d1.test.writer'))),
  'pre-provider assertion must return exact live intent and SHA-256 authority'
);

SAVEPOINT provider_assert_mutated_intent;
UPDATE public.command_center_outbound_enrollments
SET status = 'accepted'
WHERE id = current_setting('gate3d1.test.enrollment_id')::UUID;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_operating_strategy_dispatch_authorized(%L::UUID,%L::UUID,%L,%L)',
    current_setting('gate3d1.test.reservation_id'),
    current_setting('gate3d1.test.version_id'),
    'outlook_graph', current_setting('gate3d1.test.writer')),
  'pre-provider authority must reject an enrollment mutated out of the exact queued intent state',
  '23514'
);
ROLLBACK TO SAVEPOINT provider_assert_mutated_intent;

SELECT pg_temp.assert_true(
  (SELECT length(provider_mutation_permit_fingerprint) = 64
      AND inbound_message_id = current_setting('gate3d1.test.inbound_message_id')
   FROM public.begin_gate3d1_canary_graph_draft_attempt(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.reservation_id')::UUID,
    current_setting('gate3d1.test.version_id')::UUID,
    current_setting('gate3d1.test.writer'), 'gate3d1-begin-draft')),
  'createReply permit must be one-shot and bound to the immutable inbound item'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'graph_draft_attempted'
      AND NOT automatic_provider_retry_allowed
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'lost createReply response must never allow automatic draft retry'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.begin_gate3d1_canary_graph_draft_attempt(%L::UUID,%L::UUID,%L::UUID,%L,%L)',
    current_setting('gate3d1.test.claim_id'), current_setting('gate3d1.test.reservation_id'),
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.writer'),
    'gate3d1-begin-draft'),
  'a consumed createReply permit cannot replay', '23514'
);
SAVEPOINT unknown_draft_identity_ambiguity;
SELECT public.record_gate3d1_canary_graph_draft_result(
  current_setting('gate3d1.test.claim_id')::UUID,
  current_setting('gate3d1.test.reservation_id')::UUID,
  'ambiguous', '', '', '', repeat('6',64),
  current_setting('gate3d1.test.writer'), 'gate3d1-draft-ambiguous-no-identity'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'ambiguous' AND provider_draft_id_hash IS NULL
      AND global_stop_engaged AND strategy_stop_engaged
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'unknown createReply identity may record ambiguity only with all identity hashes absent'
);
ROLLBACK TO SAVEPOINT unknown_draft_identity_ambiguity;
SELECT pg_temp.expect_error(
  format('SELECT public.record_gate3d1_canary_graph_draft_result(%L::UUID,%L::UUID,%L,%L,%L,%L,%L,%L,%L)',
    current_setting('gate3d1.test.claim_id'), current_setting('gate3d1.test.reservation_id'),
    'ambiguous', repeat('a',64), '', '', repeat('6',64),
    current_setting('gate3d1.test.writer'), 'gate3d1-draft-ambiguous-partial-identity'),
  'partial Graph draft identity must be rejected', '23514'
);
SELECT pg_temp.expect_error(
  format(
    'SELECT public.record_gate3d1_canary_graph_draft_result(%L::UUID,%L::UUID,%L,%L,%L,%L,%L,%L,%L)',
    current_setting('gate3d1.test.claim_id'),
    current_setting('gate3d1.test.reservation_id'),
    'ambiguous', cases.draft_hash, cases.conversation_hash, cases.internet_hash,
    repeat('6',64), current_setting('gate3d1.test.writer'),
    'gate3d1-draft-partial-' || cases.case_key
  ),
  'partial Graph identity permutation ' || cases.case_key || ' must reject',
  '23514'
)
FROM (VALUES
  ('draft-only', repeat('a',64), NULL::TEXT, NULL::TEXT),
  ('conversation-only', NULL::TEXT, repeat('b',64), NULL::TEXT),
  ('internet-only', NULL::TEXT, NULL::TEXT, repeat('c',64)),
  ('draft-conversation', repeat('a',64), repeat('b',64), NULL::TEXT),
  ('draft-internet', repeat('a',64), NULL::TEXT, repeat('c',64)),
  ('conversation-internet', NULL::TEXT, repeat('b',64), repeat('c',64))
) AS cases(case_key, draft_hash, conversation_hash, internet_hash);
SELECT pg_temp.expect_error(
  format('SELECT public.record_gate3d1_canary_graph_draft_result(%L::UUID,%L::UUID,%L,%L,%L,%L,%L,%L,%L)',
    current_setting('gate3d1.test.claim_id'), gen_random_uuid(), 'graph_draft_created',
    repeat('a',64), repeat('b',64), repeat('c',64), repeat('d',64),
    current_setting('gate3d1.test.writer'), 'gate3d1-wrong-draft-reservation'),
  'draft result must match the exact attempted reservation', '23514'
);
SELECT public.record_gate3d1_canary_graph_draft_result(
  current_setting('gate3d1.test.claim_id')::UUID,
  current_setting('gate3d1.test.reservation_id')::UUID,
  'graph_draft_created', repeat('a',64), repeat('b',64), repeat('c',64),
  repeat('d',64), current_setting('gate3d1.test.writer'), 'gate3d1-draft-created'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'graph_draft_created'
      AND provider_draft_id_hash = repeat('a',64)
      AND automatic_provider_retry_allowed
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'persisted exact draft identity must be recoverable without creating another draft'
);

SAVEPOINT abort_after_persisted_draft;
SELECT public.abort_gate3d1_canary_before_send(
  current_setting('gate3d1.test.claim_id')::UUID,
  'Pre-send validation failed after draft persistence; dead-letter and stop.',
  repeat('e',64), current_setting('gate3d1.test.writer'), 'gate3d1-abort-before-send'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'dead_lettered' AND global_stop_engaged AND strategy_stop_engaged
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'pre-send abort must dead-letter and atomically engage both stops'
);
ROLLBACK TO SAVEPOINT abort_after_persisted_draft;

SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'graph_draft_created'
   FROM public.assert_operating_strategy_dispatch_authorized(
    current_setting('gate3d1.test.reservation_id')::UUID,
    current_setting('gate3d1.test.version_id')::UUID,
    'outlook_graph', current_setting('gate3d1.test.writer'))),
  'authority must be reasserted immediately before consuming the send permit'
);
SELECT pg_temp.assert_true(
  (SELECT length(provider_mutation_permit_fingerprint) = 64
      AND provider_draft_id_hash = repeat('a',64)
   FROM public.begin_gate3d1_canary_send_attempt(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.reservation_id')::UUID,
    current_setting('gate3d1.test.version_id')::UUID,
    current_setting('gate3d1.test.writer'), 'gate3d1-begin-send')),
  'send permit must bind the persisted draft hash exactly once'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'send_attempted' AND NOT automatic_provider_retry_allowed
      AND global_stop_engaged AND strategy_stop_engaged
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'consuming the send permit must atomically re-engage both stops and block resend'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.begin_gate3d1_canary_send_attempt(%L::UUID,%L::UUID,%L::UUID,%L,%L)',
    current_setting('gate3d1.test.claim_id'), current_setting('gate3d1.test.reservation_id'),
    current_setting('gate3d1.test.version_id'), current_setting('gate3d1.test.writer'),
    'gate3d1-begin-send'),
  'a consumed send permit can never replay', '23514'
);
SELECT pg_temp.expect_error(
  format('SELECT public.record_gate3d1_canary_send_result(%L::UUID,%L::UUID,%L,%L,%L,%L)',
    current_setting('gate3d1.test.claim_id'), gen_random_uuid(), 'accepted', repeat('f',64),
    current_setting('gate3d1.test.writer'), 'gate3d1-wrong-send-reservation'),
  'provider result must match the exact consumed reservation', '23514'
);

SAVEPOINT accepted_provider_result;
SELECT public.record_gate3d1_canary_send_result(
  current_setting('gate3d1.test.claim_id')::UUID,
  current_setting('gate3d1.test.reservation_id')::UUID,
  'accepted', repeat('f',64), current_setting('gate3d1.test.writer'),
  'gate3d1-provider-accepted'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'accepted' AND NOT automatic_provider_retry_allowed
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'accepted provider result must be terminal and non-replayable'
);
ROLLBACK TO SAVEPOINT accepted_provider_result;

SELECT public.record_gate3d1_canary_send_result(
  current_setting('gate3d1.test.claim_id')::UUID,
  current_setting('gate3d1.test.reservation_id')::UUID,
  'ambiguous', repeat('8',64), current_setting('gate3d1.test.writer'),
  'gate3d1-provider-ambiguous'
);
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'ambiguous' AND NOT automatic_provider_retry_allowed
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer'))),
  'ambiguous send state must be durable and never auto-resend'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT public.reconcile_gate3d1_canary_dispatch(
  current_setting('gate3d1.test.claim_id')::UUID,
  'reconciled_accepted', repeat('7',64),
  current_setting('gate3d1.test.founder_id')::UUID,
  'Founder verified the immutable Graph sent item after an ambiguous response.',
  current_setting('gate3d1.test.writer'), 'gate3d1-founder-reconciled-accepted'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(
  (SELECT dispatch_state = 'reconciled_accepted'
      AND NOT automatic_provider_retry_allowed AND global_stop_engaged AND strategy_stop_engaged
   FROM public.get_gate3d1_canary_dispatch_state(
    current_setting('gate3d1.test.claim_id')::UUID,
    current_setting('gate3d1.test.authorization_id')::UUID,
    current_setting('gate3d1.test.writer')))
  AND (SELECT COUNT(*) = 1 FROM public.operating_strategy_dispatch_reservations
       WHERE operating_strategy_version_id = current_setting('gate3d1.test.version_id')::UUID),
  'founder reconciliation must remain terminal with one lifetime claim and reservation'
);
SELECT pg_temp.expect_error(
  format('SELECT public.revoke_inbound_reply_continuation_authorization(%L::UUID,%L::UUID,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.founder_id'),
    'service cannot revoke founder authority', 'gate3d1-service-revoke'),
  'service role cannot revoke founder continuation authority', '42501'
);
RESET ROLE;

-- Founder revocation is append-only; service assertions fail immediately.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('gate3d1.test.founder_id'), TRUE);
SELECT public.revoke_inbound_reply_continuation_authorization(
  current_setting('gate3d1.test.authorization_id')::UUID,
  current_setting('gate3d1.test.founder_id')::UUID,
  'Founder revokes the completed rollback-only continuation authorization.',
  'gate3d1-founder-revoke-continuation'
);
SELECT public.revoke_exchange_application_rbac_attestation(
  current_setting('gate3d1.test.rbac_attestation_id')::UUID,
  current_setting('gate3d1.test.founder_id')::UUID,
  'Founder revokes the rollback-only Exchange RBAC attestation.',
  'gate3d1-founder-revoke-rbac'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_inbound_reply_continuation_authorized(%L::UUID,%L::UUID,%L::UUID,%L::UUID,%L,%L,%L)',
    current_setting('gate3d1.test.authorization_id'), current_setting('gate3d1.test.version_id'),
    current_setting('gate3d1.test.lead_id'), current_setting('gate3d1.test.reply_memory_id'),
    current_setting('gate3d1.test.content_hash'), current_setting('gate3d1.test.draft_key'),
    current_setting('gate3d1.test.writer')),
  'revoked continuation authority must fail immediately', '23514'
);
SELECT pg_temp.expect_error(
  format('SELECT * FROM public.assert_gate3d1_graph_rbac_attestation_current(%L::UUID,%L::UUID,%L::UUID,%L)',
    current_setting('gate3d1.test.tenant_id'), current_setting('gate3d1.test.client_id'),
    current_setting('gate3d1.test.mailbox_object_id'), current_setting('gate3d1.test.mailbox_address')),
  'revoked Exchange RBAC proof must fail immediately', '23514'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.outreach_send_events
    WHERE lead_id = current_setting('gate3d1.test.lead_id')::UUID
  )
  AND (SELECT COUNT(*) >= 22 FROM private.gate3d1_outbound_control_events),
  'regression must call no provider, enable no legacy path, and preserve append-only control evidence'
);

ROLLBACK;
