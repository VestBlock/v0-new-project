create schema if not exists private;

create or replace function private.vestblock_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_profiles
    where (user_profiles.user_id = auth.uid() or user_profiles.id = auth.uid())
      and coalesce(user_profiles.role, 'user') = 'admin'
  );
$$;

revoke all on function private.vestblock_is_admin() from public;
grant execute on function private.vestblock_is_admin() to authenticated;
grant usage on schema private to authenticated;

alter table public.real_estate_deals enable row level security;
alter table public.real_estate_deal_proofs enable row level security;
alter table public.real_estate_payout_splits enable row level security;
alter table public.real_estate_status_events enable row level security;
alter table public.dealvault_milestone_projects enable row level security;
alter table public.dealvault_milestone_items enable row level security;
alter table public.dealvault_blockchain_transactions enable row level security;
alter table public.dealvault_audit_logs enable row level security;
alter table public.dealvault_subscriptions enable row level security;
alter table public.dealvault_idempotency_keys enable row level security;
alter table public.dealvault_usage_logs enable row level security;

drop policy if exists "Users can manage their own real estate deals" on public.real_estate_deals;
create policy "Users can manage their own real estate deals"
on public.real_estate_deals
for all
using (auth.uid() = user_id or private.vestblock_is_admin())
with check (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Users can manage their own real estate proofs" on public.real_estate_deal_proofs;
create policy "Users can manage their own real estate proofs"
on public.real_estate_deal_proofs
for all
using (auth.uid() = user_id or private.vestblock_is_admin())
with check (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Users can manage their own payout splits" on public.real_estate_payout_splits;
create policy "Users can manage their own payout splits"
on public.real_estate_payout_splits
for all
using (auth.uid() = user_id or private.vestblock_is_admin())
with check (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Users can view their own status events" on public.real_estate_status_events;
create policy "Users can view their own status events"
on public.real_estate_status_events
for select
using (
  private.vestblock_is_admin()
  or exists (
    select 1
    from public.real_estate_deals
    where real_estate_deals.id = real_estate_status_events.real_estate_deal_id
      and real_estate_deals.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage status events" on public.real_estate_status_events;
create policy "Admins can manage status events"
on public.real_estate_status_events
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

drop policy if exists "Users can manage milestone projects" on public.dealvault_milestone_projects;
create policy "Users can manage milestone projects"
on public.dealvault_milestone_projects
for all
using (auth.uid() = user_id or private.vestblock_is_admin())
with check (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Users can view milestone items for their projects" on public.dealvault_milestone_items;
create policy "Users can view milestone items for their projects"
on public.dealvault_milestone_items
for select
using (
  private.vestblock_is_admin()
  or exists (
    select 1
    from public.dealvault_milestone_projects
    where dealvault_milestone_projects.id = dealvault_milestone_items.milestone_project_id
      and dealvault_milestone_projects.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage milestone items" on public.dealvault_milestone_items;
create policy "Admins can manage milestone items"
on public.dealvault_milestone_items
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

drop policy if exists "Users can view their own blockchain transactions" on public.dealvault_blockchain_transactions;
create policy "Users can view their own blockchain transactions"
on public.dealvault_blockchain_transactions
for select
using (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Admins can manage blockchain transactions" on public.dealvault_blockchain_transactions;
create policy "Admins can manage blockchain transactions"
on public.dealvault_blockchain_transactions
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

drop policy if exists "Users can view their own audit logs" on public.dealvault_audit_logs;
create policy "Users can view their own audit logs"
on public.dealvault_audit_logs
for select
using (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Admins can manage audit logs" on public.dealvault_audit_logs;
create policy "Admins can manage audit logs"
on public.dealvault_audit_logs
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

drop policy if exists "Users can view their own subscriptions" on public.dealvault_subscriptions;
create policy "Users can view their own subscriptions"
on public.dealvault_subscriptions
for select
using (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Admins can manage subscriptions" on public.dealvault_subscriptions;
create policy "Admins can manage subscriptions"
on public.dealvault_subscriptions
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

drop policy if exists "Admins can manage idempotency keys" on public.dealvault_idempotency_keys;
create policy "Admins can manage idempotency keys"
on public.dealvault_idempotency_keys
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

drop policy if exists "Users can view their own usage logs" on public.dealvault_usage_logs;
create policy "Users can view their own usage logs"
on public.dealvault_usage_logs
for select
using (auth.uid() = user_id or private.vestblock_is_admin());

drop policy if exists "Admins can manage usage logs" on public.dealvault_usage_logs;
create policy "Admins can manage usage logs"
on public.dealvault_usage_logs
for all
using (private.vestblock_is_admin())
with check (private.vestblock_is_admin());

grant all on public.real_estate_deals to service_role;
grant all on public.real_estate_deal_proofs to service_role;
grant all on public.real_estate_payout_splits to service_role;
grant all on public.real_estate_status_events to service_role;
grant all on public.dealvault_milestone_projects to service_role;
grant all on public.dealvault_milestone_items to service_role;
grant all on public.dealvault_blockchain_transactions to service_role;
grant all on public.dealvault_audit_logs to service_role;
grant all on public.dealvault_subscriptions to service_role;
grant all on public.dealvault_idempotency_keys to service_role;
grant all on public.dealvault_usage_logs to service_role;
