-- ServiceDesk AI V2 Wave 2C.3: photo-assisted intake authority.
-- Customer image assets remain separate from quote truth.
-- AI suggestions require human review and can never mutate request pricing or an accepted quote.

create table if not exists public.request_photo_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null,
  source text not null check (source in ('CUSTOMER_UPLOAD','WHATSAPP_MEDIA_REFERENCE')),
  storage_ref text not null check (
    length(trim(storage_ref)) between 3 and 512
    and storage_ref !~* '^(https?://|data:)'
    and storage_ref !~ E'[\\r\\n]'
  ),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  consent_status text not null check (consent_status in ('GRANTED','REVOKED')),
  consent_source text not null check (length(trim(consent_source)) between 2 and 120),
  consent_recorded_at timestamptz not null,
  processing_opt_out boolean not null default false,
  training_allowed boolean not null default false check (training_allowed = false),
  retention_until timestamptz not null,
  state text not null default 'AVAILABLE' check (state in ('AVAILABLE','RETIRED','DELETED')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, request_id, storage_ref),
  foreign key (workspace_id, request_id)
    references public.requests(workspace_id, id) on delete cascade,
  check (retention_until > consent_recorded_at)
);

create index if not exists request_photo_assets_request_idx
  on public.request_photo_assets(workspace_id, request_id, created_at desc);
create index if not exists request_photo_assets_retention_idx
  on public.request_photo_assets(workspace_id, state, retention_until);

create table if not exists public.request_photo_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null,
  photo_asset_id uuid not null,
  classifier_ref text not null check (
    length(trim(classifier_ref)) between 3 and 160
    and classifier_ref !~ E'[\\r\\n]'
  ),
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 200),
  category_code text not null check (category_code ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  proposed_addon_code text check (
    proposed_addon_code is null
    or proposed_addon_code ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'
  ),
  confidence_basis_points integer not null check (confidence_basis_points between 0 and 10000),
  rationale text check (rationale is null or length(rationale) <= 500),
  follow_up_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(follow_up_questions) = 'array'),
  state text not null default 'PENDING_REVIEW'
    check (state in ('PENDING_REVIEW','ACCEPTED','REJECTED','EXPIRED')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, request_id)
    references public.requests(workspace_id, id) on delete cascade,
  foreign key (workspace_id, photo_asset_id)
    references public.request_photo_assets(workspace_id, id) on delete cascade
);

create index if not exists request_photo_suggestions_request_idx
  on public.request_photo_suggestions(workspace_id, request_id, state, generated_at desc);
create index if not exists request_photo_suggestions_asset_idx
  on public.request_photo_suggestions(workspace_id, photo_asset_id, generated_at desc);

alter table public.request_photo_assets enable row level security;
alter table public.request_photo_suggestions enable row level security;

revoke all on table public.request_photo_assets from public, anon, authenticated;
revoke all on table public.request_photo_suggestions from public, anon, authenticated;
grant select on table public.request_photo_assets to authenticated;
grant select on table public.request_photo_suggestions to authenticated;
grant select, insert, update, delete on table public.request_photo_assets to service_role;
grant select, insert, update, delete on table public.request_photo_suggestions to service_role;

drop policy if exists request_photo_assets_staff_select on public.request_photo_assets;
create policy request_photo_assets_staff_select
on public.request_photo_assets
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists request_photo_suggestions_staff_select on public.request_photo_suggestions;
create policy request_photo_suggestions_staff_select
on public.request_photo_suggestions
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

comment on table public.request_photo_assets is
  'Customer intake image metadata. Stores only opaque storage references; training_allowed is permanently false in V2 2C.3.';
comment on table public.request_photo_suggestions is
  'AI photo suggestions are advisory review records. They do not mutate requests, quotes, invoices or payments.';
