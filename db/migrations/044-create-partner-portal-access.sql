create table if not exists public.partner_portal_access (
  id uuid primary key default gen_random_uuid(),
  partner_type text not null check (partner_type in ('lender', 'buyer')),
  partner_id uuid not null,
  partner_name text,
  contact_email text,
  access_token text not null unique,
  access_token_preview text,
  label text,
  last_viewed_at timestamptz,
  last_submitted_at timestamptz,
  last_shared_at timestamptz,
  revoked_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_portal_access_partner_idx
  on public.partner_portal_access (partner_type, partner_id, created_at desc);

create unique index if not exists partner_portal_access_active_partner_idx
  on public.partner_portal_access (partner_type, partner_id)
  where revoked_at is null;

drop trigger if exists partner_portal_access_set_updated_at on public.partner_portal_access;
create trigger partner_portal_access_set_updated_at
before update on public.partner_portal_access
for each row
execute function public.handle_updated_at();

alter table public.partner_portal_access enable row level security;

revoke all on public.partner_portal_access from anon;
revoke all on public.partner_portal_access from authenticated;
grant all on public.partner_portal_access to service_role;
