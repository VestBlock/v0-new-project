alter table public.pr_targets
  add column if not exists dedupe_key text,
  add column if not exists target_category text
    not null
    default 'local_small_business'
    check (
      target_category in (
        'minority_business',
        'hispanic_business',
        'black_business',
        'women_owned_business',
        'immigrant_business',
        'local_small_business',
        'chamber',
        'startup',
        'fintech',
        'automation',
        'government_contracting'
      )
    ),
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists metro_area text,
  add column if not exists discovery_source text
    not null
    default 'manual'
    check (
      discovery_source in (
        'manual',
        'city_expansion_seed',
        'category_seed',
        'weekly_learning',
        'operator_research'
      )
    ),
  add column if not exists source_query text,
  add column if not exists revenue_score integer not null default 50 check (revenue_score between 0 and 100),
  add column if not exists authority_score integer not null default 50 check (authority_score between 0 and 100),
  add column if not exists response_probability_score integer not null default 50 check (response_probability_score between 0 and 100),
  add column if not exists business_audience_score integer not null default 50 check (business_audience_score between 0 and 100),
  add column if not exists backlink_score integer not null default 50 check (backlink_score between 0 and 100),
  add column if not exists funding_angle_score integer not null default 50 check (funding_angle_score between 0 and 100),
  add column if not exists city_priority_score integer not null default 50 check (city_priority_score between 0 and 100);

update public.pr_targets
set dedupe_key = lower(
  regexp_replace(
    coalesce(label, '') || '|' || coalesce(city, '') || '|' || coalesce(state, '') || '|' || coalesce(target_type, ''),
    '[^a-z0-9]+',
    '-',
    'g'
  )
)
where dedupe_key is null;

alter table public.pr_targets
  alter column dedupe_key set not null;

create unique index if not exists pr_targets_dedupe_key_idx
  on public.pr_targets (dedupe_key);

create index if not exists pr_targets_category_city_idx
  on public.pr_targets (target_category, state, city, fit_score desc);

create index if not exists pr_targets_city_status_idx
  on public.pr_targets (state, city, status, next_follow_up_at asc nulls last);

create table if not exists public.pr_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null
    check (
      run_type in (
        'target_discovery',
        'city_expansion',
        'pitch_generation',
        'follow_up_enforcement',
        'weekly_learning'
      )
    ),
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  city text,
  state text,
  target_category text
    check (
      target_category in (
        'minority_business',
        'hispanic_business',
        'black_business',
        'women_owned_business',
        'immigrant_business',
        'local_small_business',
        'chamber',
        'startup',
        'fintech',
        'automation',
        'government_contracting'
      )
    ),
  summary_json jsonb not null default '{}'::jsonb,
  created_target_count integer not null default 0,
  created_draft_count integer not null default 0,
  created_task_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pr_runs_type_started_idx
  on public.pr_runs (run_type, started_at desc);

alter table public.pr_runs enable row level security;
revoke all on public.pr_runs from anon;
revoke all on public.pr_runs from authenticated;
grant all on public.pr_runs to service_role;

create table if not exists public.pr_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.pr_runs (id) on delete set null,
  snapshot_type text not null
    check (snapshot_type in ('angle', 'category', 'city', 'operator')),
  angle_key text,
  target_category text
    check (
      target_category in (
        'minority_business',
        'hispanic_business',
        'black_business',
        'women_owned_business',
        'immigrant_business',
        'local_small_business',
        'chamber',
        'startup',
        'fintech',
        'automation',
        'government_contracting'
      )
    ),
  city text,
  state text,
  metrics_json jsonb not null default '{}'::jsonb,
  recommendation text,
  created_at timestamptz not null default now()
);

create index if not exists pr_learning_snapshots_type_idx
  on public.pr_learning_snapshots (snapshot_type, created_at desc);

create index if not exists pr_learning_snapshots_city_idx
  on public.pr_learning_snapshots (state, city, created_at desc);

alter table public.pr_learning_snapshots enable row level security;
revoke all on public.pr_learning_snapshots from anon;
revoke all on public.pr_learning_snapshots from authenticated;
grant all on public.pr_learning_snapshots to service_role;
