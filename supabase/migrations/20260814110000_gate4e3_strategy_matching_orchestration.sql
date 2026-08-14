-- Gate 4E.3: versioned strategy governance, explainable opportunity matching,
-- controlled n8n orchestration, and the final Gate 4E.2 function hardening.

ALTER FUNCTION public.approve_participant_normalization(
  UUID, UUID, UUID, INTEGER, JSONB, JSONB
) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.approve_participant_normalization(
  UUID, UUID, UUID, INTEGER, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_participant_normalization(
  UUID, UUID, UUID, INTEGER, JSONB, JSONB
) TO service_role;

CREATE TABLE IF NOT EXISTS public.strategy_lane_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_key TEXT NOT NULL CHECK (lane_key ~ '^[a-z0-9_]+$'),
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  contract_json JSONB NOT NULL CHECK (jsonb_typeof(contract_json) = 'object'),
  source_provenance_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_provenance_json) = 'array'),
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  supersedes_id UUID REFERENCES public.strategy_lane_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lane_key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS strategy_lane_versions_one_active_idx
  ON public.strategy_lane_versions(lane_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS strategy_lane_versions_status_idx
  ON public.strategy_lane_versions(status, lane_key, version DESC);

CREATE TABLE IF NOT EXISTS public.strategy_lane_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_version_id UUID NOT NULL REFERENCES public.strategy_lane_versions(id) ON DELETE RESTRICT,
  experiment_key TEXT NOT NULL,
  execution_mode TEXT NOT NULL DEFAULT 'no_send' CHECK (execution_mode IN ('no_send', 'internal_test', 'approved_live')),
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ended_at TIMESTAMPTZ,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics_json) = 'object'),
  sourced_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sourced_facts_json) = 'array'),
  ai_inferences_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ai_inferences_json) = 'array'),
  learning TEXT,
  decision TEXT CHECK (decision IS NULL OR decision IN ('promote', 'revise', 'retire', 'continue')),
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (strategy_version_id, experiment_key, window_started_at)
);

