-- ServiceDesk AI V2 Wave 2D.3A: versioned vertical-pack governance.
-- This migration creates the generic pack boundary without claiming a second supported vertical.
-- CLEANING is the existing baseline pack. Any new pack must carry verified buyer evidence before activation.

create table if not exists public.vertical_pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_code text not null check (
    pack_code = upper(pack_code)
    and pack_code ~ '^[A-Z0-9][A-Z0-9_-]{2,63}$'
  ),
  version_number integer not null check (version_number > 0),
  state text not null check (state in ('DRAFT','RELEASED','RETIRED')),
  evidence_status text not null check (
    evidence_status in ('BASELINE_EXISTING','BUYER_EVIDENCE_BLOCKED','BUYER_EVIDENCE_VERIFIED')
  ),
  service_schema jsonb not null,
  intake_schema jsonb not null,
  checklist_template jsonb not null,
  duration_adapter_key text not null check (
    duration_adapter_key ~ '^[A-Z0-9][A-Z0-9_:-]{2,119}$'
  ),
  pricing_adapter_key text not null check (
    pricing_adapter_key ~ '^[A-Z0-9][A-Z0-9_:-]{2,119}$'
  ),
  policy_schema jsonb not null,
  release_notes text check (release_notes is null or length(release_notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (pack_code, version_number),
  check (jsonb_typeof(service_schema) = 'object'),
  check (jsonb_typeof(intake_schema) = 'object'),
  check (jsonb_typeof(checklist_template) = 'object'),
  check (jsonb_typeof(policy_schema) = 'object'),
  check (
    pack_code = 'CLEANING'
    or state <> 'RELEASED'
    or evidence_status = 'BUYER_EVIDENCE_VERIFIED'
  )
);

create table if not exists public.workspace_vertical_packs (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pack_code text not null,
  version_number integer not null,
  status text not null check (status in ('ENABLED','DISABLED')),
  enabled_by uuid references auth.users(id),
  enabled_at timestamptz,
  disabled_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, pack_code),
  foreign key (pack_code, version_number)
    references public.vertical_pack_versions(pack_code, version_number) on delete restrict,
  check (
    (status = 'ENABLED' and enabled_at is not null and disabled_at is null)
    or
    (status = 'DISABLED')
  )
);

create table if not exists public.service_catalog_vertical_bindings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_id uuid not null,
  pack_code text not null,
  version_number integer not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, service_id),
  foreign key (workspace_id, service_id)
    references public.service_catalog(workspace_id, id) on delete cascade,
  foreign key (workspace_id, pack_code)
    references public.workspace_vertical_packs(workspace_id, pack_code) on delete restrict,
  foreign key (pack_code, version_number)
    references public.vertical_pack_versions(pack_code, version_number) on delete restrict
);

create index if not exists workspace_vertical_packs_status_idx
  on public.workspace_vertical_packs(workspace_id, status, pack_code);
create index if not exists service_catalog_vertical_pack_idx
  on public.service_catalog_vertical_bindings(workspace_id, pack_code, service_id);

alter table public.vertical_pack_versions enable row level security;
alter table public.workspace_vertical_packs enable row level security;
alter table public.service_catalog_vertical_bindings enable row level security;

revoke all on table public.vertical_pack_versions from public, anon, authenticated;
revoke all on table public.workspace_vertical_packs from public, anon, authenticated;
revoke all on table public.service_catalog_vertical_bindings from public, anon, authenticated;

grant select on table public.vertical_pack_versions to authenticated;
grant select on table public.workspace_vertical_packs to authenticated;
grant select on table public.service_catalog_vertical_bindings to authenticated;
grant select, insert, update, delete on table public.vertical_pack_versions to service_role;
grant select, insert, update, delete on table public.workspace_vertical_packs to service_role;
grant select, insert, update, delete on table public.service_catalog_vertical_bindings to service_role;

drop policy if exists vertical_pack_versions_staff_select on public.vertical_pack_versions;
create policy vertical_pack_versions_staff_select
on public.vertical_pack_versions
for select to authenticated
using (public.has_active_membership((select m.workspace_id from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1)));

drop policy if exists workspace_vertical_packs_staff_select on public.workspace_vertical_packs;
create policy workspace_vertical_packs_staff_select
on public.workspace_vertical_packs
for select to authenticated
using (public.has_active_membership(workspace_id));

