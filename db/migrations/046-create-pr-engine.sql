create table if not exists public.pr_targets (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  organization_name text,
  contact_name text,
  contact_email text,
  target_type text not null default 'newsletter'
    check (
      target_type in (
        'newsletter',
        'directory',
        'journalist',
        'podcast',
        'community',
        'partner',
        'award',
        'expert_source',
        'chamber',
        'group'
      )
    ),
  audience_type text,
  audience_url text,
  submission_url text,
  status text not null default 'new'
    check (
      status in (
        'new',
        'researching',
        'ready',
        'pitched',
        'submitted',
        'follow_up_due',
        'won',
        'not_a_fit',
        'archived'
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  fit_score integer not null default 50 check (fit_score between 0 and 100),
  owner_user_id uuid,
  geography text[] not null default '{}'::text[],
  angle_tags text[] not null default '{}'::text[],
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  last_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pr_targets_status_priority_idx
  on public.pr_targets (status, priority, fit_score desc, updated_at desc);

create index if not exists pr_targets_followup_idx
  on public.pr_targets (next_follow_up_at asc nulls last, status);

create index if not exists pr_targets_type_idx
  on public.pr_targets (target_type, fit_score desc, created_at desc);

drop trigger if exists pr_targets_set_updated_at on public.pr_targets;
create trigger pr_targets_set_updated_at
before update on public.pr_targets
for each row
execute function public.handle_updated_at();

alter table public.pr_targets enable row level security;
revoke all on public.pr_targets from anon;
revoke all on public.pr_targets from authenticated;
grant all on public.pr_targets to service_role;

create table if not exists public.pr_pitch_drafts (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.pr_targets (id) on delete cascade,
  title text not null,
  pitch_channel text not null default 'email'
    check (pitch_channel in ('email', 'form', 'dm', 'application', 'quote')),
  subject_line text,
  preview_text text,
  body_markdown text not null,
  founder_bio text,
  key_points text[] not null default '{}'::text[],
  call_to_action text,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'archived')),
  source_prompt text,
  model text,
  metadata_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pr_pitch_drafts_target_idx
  on public.pr_pitch_drafts (target_id, status, updated_at desc);

create index if not exists pr_pitch_drafts_status_idx
  on public.pr_pitch_drafts (status, generated_at desc);

drop trigger if exists pr_pitch_drafts_set_updated_at on public.pr_pitch_drafts;
create trigger pr_pitch_drafts_set_updated_at
before update on public.pr_pitch_drafts
for each row
execute function public.handle_updated_at();

alter table public.pr_pitch_drafts enable row level security;
revoke all on public.pr_pitch_drafts from anon;
revoke all on public.pr_pitch_drafts from authenticated;
grant all on public.pr_pitch_drafts to service_role;

create table if not exists public.pr_outreach_log (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.pr_targets (id) on delete cascade,
  draft_id uuid references public.pr_pitch_drafts (id) on delete set null,
  activity_type text not null default 'submission'
    check (activity_type in ('submission', 'follow_up', 'reply', 'feature', 'rejection', 'note')),
  channel text not null default 'email'
    check (channel in ('email', 'form', 'dm', 'application', 'quote', 'other')),
  status text not null default 'waiting'
    check (status in ('queued', 'sent', 'waiting', 'won', 'lost', 'archived')),
  subject text,
  message_excerpt text,
  destination text,
  sent_at timestamptz,
  responded_at timestamptz,
  next_follow_up_at timestamptz,
  outcome text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pr_outreach_log_target_idx
  on public.pr_outreach_log (target_id, created_at desc);

create index if not exists pr_outreach_log_status_idx
  on public.pr_outreach_log (status, next_follow_up_at asc nulls last, created_at desc);

drop trigger if exists pr_outreach_log_set_updated_at on public.pr_outreach_log;
create trigger pr_outreach_log_set_updated_at
before update on public.pr_outreach_log
for each row
execute function public.handle_updated_at();

alter table public.pr_outreach_log enable row level security;
revoke all on public.pr_outreach_log from anon;
revoke all on public.pr_outreach_log from authenticated;
grant all on public.pr_outreach_log to service_role;