CREATE TABLE IF NOT EXISTS public.participant_opportunity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_profile_id UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  strategy_version_id UUID REFERENCES public.strategy_lane_versions(id) ON DELETE SET NULL,
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('seller_case', 'capital_case', 'dealvault_opportunity', 'crm_lead', 'participant_profile', 'business_opportunity', 'roadmap_action')),
  target_entity_id TEXT NOT NULL,
  stable_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'dismissed', 'deferred', 'needs_information', 'archived')),
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  score_explanation_json JSONB NOT NULL CHECK (jsonb_typeof(score_explanation_json) = 'object'),
  exclusion_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusion_reasons_json) = 'array'),
  source_provenance_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_provenance_json) = 'array'),
  source_observed_at TIMESTAMPTZ,
  uncertainty TEXT NOT NULL DEFAULT 'medium' CHECK (uncertainty IN ('low', 'medium', 'high')),
  customer_safe_summary TEXT NOT NULL,
  operator_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  crm_lead_id UUID,
  admin_task_id UUID,
  outreach_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS participant_opportunity_matches_profile_idx
  ON public.participant_opportunity_matches(participant_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS participant_opportunity_matches_review_idx
  ON public.participant_opportunity_matches(status, operator_owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.participant_opportunity_match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.participant_opportunity_matches(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('operator', 'customer', 'system')),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS participant_opportunity_match_events_match_idx
  ON public.participant_opportunity_match_events(match_id, created_at);

CREATE TABLE IF NOT EXISTS public.orchestration_controls (
  integration_key TEXT PRIMARY KEY,
  live_send_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  approved_channels_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.orchestration_controls(integration_key, live_send_enabled, kill_switch, approved_channels_json)
VALUES ('n8n', FALSE, FALSE, '["resend_email","outlook_graph","buffer_vestblock","operator_task","manual_phone_task","website_notification","no_outreach"]'::jsonb)
ON CONFLICT (integration_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.orchestration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key TEXT NOT NULL REFERENCES public.orchestration_controls(integration_key) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  strategy_lane_key TEXT,
  strategy_version_id UUID REFERENCES public.strategy_lane_versions(id) ON DELETE SET NULL,
  match_id UUID REFERENCES public.participant_opportunity_matches(id) ON DELETE SET NULL,
  crm_lead_id UUID,
  idempotency_key TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('no_send', 'internal_test', 'approved_live')),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dispatched', 'acknowledged', 'failed', 'suppressed', 'cancelled')),
  request_digest TEXT NOT NULL,
  template_key TEXT,
  template_version INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  response_status INTEGER,
  failure_code TEXT,
  operator_task_id UUID,
  dispatched_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orchestration_runs_status_idx
  ON public.orchestration_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.orchestration_webhook_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  signature_timestamp TIMESTAMPTZ NOT NULL,
  body_digest TEXT NOT NULL,
  event_type TEXT NOT NULL,
  run_id UUID REFERENCES public.orchestration_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_key, idempotency_key)
);

ALTER TABLE public.strategy_lane_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_lane_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_opportunity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_opportunity_match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestration_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestration_webhook_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.strategy_lane_versions, public.strategy_lane_outcomes,
  public.participant_opportunity_matches, public.participant_opportunity_match_events,
  public.orchestration_controls, public.orchestration_runs,
  public.orchestration_webhook_receipts FROM anon, authenticated;
GRANT ALL ON public.strategy_lane_versions, public.strategy_lane_outcomes,
  public.participant_opportunity_matches, public.participant_opportunity_match_events,
  public.orchestration_controls, public.orchestration_runs,
  public.orchestration_webhook_receipts TO service_role;

WITH seed(lane_key, title, objective, target_customer, qualification, sources, customer_path, channels, lawful_basis, conversion_event, kpis) AS (
  VALUES
    ('capital_funding', 'Capital and funding', 'Route qualified business and real-estate capital needs to transparent, appropriate next steps.', 'Business owners, investors, and sponsors seeking capital.', '["Defined use of funds","Identity and business verification","Capacity and timing are documented"]'::jsonb, '["customer-submitted application","verified provider criteria","operator-reviewed CRM activity"]'::jsonb, 'Capital intake, readiness review, then provider matching when eligible.', '["website_notification","outlook_graph","operator_task"]'::jsonb, '["customer request","documented consent before marketing"]'::jsonb, 'Completed qualified capital intake', '["qualified intake rate","document completion","provider review","funded outcome when provider-confirmed"]'::jsonb),
    ('real_estate_buyers_investors', 'Real estate buyers and investors', 'Match verified acquisition criteria with suitable opportunities without implying availability or returns.', 'Active buyers and investors with defined criteria and proof-of-capacity path.', '["Active participant profile","Matching consent","Verified buy box","Fresh capacity status"]'::jsonb, '["participant profile","seller cases","DealVault","operator-reviewed property data"]'::jsonb, 'Profile activation, criteria match, operator review, then customer-safe opportunity notice.', '["website_notification","resend_email","operator_task"]'::jsonb, '["matching consent","separate outreach consent"]'::jsonb, 'Operator-approved opportunity match', '["eligible profiles","reviewed matches","customer interest","verified transaction progression"]'::jsonb),
    ('seller_property_acquisition', 'Sellers and property acquisition', 'Help property owners understand credible sale and transition paths and route qualified cases for review.', 'Property owners or authorized representatives who request help.', '["Authority to discuss property","Property and timing details","No suppression or identity conflict"]'::jsonb, '["seller intake","public property records with timestamps","operator notes"]'::jsonb, 'Seller intake, case review, options analysis, and operator-led next step.', '["outlook_graph","resend_email","operator_task","manual_phone_task"]'::jsonb, '["customer request","documented lawful basis for sourced records","suppression check"]'::jsonb, 'Qualified seller case accepted for operator review', '["complete intakes","qualified conversations","review-to-offer rate","closed outcome when verified"]'::jsonb),
    ('lenders_capital_providers', 'Lenders and capital providers', 'Maintain current provider criteria and route suitable, permissioned demand for provider review.', 'Verified lenders and capital providers.', '["Active provider profile","Operator verification","Current provider-supplied criteria","Matching consent"]'::jsonb, '["provider profile","capital applications","operator verification"]'::jsonb, 'Provider onboarding, criteria verification, match review, and permissioned introduction.', '["outlook_graph","operator_task","website_notification"]'::jsonb, '["provider request","separate outreach permission"]'::jsonb, 'Provider accepts a qualified introduction for review', '["verified providers","criteria freshness","accepted introductions","provider-confirmed outcomes"]'::jsonb),
    ('real_estate_professionals_providers', 'Real estate professionals and providers', 'Connect verified professionals to relevant service, referral, and transaction-support needs.', 'Builders, developers, agents, wholesalers, contractors, and service providers.', '["Active profile","Service area and role verified","Matching consent","Relevant credential checks where applicable"]'::jsonb, '["participant profile","operator-reviewed cases","customer request"]'::jsonb, 'Role-specific profile, verification, controlled match, and operator-approved introduction.', '["website_notification","outlook_graph","operator_task"]'::jsonb, '["matching consent","referral disclosure where applicable"]'::jsonb, 'Operator-approved professional introduction', '["verified profiles","qualified matches","accepted introductions","customer-reported completion"]'::jsonb),
    ('business_buyers_sellers', 'Business buyers and sellers', 'Route verified acquisition interests and confidential business opportunities through controlled review.', 'Business owners considering a sale and qualified prospective buyers.', '["Role and authority verified","Confidentiality boundary accepted","Criteria or business summary complete"]'::jsonb, '["customer-submitted profile","operator-reviewed CRM","approved business opportunity record"]'::jsonb, 'Confidential intake, qualification, controlled matching, and operator-led introduction.', '["website_notification","outlook_graph","operator_task"]'::jsonb, '["customer request","confidentiality and matching consent"]'::jsonb, 'Qualified confidential introduction accepted for review', '["qualified intakes","reviewed matches","accepted introductions","verified transaction stage"]'::jsonb),
    ('next_move_roadmaps', 'Next Move financial roadmaps', 'Provide educational, personalized action roadmaps that help users choose a credible next financial move.', 'People seeking a practical credit, funding, income, or opportunity roadmap.', '["Completed questionnaire","Customer account","Recommendations bounded as education"]'::jsonb, '["customer questionnaire","customer-approved account data","curated educational resources"]'::jsonb, 'Free questionnaire, AI-assisted analysis, customer review, and saved roadmap actions.', '["website_notification","resend_email","operator_task"]'::jsonb, '["customer request","marketing consent only for optional follow-up"]'::jsonb, 'Roadmap generated and saved', '["questionnaire completion","roadmap saves","action completion","customer-reported progress"]'::jsonb),
    ('dealvault_opportunities', 'DealVault opportunities', 'Present documented opportunities and diligence artifacts without implying availability, performance, or returns.', 'Qualified participants reviewing approved real-estate or business opportunities.', '["Authenticated account","Opportunity access rules","Acknowledged diligence boundary"]'::jsonb, '["DealVault record","operator-approved case data","signed proof metadata where applicable"]'::jsonb, 'Browse, review evidence, request access or information, and continue through operator review.', '["website_notification","outlook_graph","operator_task"]'::jsonb, '["customer request","access and confidentiality rules"]'::jsonb, 'Qualified opportunity inquiry', '["qualified views","information requests","operator-reviewed progression","verified closing only"]'::jsonb),
    ('partnerships_referrals', 'Partnerships and referrals', 'Develop reciprocal, transparent relationships that expand qualified routes for VestBlock customers.', 'Organizations and professionals with complementary, verifiable capabilities.', '["Identity verified","Mutual fit","Referral disclosures","No conflicted or prohibited arrangement"]'::jsonb, '["partner profile","operator research","documented referral outcomes"]'::jsonb, 'Partner intake, verification, test referral, measured service quality, then expansion.', '["outlook_graph","operator_task","manual_phone_task"]'::jsonb, '["legitimate interest or partner request","customer consent before an introduction"]'::jsonb, 'Approved test referral accepted', '["verified partners","accepted referrals","service quality","customer-reported outcome"]'::jsonb),
    ('content_visibility', 'Content and visibility', 'Publish useful, accurate financial and opportunity education through VestBlock-owned channels.', 'Prospective customers and participants seeking clear next-step education.', '["Claim substantiated","Source current","Compliance review where required","VestBlock-owned destination"]'::jsonb, '["approved research brief","VestBlock platform guidance","cited primary source"]'::jsonb, 'Educational content leads to the relevant Capital, Real Estate, Opportunity, DealVault, or Next Move path.', '["buffer_vestblock","website_notification","resend_email"]'::jsonb, '["owned audience or valid subscription","platform-specific publishing rules"]'::jsonb, 'Qualified visit to an approved customer path', '["qualified visits","questionnaire starts","profile starts","assisted conversions"]'::jsonb)
)
INSERT INTO public.strategy_lane_versions(lane_key, version, title, status, contract_json, source_provenance_json, approved_at)
SELECT lane_key, 1, title, 'active',
  jsonb_build_object(
    'objective', objective,
    'targetCustomer', target_customer,
    'qualificationCriteria', qualification,
    'approvedDataSources', sources,
    'recommendedCustomerPath', customer_path,
    'outreachMethods', channels,
    'consentOrLawfulBasis', lawful_basis,
    'exclusionsAndSuppressions', jsonb_build_array('Global suppression list', 'Withdrawn, declined, archived, stale, private, or unverified records', 'Identity or permission conflict', 'Protected-class targeting', 'Unsupported or purchased-contact provenance'),
    'primaryConversionEvent', conversion_event,
    'kpis', kpis,
    'costAndCapacityLimits', jsonb_build_object('defaultMode', 'no_send', 'dailyExternalCap', 0, 'requiresOperatorCapacityCheck', true),
    'failureConditions', jsonb_build_array('Missing consent or lawful basis', 'Stale source evidence', 'Identity mismatch', 'Suppression hit', 'Unverified material claim', 'Capacity or cost limit exceeded'),
    'humanReviewRequirements', jsonb_build_array('Material strategy change', 'External outreach activation', 'Customer or provider introduction', 'Financial or underwriting claim'),
    'experimentHypothesis', 'A narrower, permissioned path with explicit qualification will improve qualified progression without increasing complaints or unsupported claims.',
    'learningWindowDays', 30,
    'versionDecisionRule', jsonb_build_object('promote', 'Verified improvement in the primary conversion event with no guardrail regression', 'revise', 'Mixed evidence or a correctable failure condition', 'retire', 'Two completed windows without qualified progress or any material compliance failure')
  ),
  jsonb_build_array(jsonb_build_object('source', 'approved platform operating brief', 'observedAt', NOW(), 'kind', 'operator-approved baseline')),
  NOW()
FROM seed
ON CONFLICT (lane_key, version) DO NOTHING;