drop policy if exists service_catalog_vertical_bindings_staff_select on public.service_catalog_vertical_bindings;
create policy service_catalog_vertical_bindings_staff_select
on public.service_catalog_vertical_bindings
for select to authenticated
using (public.has_active_membership(workspace_id));

insert into public.vertical_pack_versions(
  pack_code, version_number, state, evidence_status,
  service_schema, intake_schema, checklist_template,
  duration_adapter_key, pricing_adapter_key, policy_schema, release_notes
) values (
  'CLEANING',
  1,
  'RELEASED',
  'BASELINE_EXISTING',
  '{"schemaVersion":1,"serviceCodePattern":"^[A-Z0-9_:-]{2,80}$"}'::jsonb,
  '{"schemaVersion":1,"allowedFields":["bedrooms","bathrooms","requestedStartAt","structuredFields"]}'::jsonb,
  '{"schemaVersion":1,"templateKey":"CLEANING_DEFAULT_V1","requiresCompletionEvidence":true}'::jsonb,
  'CLEANING_DURATION_V1',
  'CLEANING_PRICE_V1',
  '{"schemaVersion":1,"acceptedQuoteMutation":"EXPLICIT_REVISION_ONLY","paymentAuthority":"CORE_LEDGER"}'::jsonb,
  'Existing ServiceDesk cleaning operations baseline; this is not evidence for another vertical.'
)
on conflict (pack_code, version_number) do nothing;

insert into public.workspace_vertical_packs(
  workspace_id, pack_code, version_number, status, enabled_at, created_at, updated_at
)
select w.id, 'CLEANING', 1, 'ENABLED', now(), now(), now()
from public.workspaces w
on conflict (workspace_id, pack_code) do nothing;

insert into public.service_catalog_vertical_bindings(
  workspace_id, service_id, pack_code, version_number
)
select s.workspace_id, s.id, 'CLEANING', 1
from public.service_catalog s
on conflict (workspace_id, service_id) do nothing;

create or replace function public.servicedesk_enable_vertical_pack(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_pack text := upper(trim(p_input->>'packCode'));
  v_version integer := nullif(p_input->>'versionNumber','')::integer;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_pack_version public.vertical_pack_versions%rowtype;
  v_row public.workspace_vertical_packs%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_pack is null or v_version is null then
    return jsonb_build_object('ok', false, 'code', 'VERTICAL_PACK_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_pack_version
  from public.vertical_pack_versions
  where pack_code = v_pack and version_number = v_version;

  if not found or v_pack_version.state <> 'RELEASED' then
    return jsonb_build_object('ok', false, 'code', 'VERTICAL_PACK_NOT_RELEASED');
  end if;

  if v_pack <> 'CLEANING'
     and v_pack_version.evidence_status <> 'BUYER_EVIDENCE_VERIFIED' then
    return jsonb_build_object('ok', false, 'code', 'VERTICAL_PACK_BUYER_EVIDENCE_REQUIRED');
  end if;

  insert into public.workspace_vertical_packs(
    workspace_id, pack_code, version_number, status,
    enabled_by, enabled_at, disabled_at, version, created_at, updated_at
  ) values (
    v_workspace, v_pack, v_version, 'ENABLED',
    v_actor, v_now, null, 1, v_now, v_now
  )
  on conflict (workspace_id, pack_code) do update
  set version_number = excluded.version_number,
      status = 'ENABLED',
      enabled_by = v_actor,
      enabled_at = v_now,
      disabled_at = null,
      version = public.workspace_vertical_packs.version + 1,
      updated_at = v_now
  returning * into v_row;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type,
    resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor, v_role,
    'VERTICAL_PACK_ENABLED', 'vertical_pack', null,
    jsonb_build_object(
      'packCode', v_row.pack_code,
      'versionNumber', v_row.version_number,
      'evidenceStatus', v_pack_version.evidence_status
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'packCode', v_row.pack_code,
    'versionNumber', v_row.version_number,
    'status', v_row.status
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'VERTICAL_PACK_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_enable_vertical_pack(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_enable_vertical_pack(jsonb) to service_role;

comment on table public.vertical_pack_versions is
  'Versioned vertical-pack manifests. A non-cleaning RELEASED pack requires verified buyer evidence before workspace activation.';
comment on table public.service_catalog_vertical_bindings is
  'Binds each workspace service to one vertical pack/version without modifying shared contract, payment or tenant authority.';
