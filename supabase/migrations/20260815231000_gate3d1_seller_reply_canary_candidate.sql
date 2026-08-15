-- Gate 3D.1 seller same-thread reply candidate preparation.
--
-- This deterministic migration changes exactly one still-unapproved draft from
-- the reviewed Gate 3C fingerprint into a founder-reviewable cap-one candidate.
-- It does not approve or activate a version, grant reviewer authority, release
-- either outbound control, create an authorization, reserve capacity, or send.

DO $gate3d1_seller_candidate$
DECLARE
  manifest CONSTANT JSONB := $gate3d1_manifest${"activation_evidence":{"blockers":["Draft preparation does not activate this version; an exact authenticated founder review and activation decision are still required.","The global and seller-strategy outbound controls remain engaged until the authenticated founder separately releases them for the one-recipient canary."],"externalActivation":"pending_founder_review"},"automation_owner_key":"vestblock_application","contract_json":{"activationReadiness":{"blockers":[],"readyElements":["The activation scope is one recipient, one positive inbound message, one property, one purpose, one authored response, and one Outlook same-thread send.","The exact writer release and both fail-closed outbound controls are executable database invariants.","Founder authorization, immutable Graph identity, quiet hours, suppression, reservation, one-shot consumption, and ambiguous-result reconciliation are required immediately before send.","Broader seller sourcing, new-thread outreach, sequences, fallback providers, and n8n live sending remain unauthorized."],"status":"ready"},"cadenceSteps":[{"channels":["operator_task"],"condition":"The candidate remains draft or the founder has not completed every activation and release control.","purpose":"Review the positive inbound reply, property identity, exact authored response, authorization, and all stop controls.","timing":"before any provider mutation"},{"channels":["outlook_graph"],"condition":"The active cap-one version, one-shot authorization, reservation, quiet-hours rule, immutable thread, and both outbound controls pass immediately before send.","purpose":"Continue the exact positive inbound seller conversation without opening a new outreach thread.","timing":"one time during the approved local business window"}],"canaryScope":{"authorizationBasis":"positive_inbound_reply_continuation","automaticSequenceAllowed":false,"exactSameThreadOnly":true,"manifestKey":"gate3d1-seller-positive-inbound-reply-v1","maximumLifetimeRecipients":1,"maximumLifetimeSends":1,"newThreadAllowed":false,"provider":"outlook_graph","providerFallbackAllowed":false,"purpose":"seller_reply_followup","writerRelease":"gate3d1_graph_reply_v1"},"channelSelectionRules":["Only outlook_graph may dispatch, by createReply on the exact immutable inbound message followed by send of the persisted immutable reply draft.","No Resend, Gmail, new-message, manual-recipient, CC, BCC, forwarding, batch, provider fallback, or n8n live-send path is authorized.","The exact authored comment is fingerprinted before founder approval and must be byte-for-byte equivalent after canonical trimming at execution."],"complianceLimits":["Do not guarantee funding, approval, credit-score change, deletion, income, investment return, property availability, government award, deal outcome, or transaction timing.","Keep analysis, matching, marketing, provider sharing, public display, and outreach permissions separate and purpose-specific.","Recheck global suppression, DNC, withdrawal, complaint, hard bounce, identity conflict, and destination health immediately before any later dispatch.","Do not characterize an owner as distressed or motivated unless the owner supplies that context and its use is appropriate.","A positive inbound reply authorizes only the exact reviewed continuation; it is not blanket marketing consent and cannot support another purpose, property, recipient, or thread.","Send only in the stored recipient-local weekday business window and stop immediately on any newer reply or suppression signal."],"crossLaneRoutes":[{"handoff":"Request an internal evidence refresh without authorizing contact.","requiresReceivingStrategyAcceptance":true,"to":"property_opportunity_discovery","trigger":"An operator needs refreshed provenance-backed property evidence."},{"handoff":"Create a blinded match-review handoff; disclose property facts only after approval.","requiresReceivingStrategyAcceptance":true,"to":"buyer_buy_box_activation","trigger":"An operator-approved seller path has a verified buyer-fit use case."},{"handoff":"Create an operator-reviewed, consented introduction request.","requiresReceivingStrategyAcceptance":true,"to":"service_provider_network","trigger":"The seller requests an appropriate licensed or service-provider path."},{"handoff":"Create an access-controlled DealVault activation review.","requiresReceivingStrategyAcceptance":true,"to":"dealvault_activation","trigger":"A reviewed transaction needs evidence and milestone continuity."}],"disqualificationCriteria":["The inbound item is automatic, operational, spam, ambiguous, negative, an opt-out, or has not been positively classified by the founder.","Any mailbox, message, conversation, sender, property, purpose, content, strategy, authorization, or writer-release identity is missing, stale, reused, or mismatched.","A newer reply, suppression, complaint, bounce, identity conflict, property conflict, expired or revoked authorization, consumed canary, closed control, or out-of-window time is present."],"eligibilityCriteria":["The sender is the exact lead associated with the identified property and has provided a positive, non-automatic inbound reply in the VestBlock acquisitions mailbox.","An authenticated founder reviewed the inbound reply and the exact authored response, then issued an unexpired one-shot continuation authorization.","The mailbox object, immutable inbound message, conversation, Internet Message-ID, recipient, property, purpose, message version, and content fingerprints all match the authorization.","Suppression, opt-out, complaint, bounce, identity, newer-reply, quiet-hours, capacity, writer-release, and both kill-switch checks pass immediately before send."],"failureConditions":["Any identity, fingerprint, authorization, writer, reservation, or control mismatch","Duplicate draft or send ambiguity without exact reconciliation","Newer reply, suppression, opt-out, complaint, bounce, or quiet-hours failure","Provider fallback, new-thread composition, or a second recipient or send"],"followupCadence":["One founder-authorized same-thread reply during the pinned recipient-local business window, then stop."],"handoffRules":["Seller intake owns the customer case and options review.","Source tactics contribute evidence only; another strategy accepts ownership before matching or introduction."],"humanApprovalPoints":["Positive, non-automatic inbound classification","Exact lead, property, mailbox, thread, and purpose identity","Exact authored response and message-version fingerprint","Version activation and both outbound-control releases","Any ambiguous provider result or callback attribution"],"integrationDependencies":[{"evidence":"The canary control migrations bind the one strategy version, exact writer release, reservation, runtime rows, and global and strategy kill switches.","integration":"Gate 3D.1 selective canonical binding and writer enforcement","requiredBeforeActivation":true,"status":"available"},{"evidence":"The dedicated application uses Exchange Application RBAC for the acquisitions mailbox, immutable IDs, createReply, persisted draft identity, and no fallback.","integration":"Scoped Microsoft Graph same-thread reply adapter","requiredBeforeActivation":true,"status":"available"},{"evidence":"Append-only authorization and revocation evidence plus one-shot claim and reconciliation state bind the exact thread, property, purpose, recipient, and content.","integration":"Founder-reviewed positive-inbound continuation authority","requiredBeforeActivation":true,"status":"available"},{"evidence":"The governed enrollment and strategy activity ledgers persist immutable outbound identity and accept callbacks only when exact thread and In-Reply-To evidence match.","integration":"Exact delivery and reply attribution","requiredBeforeActivation":true,"status":"available"}],"learningInputs":["authorization and content fingerprints","immutable inbound and outbound thread identities","provider draft, send, and reconciliation state","seller callback and exact In-Reply-To attribution","stop-control and suppression outcomes"],"nurtureRules":["No nurture sequence, unanswered follow-up, cross-sell, or second message is authorized by this canary.","Any later communication requires a new customer action and a separately approved strategy version and authorization."],"objective":"Help an owner or authorized representative organize a credible property sale or transition path without manufacturing urgency.","offer":"One human-reviewed continuation of an owner's positive inbound property reply, sent only in the exact Microsoft Outlook thread for the identified property and purpose.","primaryChannels":["operator_task"],"prioritizationRules":["This candidate contains exactly one pinned recipient and one reviewed inbound thread; no ranking or batch selection is authorized.","A founder-reviewed positive inbound continuation takes precedence only for its exact property and purpose.","Any ambiguity is quarantined for manual review and receives no automated fallback."],"problem":"Fragmented seller records and tactic-led contact can pressure owners, duplicate outreach, or confuse evidence with motivation.","reactivationRules":["This one-recipient canary cannot reactivate automatically.","An ambiguous provider outcome requires exact immutable-ID reconciliation; it must never create or send a replacement reply automatically."],"secondaryChannels":["outlook_graph","no_outreach"],"sourceData":["command_center_reply_memory immutable Microsoft Graph thread evidence","private one-shot inbound-reply continuation authorization","leads property and recipient identity","governed outbound enrollment, dispatch reservation, and strategy activity ledgers"],"sourceDataRequirements":[{"authority":"The acquisitions mailbox item retrieved with Prefer: IdType=\"ImmutableId\"","freshnessRule":"Refetch the exact item and reject any identity mismatch or newer sender reply immediately before creating or sending the reply draft.","requiredEvidence":["tenant and sender application identity","mailbox object and address","immutable inbound message ID","conversation ID","inbound Internet Message-ID","sender and recipient identity","received timestamp","human positive-reply review"],"source":"Immutable Microsoft Graph inbound reply"},{"authority":"Authenticated founder RPC with append-only authorization, revocation, claim, and outcome evidence","freshnessRule":"Authorization must be unexpired, unrevoked, unconsumed, and reasserted with both outbound controls and the exact writer release immediately before provider send.","requiredEvidence":["authorization ID and fingerprint","reply-memory and lead IDs","property reference and seller_reply_followup purpose","approved authored-content fingerprint and message version","approval and expiry timestamps","one-shot claim and reconciliation state"],"source":"Founder-issued one-shot continuation authorization"}],"stopRules":["Stop on opt-out, complaint, hard bounce, DNC, withdrawal, or permission loss.","Stop on a reply that needs human handling, a verified conversion, successful handoff, disqualification, or identity conflict.","Stop on stale evidence, an invalid destination, a missing strategy or message version, duplicate ownership, capacity failure, or a kill switch.","Stop immediately on legal dispute, explicit sensitivity concern, or three unanswered approved attempts.","Stop after the single provider send is accepted or becomes ambiguous; re-engage the global and strategy controls before any evaluation.","Stop and quarantine when exact immutable callback attribution cannot be proven by mailbox, conversation, sender, recipient, and In-Reply-To identities."],"targetParticipant":"Property owners or authorized representatives who request or may lawfully receive a review of selling options.","valueExchange":"The seller supplies authority, property context, priorities, and permissions in exchange for a private options review and operator-owned next step.","versionDecisionRule":{"autonomousMaterialChange":false,"promote":"Promote only after two 30-day windows each include at least 15 complete submitted seller cases and five operator-qualified cases with no complaint or sensitivity regression.","requiredCompleteWindows":2,"retire":"Retire a tactic or path after provenance failure, material complaint, prohibited targeting, or two reviewed windows without qualified progression.","revise":"Revise a specific path when attributable option, source, or timing friction is correctable."}},"crm_owner_key":"vestblock_crm","cta_label":"Review my selling options","destination_mode":"public_route","destination_path":"/sell","execution_mode":"approved_live","expected_after_fingerprint":"b321ad591bffc099f3197a84c5c38028","expected_before_fingerprint":"74c3fb77e802a30d001db78e48e21747","external_send_cap":1,"gate":"3D.1","intent":"prepare_one_reviewable_seller_reply_canary_draft_without_activation","lifecycle_contract_json":{"cadence":["Immediate customer-requested confirmation.","Human review within one business day.","Permitted follow-up at days 2, 7, and 14, then stop."],"initialState":"draft","persistedEvents":["seller_case_events.event_type","seller_case_events.from_status","seller_case_events.to_status"],"persistedStates":["draft","submitted","needs_information","under_review","options_review","declined","withdrawn","closed"],"recordAuthority":"seller_cases is the current state authority; seller_case_events is the append-only transition authority.","stateNotes":{"closed":"closed is persisted by seller_cases.status, with transitions recorded in seller_case_events.","declined":"declined is persisted by seller_cases.status, with transitions recorded in seller_case_events.","draft":"draft is persisted by seller_cases.status, with transitions recorded in seller_case_events.","introduced":"introduced is target-only and is not currently persisted by seller_cases.status, with transitions recorded in seller_case_events.","needs_information":"needs_information is persisted by seller_cases.status, with transitions recorded in seller_case_events.","next_step_approved":"next_step_approved is target-only and is not currently persisted by seller_cases.status, with transitions recorded in seller_case_events.","offer_review":"offer_review is target-only and is not currently persisted by seller_cases.status, with transitions recorded in seller_case_events.","options_review":"options_review is persisted by seller_cases.status, with transitions recorded in seller_case_events.","qualified":"qualified is target-only and is not currently persisted by seller_cases.status, with transitions recorded in seller_case_events.","submitted":"submitted is persisted by seller_cases.status, with transitions recorded in seller_case_events.","under_review":"under_review is persisted by seller_cases.status, with transitions recorded in seller_case_events.","withdrawn":"withdrawn is persisted by seller_cases.status, with transitions recorded in seller_case_events."},"states":["draft","submitted","needs_information","under_review","options_review","declined","withdrawn","closed","qualified","next_step_approved","introduced","offer_review"],"stopConditions":["declined","withdrawn","closed","authority_conflict","representation_conflict","legal_dispute","sensitivity_concern"],"targetOnlyStages":["qualified","next_step_approved","introduced","offer_review"],"terminalStates":["closed"],"transitions":[{"event":"seller_submits_case","from":"draft","persistence":"current","to":"submitted"},{"event":"seller_withdraws_draft","from":"draft","persistence":"current","to":"withdrawn"},{"event":"required_information_missing","from":"submitted","persistence":"current","to":"needs_information"},{"event":"operator_accepts_review","from":"submitted","persistence":"current","to":"under_review"},{"event":"seller_withdraws_submitted_case","from":"submitted","persistence":"current","to":"withdrawn"},{"event":"seller_resubmits_information","from":"needs_information","persistence":"current","to":"submitted"},{"event":"information_received","from":"needs_information","persistence":"current","to":"under_review"},{"event":"seller_withdraws_information_case","from":"needs_information","persistence":"current","to":"withdrawn"},{"event":"new_material_gap_found","from":"under_review","persistence":"current","to":"needs_information"},{"event":"operator_opens_options_review","from":"under_review","persistence":"current","to":"options_review"},{"event":"operator_declines_case","from":"under_review","persistence":"current","to":"declined"},{"event":"seller_withdraws_review_case","from":"under_review","persistence":"current","to":"withdrawn"},{"event":"options_review_needs_information","from":"options_review","persistence":"current","to":"needs_information"},{"event":"options_review_reopens_review","from":"options_review","persistence":"current","to":"under_review"},{"event":"options_review_declined","from":"options_review","persistence":"current","to":"declined"},{"event":"seller_withdraws_options_review","from":"options_review","persistence":"current","to":"withdrawn"},{"event":"options_review_closed","from":"options_review","persistence":"current","to":"closed"},{"event":"declined_case_closed","from":"declined","persistence":"current","to":"closed"},{"event":"withdrawn_case_closed","from":"withdrawn","persistence":"current","to":"closed"},{"event":"operator_records_qualified_path","from":"options_review","persistence":"target_only","to":"qualified"},{"event":"seller_and_operator_approve_next_step","from":"qualified","persistence":"target_only","to":"next_step_approved"},{"event":"qualified_path_not_pursued","from":"qualified","persistence":"target_only","to":"closed"},{"event":"approved_third_party_introduction","from":"next_step_approved","persistence":"target_only","to":"introduced"},{"event":"offer_or_structure_ready_for_review","from":"next_step_approved","persistence":"target_only","to":"offer_review"},{"event":"approved_step_cancelled","from":"next_step_approved","persistence":"target_only","to":"closed"},{"event":"introduction_path_completed_or_ended","from":"introduced","persistence":"target_only","to":"closed"},{"event":"offer_path_completed_or_ended","from":"offer_review","persistence":"target_only","to":"closed"}]},"manifest_key":"gate3d1-seller-positive-inbound-reply-v1","manifest_version":1,"outcome_contract_json":{"attributionDimensions":["operating strategy version","authorization","lead and property","mailbox and immutable thread","message version and content fingerprint","writer release","founder reviewer"],"businessValue":"A controlled proof that VestBlock can continue one real seller conversation safely, with exact attribution and immediate stop authority.","exposureUnit":"founder_authorized_same_thread_reply","leadingIndicators":["positive inbound reply reviewed","one-shot authorization issued","dispatch reservation claimed","immutable reply draft persisted","provider send accepted or exactly reconciled","exact seller callback attributed"],"learningInputs":["authorization evidence","content and thread fingerprints","Graph draft and send state","suppression and stop-control state","exact callback identity","operator reconciliation outcome"],"learningWindowDays":7,"minimumExposure":1,"minimumPrimaryConversions":1,"observableCurrentOutcome":{"available":true,"evidence":"The one-shot authorization, dispatch reservation, governed enrollment, operating-strategy activity, and immutable Graph thread evidence persist the canary outcome.","limitation":"One canary proves only this exact continuation path and cannot justify broader seller outreach, another recipient, a new thread, or another provider."},"primaryConversionEvent":"The exact founder-authorized same-thread seller reply is accepted by Microsoft Graph once and reconciled to its immutable outbound message identity.","requiredCompleteWindows":2,"safeguards":["Require two complete learning windows before recommending promotion.","Do not declare a winner from opens, clicks, or other vanity engagement alone.","A complaint, compliance failure, identity conflict, duplicate dispatch, or suppression breach blocks promotion.","Material audience, offer, cadence, claim, destination, or channel changes remain human-reviewed proposals.","Do not count a sourced lead, delivered email, appointment suggestion, or options_review case as operator-qualified."],"stopConditions":["one send accepted or provider result ambiguous","authorization expired, revoked, or consumed","identity or fingerprint mismatch","suppression, complaint, bounce, opt-out, or newer reply","global or strategy control engaged"],"targetOutcomeObservable":true,"verifiedOutcomeRule":"Count once only when the one-shot authorization, reservation, canonical enrollment activity, immutable outbound Graph identity, provider acceptance or reconciliation, and re-engaged stop evidence all agree."},"owner_contract_json":{"automationRole":"vestblock_application","crmAuthority":"vestblock_crm","dispatchAuthority":"vestblock_application","handoffRules":["No source, cron, n8n workflow, generic email adapter, or other strategy may dispatch this reply.","The dedicated Graph adapter receives only the exact claimed authorization and must re-engage both outbound stops after the one canary attempt."],"humanOwner":"The authenticated VestBlock founder owns positive-inbound classification, exact response approval, activation, outbound-control release, and ambiguous-result review.","recordOwner":"Seller case records own customer context; the governed enrollment, strategy activity, immutable Graph thread, and one-shot continuation ledgers jointly own canary dispatch evidence."},"required_current_status":"draft","required_writer_release":"gate3d1_graph_reply_v1","source_commit":"efa545b486dd79f4b4c9e0c429398448c028d0fe","source_provenance_json":[{"kind":"gate_3a_registry_seed","observedAt":"2026-08-15","source":"Gate 3A canonical governed registry"},{"kind":"founder_approved_architecture","observedAt":"2026-08-15","source":"Gate 2 canonical strategy registry"},{"kind":"repository_consumer_audit","observedAt":"2026-08-15","source":"seller_cases/seller_case_events and seller send-path consumer audit"},{"kind":"gate_3d1_canary_candidate","manifestKey":"gate3d1-seller-positive-inbound-reply-v1","observedAt":"2026-08-15","priorFingerprint":"74c3fb77e802a30d001db78e48e21747","source":"Gate 3D.1 seller positive-inbound same-thread canary manifest","sourceCommit":"efa545b486dd79f4b4c9e0c429398448c028d0fe","writerRelease":"gate3d1_graph_reply_v1"}],"strategy_key":"seller_options_intake","unchanged_gate3c_fingerprints":{"business_acquisition_network":"a96aae4117fade695c15e93a903802cf","business_formation_readiness":"8e04e350de6912f13523248c81103762","buyer_buy_box_activation":"050db76162fc612456c29d9e357b713f","capital_readiness_intake":"f5bad84ec7a3aa69c0801b8658771b04","content_authority_intelligence":"086b8447a085f8a88f2b843b548ad1da","credit_education_support":"06d89433fdee05d5689f156a323822ca","customer_lifecycle_orchestration":"470951941abfca8b6f58304e2f93ebf3","dealvault_activation":"d73c205b8a67a551bec9532a69e8b804","investor_capital_relationships":"34be21e3c62c2444ff8f35f360fce70b","lender_provider_criteria":"432e0cc465f8f841949badab0693d9d3","next_move_free_roadmap":"a31a6d07a6e75c31516e79c248ea1282","partner_referral_network":"1db7783037a719bb5ea44a203742767e","professional_participant_activation":"5c8f3bff2bd292fe79ddc2181d6bf7e3","property_opportunity_discovery":"38381df614e5c739c8de5f0bd9e3b870","public_sector_opportunity_readiness":"52cc09671efc4caaa4ebcf292ffdb7b7","service_provider_network":"0c59eae475c405662b0015b84f939dfe"},"version":1}$gate3d1_manifest$::JSONB;
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

  IF manifest ->> 'source_commit' <> 'efa545b486dd79f4b4c9e0c429398448c028d0fe'
    OR manifest ->> 'manifest_key' <> 'gate3d1-seller-positive-inbound-reply-v1'
    OR manifest ->> 'expected_before_fingerprint' <> '74c3fb77e802a30d001db78e48e21747'
    OR manifest ->> 'expected_after_fingerprint' <> 'b321ad591bffc099f3197a84c5c38028'
    OR manifest ->> 'required_writer_release' <> 'gate3d1_graph_reply_v1' THEN
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
      ('business_acquisition_network', 'a96aae4117fade695c15e93a903802cf'),
      ('business_formation_readiness', '8e04e350de6912f13523248c81103762'),
      ('buyer_buy_box_activation', '050db76162fc612456c29d9e357b713f'),
      ('capital_readiness_intake', 'f5bad84ec7a3aa69c0801b8658771b04'),
      ('content_authority_intelligence', '086b8447a085f8a88f2b843b548ad1da'),
      ('credit_education_support', '06d89433fdee05d5689f156a323822ca'),
      ('customer_lifecycle_orchestration', '470951941abfca8b6f58304e2f93ebf3'),
      ('dealvault_activation', 'd73c205b8a67a551bec9532a69e8b804'),
      ('investor_capital_relationships', '34be21e3c62c2444ff8f35f360fce70b'),
      ('lender_provider_criteria', '432e0cc465f8f841949badab0693d9d3'),
      ('next_move_free_roadmap', 'a31a6d07a6e75c31516e79c248ea1282'),
      ('partner_referral_network', '1db7783037a719bb5ea44a203742767e'),
      ('professional_participant_activation', '5c8f3bff2bd292fe79ddc2181d6bf7e3'),
      ('property_opportunity_discovery', '38381df614e5c739c8de5f0bd9e3b870'),
      ('public_sector_opportunity_readiness', '52cc09671efc4caaa4ebcf292ffdb7b7'),
      ('service_provider_network', '0c59eae475c405662b0015b84f939dfe')
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
