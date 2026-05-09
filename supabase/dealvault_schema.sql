create extension if not exists "pgcrypto";

create table if not exists public.real_estate_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  deal_id text unique,
  partner_pay_deal_id text,
  external_ref text,
  deal_type text not null,
  status text not null default 'draft',
  title text,
  property_address text,
  property_city text,
  property_state text,
  property_zip text,
  property_hash text,
  seller_name text,
  buyer_name text,
  lead_owner text,
  dispo_partner text,
  buyer_finder text,
  contractor_name text,
  investor_name text,
  title_company text,
  closing_date date,
  contract_price numeric,
  buyer_price numeric,
  assignment_fee numeric,
  earnest_money numeric,
  purchase_price numeric,
  down_payment numeric,
  principal_balance numeric,
  interest_rate numeric,
  monthly_payment numeric,
  term_months integer,
  balloon_date date,
  first_payment_date date,
  option_fee numeric,
  monthly_rent numeric,
  rent_credit numeric,
  option_expiration date,
  expected_fee numeric,
  referral_source text,
  referral_percentage numeric,
  total_project_budget numeric,
  scope_summary text,
  blockchain_tx_hash text,
  blockchain_network text,
  contract_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_estate_deal_proofs (
  id uuid primary key default gen_random_uuid(),
  real_estate_deal_id uuid references public.real_estate_deals(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete cascade,
  proof_id text,
  document_type text,
  title text,
  file_url text,
  document_hash text not null,
  blockchain_tx_hash text,
  blockchain_network text,
  contract_address text,
  certificate_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.real_estate_payout_splits (
  id uuid primary key default gen_random_uuid(),
  real_estate_deal_id uuid not null references public.real_estate_deals(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete cascade,
  participant_name text not null,
  participant_email text,
  participant_role text,
  participant_wallet text,
  bps integer not null,
  amount_owed numeric,
  paid boolean not null default false,
  paid_at timestamptz,
  blockchain_split_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_estate_status_events (
  id uuid primary key default gen_random_uuid(),
  real_estate_deal_id uuid not null references public.real_estate_deals(id) on delete cascade,
  previous_status text,
  new_status text not null,
  note text,
  blockchain_tx_hash text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dealvault_milestone_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  real_estate_deal_id uuid references public.real_estate_deals(id) on delete cascade,
  project_id text unique,
  title text,
  project_type text,
  total_amount numeric,
  status text not null default 'active',
  blockchain_tx_hash text,
  blockchain_network text,
  contract_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealvault_milestone_items (
  id uuid primary key default gen_random_uuid(),
  milestone_project_id uuid not null references public.dealvault_milestone_projects(id) on delete cascade,
  title text not null,
  description text,
  amount numeric,
  due_date date,
  proof_id text,
  status text not null default 'pending',
  blockchain_milestone_index integer,
  submitted_at timestamptz,
  approved_at timestamptz,
  disputed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealvault_blockchain_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  related_table text,
  related_id uuid,
  tx_hash text,
  chain_id integer,
  network text,
  contract_address text,
  method_name text,
  status text,
  error_message text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.dealvault_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.dealvault_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  plan text not null default 'off',
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealvault_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  idempotency_key text not null unique,
  request_hash text,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dealvault_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.dealvault_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_real_estate_deals_updated on public.real_estate_deals;
create trigger trg_real_estate_deals_updated
before update on public.real_estate_deals
for each row execute function public.dealvault_set_updated_at();

drop trigger if exists trg_real_estate_payout_splits_updated on public.real_estate_payout_splits;
create trigger trg_real_estate_payout_splits_updated
before update on public.real_estate_payout_splits
for each row execute function public.dealvault_set_updated_at();

drop trigger if exists trg_dealvault_milestone_projects_updated on public.dealvault_milestone_projects;
create trigger trg_dealvault_milestone_projects_updated
before update on public.dealvault_milestone_projects
for each row execute function public.dealvault_set_updated_at();

drop trigger if exists trg_dealvault_milestone_items_updated on public.dealvault_milestone_items;
create trigger trg_dealvault_milestone_items_updated
before update on public.dealvault_milestone_items
for each row execute function public.dealvault_set_updated_at();

drop trigger if exists trg_dealvault_subscriptions_updated on public.dealvault_subscriptions;
create trigger trg_dealvault_subscriptions_updated
before update on public.dealvault_subscriptions
for each row execute function public.dealvault_set_updated_at();

create index if not exists idx_real_estate_deals_user_id on public.real_estate_deals(user_id);
create index if not exists idx_real_estate_deals_status on public.real_estate_deals(status);
create index if not exists idx_real_estate_deals_created_at on public.real_estate_deals(created_at desc);
create index if not exists idx_real_estate_deal_proofs_deal_id on public.real_estate_deal_proofs(real_estate_deal_id);
create index if not exists idx_real_estate_payout_splits_deal_id on public.real_estate_payout_splits(real_estate_deal_id);
create index if not exists idx_real_estate_status_events_deal_id on public.real_estate_status_events(real_estate_deal_id);
create index if not exists idx_dealvault_milestone_projects_deal_id on public.dealvault_milestone_projects(real_estate_deal_id);
create index if not exists idx_dealvault_milestone_items_project_id on public.dealvault_milestone_items(milestone_project_id);
create index if not exists idx_dealvault_blockchain_transactions_status on public.dealvault_blockchain_transactions(status);
create index if not exists idx_dealvault_audit_logs_created_at on public.dealvault_audit_logs(created_at desc);
create index if not exists idx_dealvault_usage_logs_user_id on public.dealvault_usage_logs(user_id);
