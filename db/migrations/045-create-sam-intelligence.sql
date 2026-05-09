create table if not exists public.sam_watchlists (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  watch_type text not null default 'opportunity' check (watch_type in ('opportunity', 'competitor', 'assistance')),
  owner_user_id uuid,
  lead_id uuid references public.leads (id) on delete set null,
  user_email text,
  company_name text,
  keywords text[] not null default '{}'::text[],
  naics_codes text[] not null default '{}'::text[],
  solicitation_types text[] not null default '{}'::text[],
  set_asides text[] not null default '{}'::text[],
  agency_codes text[] not null default '{}'::text[],
  organization_codes text[] not null default '{}'::text[],
  applicant_types text[] not null default '{}'::text[],
  beneficiary_types text[] not null default '{}'::text[],
  assistance_types text[] not null default '{}'::text[],
  states text[] not null default '{}'::text[],
  zip_codes text[] not null default '{}'::text[],
  response_deadline_days integer,
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sam_watchlists_status_idx
  on public.sam_watchlists (status, watch_type, created_at desc);

create index if not exists sam_watchlists_lead_idx
  on public.sam_watchlists (lead_id);

drop trigger if exists sam_watchlists_set_updated_at on public.sam_watchlists;
create trigger sam_watchlists_set_updated_at
before update on public.sam_watchlists
for each row
execute function public.handle_updated_at();

alter table public.sam_watchlists enable row level security;
revoke all on public.sam_watchlists from anon;
revoke all on public.sam_watchlists from authenticated;
grant all on public.sam_watchlists to service_role;

create table if not exists public.sam_opportunities (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  notice_id text,
  solicitation_number text,
  source_key text not null default 'sam_opportunities_api',
  title text not null,
  opportunity_type text,
  base_type text,
  active_status text,
  posted_date date,
  response_deadline timestamptz,
  naics_code text,
  classification_code text,
  set_aside_code text,
  set_aside_description text,
  department_name text,
  agency_name text,
  office_name text,
  organization_path_name text,
  organization_path_code text,
  organization_type text,
  state text,
  city text,
  zip text,
  place_of_performance_json jsonb not null default '{}'::jsonb,
  office_address_json jsonb not null default '{}'::jsonb,
  point_of_contact_json jsonb not null default '[]'::jsonb,
  award_json jsonb not null default '{}'::jsonb,
  resource_links text[] not null default '{}'::text[],
  description_url text,
  additional_info_link text,
  ui_link text,
  description_excerpt text,
  watchlist_match_count integer not null default 0,
  lead_match_count integer not null default 0,
  urgency_score integer not null default 0,
  best_offer text,
  bid_recommendation_json jsonb not null default '{}'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived', 'matched', 'dismissed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sam_opportunities_notice_idx
  on public.sam_opportunities (notice_id, solicitation_number);

create index if not exists sam_opportunities_deadline_idx
  on public.sam_opportunities (status, response_deadline asc nulls last, urgency_score desc);

create index if not exists sam_opportunities_agency_idx
  on public.sam_opportunities (agency_name, naics_code, posted_date desc);

create index if not exists sam_opportunities_match_idx
  on public.sam_opportunities (watchlist_match_count desc, lead_match_count desc, updated_at desc);

drop trigger if exists sam_opportunities_set_updated_at on public.sam_opportunities;
create trigger sam_opportunities_set_updated_at
before update on public.sam_opportunities
for each row
execute function public.handle_updated_at();

alter table public.sam_opportunities enable row level security;
revoke all on public.sam_opportunities from anon;
revoke all on public.sam_opportunities from authenticated;
grant all on public.sam_opportunities to service_role;

create table if not exists public.sam_opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.sam_opportunities (id) on delete cascade,
  document_type text not null check (document_type in ('description', 'attachment', 'additional_info')),
  title text,
  source_url text not null,
  fetch_status text not null default 'queued' check (fetch_status in ('queued', 'fetched', 'skipped', 'failed')),
  content_text text,
  content_json jsonb not null default '{}'::jsonb,
  content_sha256 text,
  error_message text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, source_url)
);

create index if not exists sam_opportunity_documents_status_idx
  on public.sam_opportunity_documents (fetch_status, created_at desc);

drop trigger if exists sam_opportunity_documents_set_updated_at on public.sam_opportunity_documents;
create trigger sam_opportunity_documents_set_updated_at
before update on public.sam_opportunity_documents
for each row
execute function public.handle_updated_at();

alter table public.sam_opportunity_documents enable row level security;
revoke all on public.sam_opportunity_documents from anon;
revoke all on public.sam_opportunity_documents from authenticated;
grant all on public.sam_opportunity_documents to service_role;

