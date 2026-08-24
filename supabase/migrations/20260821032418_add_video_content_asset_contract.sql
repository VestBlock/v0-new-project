-- Add governed video briefs, scripts, and renders to the existing content ledger.
-- Public access remains limited to published SEO pages by the existing RLS policy.

alter table public.content_assets
  drop constraint if exists content_assets_content_type_check;

alter table public.content_assets
  add constraint content_assets_content_type_check
  check (
    content_type in (
      'seo_page',
      'social_post',
      'campaign',
      'video_brief',
      'video_script',
      'video_render'
    )
  );

alter table public.content_assets
  add column if not exists parent_content_id uuid
    references public.content_assets(id) on delete set null,
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists scheduled_at timestamptz;

alter table public.content_assets
  drop constraint if exists content_assets_approval_status_check;

alter table public.content_assets
  add constraint content_assets_approval_status_check
  check (
    approval_status in (
      'not_required',
      'review_required',
      'approved',
      'changes_requested',
      'rejected'
    )
  );

create index if not exists idx_content_assets_parent_content_id
  on public.content_assets(parent_content_id)
  where parent_content_id is not null;

create index if not exists idx_content_assets_video_queue
  on public.content_assets(content_type, approval_status, status, updated_at desc)
  where content_type in ('video_brief', 'video_script', 'video_render');

comment on column public.content_assets.parent_content_id is
  'Lineage link from a video script to its brief or from a render to its approved script.';

comment on column public.content_assets.approval_status is
  'Human review state. Video scripts and renders must be approved before downstream public actions.';