create table if not exists public.sam_entity_profiles (
  id uuid primary key default gen_random_uuid(),
  uei_sam text not null unique,
  legal_business_name text,
  dba_name text,
  sam_registered text,
  registration_status text,
  purpose_of_registration text,
  exclusion_status_flag text,
  entity_structure text,
  business_types text[] not null default '{}'::text[],
  naics_codes text[] not null default '{}'::text[],
  psc_codes text[] not null default '{}'::text[],
  address_json jsonb not null default '{}'::jsonb,
  points_of_contact_json jsonb not null default '[]'::jsonb,
  integrity_json jsonb not null default '{}'::jsonb,
  responsibility_information_count integer not null default 0,
  latest_exclusion_url text,
  source_version text,
  raw_json jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sam_entity_profiles_registration_idx
  on public.sam_entity_profiles (registration_status, exclusion_status_flag, last_synced_at desc);

drop trigger if exists sam_entity_profiles_set_updated_at on public.sam_entity_profiles;
create trigger sam_entity_profiles_set_updated_at
before update on public.sam_entity_profiles
for each row
execute function public.handle_updated_at();

alter table public.sam_entity_profiles enable row level security;
revoke all on public.sam_entity_profiles from anon;
revoke all on public.sam_entity_profiles from authenticated;
grant all on public.sam_entity_profiles to service_role;

create table if not exists public.sam_exclusion_checks (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('lead', 'watchlist', 'entity', 'partner', 'manual')),
  subject_id uuid,
  subject_label text,
  uei_sam text,
  legal_business_name text,
  exclusion_name text,
  exclusion_type text,
  classification text,
  exclusion_record_id text,
  excluding_agency_name text,
  excluding_agency_code text,
  active_exclusion boolean not null default false,
  match_status text not null default 'no_match' check (match_status in ('no_match', 'possible_match', 'confirmed_match', 'error')),
  exclusion_url text,
  checked_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sam_exclusion_checks_subject_idx
  on public.sam_exclusion_checks (subject_type, subject_id, checked_at desc);

create index if not exists sam_exclusion_checks_match_idx
  on public.sam_exclusion_checks (active_exclusion, match_status, checked_at desc);

alter table public.sam_exclusion_checks enable row level security;
revoke all on public.sam_exclusion_checks from anon;
revoke all on public.sam_exclusion_checks from authenticated;
grant all on public.sam_exclusion_checks to service_role;

create table if not exists public.sam_alert_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('opportunity_ingest', 'match_scoring', 'exclusion_recheck', 'award_monitor', 'assistance_refresh', 'alert_delivery')),
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  watchlist_id uuid references public.sam_watchlists (id) on delete set null,
  request_params jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  sent_count integer not null default 0,
  matched_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sam_alert_runs_type_idx
  on public.sam_alert_runs (run_type, started_at desc);

alter table public.sam_alert_runs enable row level security;
revoke all on public.sam_alert_runs from anon;
revoke all on public.sam_alert_runs from authenticated;
grant all on public.sam_alert_runs to service_role;

create table if not exists public.sam_award_intelligence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.sam_opportunities (id) on delete set null,
  dedupe_key text not null unique,
  notice_id text,
  award_number text,
  awardee_name text,
  awardee_uei_sam text,
  award_amount numeric(14,2),
  award_date date,
  department_name text,
  agency_name text,
  office_name text,
  naics_code text,
  set_aside_code text,
  title text,
  place_of_performance_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  tracked_competitor boolean not null default false,
  watchlist_match_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sam_award_intelligence_award_idx
  on public.sam_award_intelligence (award_date desc, agency_name, naics_code);

drop trigger if exists sam_award_intelligence_set_updated_at on public.sam_award_intelligence;
create trigger sam_award_intelligence_set_updated_at
before update on public.sam_award_intelligence
for each row
execute function public.handle_updated_at();

alter table public.sam_award_intelligence enable row level security;
revoke all on public.sam_award_intelligence from anon;
revoke all on public.sam_award_intelligence from authenticated;
grant all on public.sam_award_intelligence to service_role;

create table if not exists public.sam_assistance_listings (
  id uuid primary key default gen_random_uuid(),
  assistance_listing_id text not null unique,
  title text not null,
  status text,
  agency_name text,
  department_name text,
  office_name text,
  assistance_types text[] not null default '{}'::text[],
  applicant_types text[] not null default '{}'::text[],
  beneficiary_types text[] not null default '{}'::text[],
  published_date date,
  program_url text,
  summary_text text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sam_assistance_listings_status_idx
  on public.sam_assistance_listings (status, published_date desc);

drop trigger if exists sam_assistance_listings_set_updated_at on public.sam_assistance_listings;
create trigger sam_assistance_listings_set_updated_at
before update on public.sam_assistance_listings
for each row
execute function public.handle_updated_at();

alter table public.sam_assistance_listings enable row level security;
revoke all on public.sam_assistance_listings from anon;
revoke all on public.sam_assistance_listings from authenticated;
grant all on public.sam_assistance_listings to service_role;
