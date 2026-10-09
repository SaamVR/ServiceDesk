-- ServiceDesk AI V2 Wave 2D.1: branch tenancy foundation.
-- Branch is a scoped dimension inside a workspace. It never widens tenant access.
-- Existing workspaces receive one MAIN branch and existing active staff are assigned to it.

create table if not exists public.workspace_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (
    code = upper(code)
    and code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
  ),
  name text not null check (length(trim(name)) between 1 and 120),
  timezone text not null,
  currency char(3) not null,
  is_default boolean not null default false,
  active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, code)
);

create unique index if not exists workspace_branches_one_default_idx
  on public.workspace_branches(workspace_id)
  where is_default;

insert into public.workspace_branches(
  workspace_id, code, name, timezone, currency, is_default, active
)
select w.id, 'MAIN', w.name, w.timezone, w.currency, true, true
from public.workspaces w
where not exists (
  select 1 from public.workspace_branches b
  where b.workspace_id = w.id
);

create table if not exists public.branch_memberships (
  workspace_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, branch_id, user_id),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.memberships(workspace_id, user_id) on delete cascade
);

insert into public.branch_memberships(workspace_id, branch_id, user_id, status)
select m.workspace_id, b.id, m.user_id, 'ACTIVE'
from public.memberships m
join public.workspace_branches b
  on b.workspace_id = m.workspace_id
 and b.is_default
where m.status = 'ACTIVE'
on conflict (workspace_id, branch_id, user_id) do nothing;

create or replace function public.servicedesk_default_branch(target_workspace uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.workspace_branches b
  where b.workspace_id = target_workspace
    and b.is_default
    and b.active
  limit 1;
$$;

create or replace function public.servicedesk_has_branch_access(
  target_workspace uuid,
  target_branch uuid,
  allowed_roles public.membership_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and (allowed_roles is null or m.role = any(allowed_roles))
      and (
        m.role = 'OWNER'
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.workspace_id = target_workspace
            and bm.branch_id = target_branch
            and bm.user_id = m.user_id
            and bm.status = 'ACTIVE'
        )
      )
  );
$$;

create or replace function public.servicedesk_actor_is_workspace_owner(
  target_workspace uuid,
  actor_user uuid,
  actor_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select actor_role = 'OWNER' and exists (
    select 1
    from public.memberships m
    where m.workspace_id = target_workspace
      and m.user_id = actor_user
      and m.status = 'ACTIVE'
      and m.role = 'OWNER'
  );
$$;

create or replace function public.servicedesk_actor_has_branch_access(
  target_workspace uuid,
  target_branch uuid,
  actor_user uuid,
  actor_role text,
  allowed_roles public.membership_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = target_workspace
      and m.user_id = actor_user
      and m.status = 'ACTIVE'
      and m.role::text = actor_role
      and (allowed_roles is null or m.role = any(allowed_roles))
      and (
        m.role = 'OWNER'
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.workspace_id = target_workspace
            and bm.branch_id = target_branch
            and bm.user_id = actor_user
            and bm.status = 'ACTIVE'
        )
      )
  );
$$;

revoke all on function public.servicedesk_default_branch(uuid) from public;
revoke all on function public.servicedesk_has_branch_access(uuid, uuid, public.membership_role[]) from public;
revoke all on function public.servicedesk_actor_is_workspace_owner(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.servicedesk_actor_has_branch_access(uuid, uuid, uuid, text, public.membership_role[]) from public, anon, authenticated;
grant execute on function public.servicedesk_default_branch(uuid) to authenticated, service_role;
grant execute on function public.servicedesk_has_branch_access(uuid, uuid, public.membership_role[]) to authenticated, service_role;
grant execute on function public.servicedesk_actor_is_workspace_owner(uuid, uuid, text) to service_role;
grant execute on function public.servicedesk_actor_has_branch_access(uuid, uuid, uuid, text, public.membership_role[]) to service_role;

alter table public.properties add column if not exists branch_id uuid;
alter table public.requests add column if not exists branch_id uuid;
alter table public.conversations add column if not exists branch_id uuid;
alter table public.crews add column if not exists branch_id uuid;
alter table public.capacity_slots add column if not exists branch_id uuid;
alter table public.visits add column if not exists branch_id uuid;
alter table public.recurrence_rules add column if not exists branch_id uuid;

update public.properties p
set branch_id = public.servicedesk_default_branch(p.workspace_id)
where p.branch_id is null;

update public.requests r
set branch_id = coalesce(
  (select p.branch_id from public.properties p
   where p.workspace_id = r.workspace_id and p.id = r.property_id),
  public.servicedesk_default_branch(r.workspace_id)
)
where r.branch_id is null;

update public.conversations c
set branch_id = coalesce(
  (select r.branch_id from public.requests r
   where r.workspace_id = c.workspace_id and r.id = c.request_id),
  public.servicedesk_default_branch(c.workspace_id)
)
where c.branch_id is null;

update public.crews c
set branch_id = public.servicedesk_default_branch(c.workspace_id)
where c.branch_id is null;

update public.capacity_slots s
set branch_id = coalesce(
  (select c.branch_id from public.crews c
   where c.workspace_id = s.workspace_id and c.id = s.crew_id),
  public.servicedesk_default_branch(s.workspace_id)
)
where s.branch_id is null;

update public.visits v
set branch_id = coalesce(
  (select r.branch_id from public.requests r
   where r.workspace_id = v.workspace_id and r.id = v.request_id),
  public.servicedesk_default_branch(v.workspace_id)
)
where v.branch_id is null;

update public.recurrence_rules rr
set branch_id = coalesce(
  (select r.branch_id from public.requests r
   where r.workspace_id = rr.workspace_id and r.id = rr.request_id),
  public.servicedesk_default_branch(rr.workspace_id)
)
where rr.branch_id is null;

alter table public.properties alter column branch_id set not null;
alter table public.requests alter column branch_id set not null;
alter table public.conversations alter column branch_id set not null;
alter table public.crews alter column branch_id set not null;
alter table public.capacity_slots alter column branch_id set not null;
alter table public.visits alter column branch_id set not null;
alter table public.recurrence_rules alter column branch_id set not null;

alter table public.properties
  add constraint properties_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.requests
  add constraint requests_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.conversations
  add constraint conversations_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.crews
  add constraint crews_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.capacity_slots
  add constraint capacity_slots_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.visits
  add constraint visits_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.recurrence_rules
  add constraint recurrence_rules_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;

create index if not exists properties_branch_idx on public.properties(workspace_id, branch_id, created_at desc);
create index if not exists requests_branch_idx on public.requests(workspace_id, branch_id, created_at desc);
create index if not exists conversations_branch_idx on public.conversations(workspace_id, branch_id, updated_at desc);
create index if not exists crews_branch_idx on public.crews(workspace_id, branch_id, active);
create index if not exists capacity_slots_branch_window_idx on public.capacity_slots(workspace_id, branch_id, starts_at, ends_at);
create index if not exists visits_branch_schedule_idx on public.visits(workspace_id, branch_id, starts_at, status);
create index if not exists recurrence_rules_branch_idx on public.recurrence_rules(workspace_id, branch_id, active);

create or replace function public.servicedesk_apply_branch_defaults_and_consistency()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_related_branch uuid;
begin
  if new.branch_id is null then
    if tg_table_name = 'requests' and new.property_id is not null then
      select branch_id into v_related_branch
      from public.properties
      where workspace_id = new.workspace_id and id = new.property_id;
    elsif tg_table_name = 'conversations' and new.request_id is not null then
      select branch_id into v_related_branch
      from public.requests
      where workspace_id = new.workspace_id and id = new.request_id;
    elsif tg_table_name = 'capacity_slots' and new.crew_id is not null then
      select branch_id into v_related_branch
      from public.crews
      where workspace_id = new.workspace_id and id = new.crew_id;
    elsif tg_table_name = 'visits' and new.request_id is not null then
      select branch_id into v_related_branch
      from public.requests
      where workspace_id = new.workspace_id and id = new.request_id;
    elsif tg_table_name = 'recurrence_rules' and new.request_id is not null then
      select branch_id into v_related_branch
      from public.requests
      where workspace_id = new.workspace_id and id = new.request_id;
    end if;
    new.branch_id := coalesce(v_related_branch, public.servicedesk_default_branch(new.workspace_id));
  end if;

  if new.branch_id is null or not exists (
    select 1 from public.workspace_branches b
    where b.workspace_id = new.workspace_id and b.id = new.branch_id and b.active
  ) then
    raise exception 'BRANCH_NOT_AVAILABLE';
  end if;

  if tg_table_name = 'requests' and new.property_id is not null and exists (
    select 1 from public.properties p
    where p.workspace_id = new.workspace_id
      and p.id = new.property_id
      and p.branch_id <> new.branch_id
  ) then
    raise exception 'REQUEST_PROPERTY_BRANCH_MISMATCH';
  end if;

  if tg_table_name = 'conversations' and new.request_id is not null and exists (
    select 1 from public.requests r
    where r.workspace_id = new.workspace_id
      and r.id = new.request_id
      and r.branch_id <> new.branch_id
  ) then
    raise exception 'CONVERSATION_REQUEST_BRANCH_MISMATCH';
  end if;

  if tg_table_name = 'capacity_slots' and new.crew_id is not null and exists (
    select 1 from public.crews c
    where c.workspace_id = new.workspace_id
      and c.id = new.crew_id
      and c.branch_id <> new.branch_id
  ) then
    raise exception 'CAPACITY_CREW_BRANCH_MISMATCH';
  end if;

  if tg_table_name = 'visits' then
    if exists (
      select 1 from public.requests r
      where r.workspace_id = new.workspace_id
        and r.id = new.request_id
        and r.branch_id <> new.branch_id
    ) then
      raise exception 'VISIT_REQUEST_BRANCH_MISMATCH';
    end if;
    if new.crew_id is not null and exists (
      select 1 from public.crews c
      where c.workspace_id = new.workspace_id
        and c.id = new.crew_id
        and c.branch_id <> new.branch_id
    ) then
      raise exception 'VISIT_CREW_BRANCH_MISMATCH';
    end if;
    if new.slot_id is not null and exists (
      select 1 from public.capacity_slots s
      where s.workspace_id = new.workspace_id
        and s.id = new.slot_id
        and s.branch_id <> new.branch_id
    ) then
      raise exception 'VISIT_SLOT_BRANCH_MISMATCH';
    end if;
  end if;

  if tg_table_name = 'recurrence_rules' then
    if exists (
      select 1 from public.requests r
      where r.workspace_id = new.workspace_id
        and r.id = new.request_id
        and r.branch_id <> new.branch_id
    ) or exists (
      select 1 from public.properties p
      where p.workspace_id = new.workspace_id
        and p.id = new.property_id
        and p.branch_id <> new.branch_id
    ) then
      raise exception 'RECURRENCE_BRANCH_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists properties_branch_guard on public.properties;
create trigger properties_branch_guard
before insert or update of workspace_id, branch_id on public.properties
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();

drop trigger if exists requests_branch_guard on public.requests;
create trigger requests_branch_guard
before insert or update of workspace_id, branch_id, property_id on public.requests
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();

drop trigger if exists conversations_branch_guard on public.conversations;
create trigger conversations_branch_guard
before insert or update of workspace_id, branch_id, request_id on public.conversations
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();

drop trigger if exists crews_branch_guard on public.crews;
create trigger crews_branch_guard
before insert or update of workspace_id, branch_id on public.crews
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();

drop trigger if exists capacity_slots_branch_guard on public.capacity_slots;
create trigger capacity_slots_branch_guard
before insert or update of workspace_id, branch_id, crew_id on public.capacity_slots
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();

drop trigger if exists visits_branch_guard on public.visits;
create trigger visits_branch_guard
before insert or update of workspace_id, branch_id, request_id, crew_id, slot_id on public.visits
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();

drop trigger if exists recurrence_rules_branch_guard on public.recurrence_rules;
create trigger recurrence_rules_branch_guard
before insert or update of workspace_id, branch_id, request_id, property_id on public.recurrence_rules
for each row execute function public.servicedesk_apply_branch_defaults_and_consistency();


create or replace function public.servicedesk_upsert_workspace_branch(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_code text := upper(trim(p_input->>'code'));
  v_name text := trim(p_input->>'name');
  v_timezone text := trim(p_input->>'timezone');
  v_currency char(3) := upper(trim(p_input->>'currency'))::char(3);
  v_active boolean := coalesce((p_input->>'active')::boolean, true);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.workspace_branches%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_code is null or v_name is null or v_timezone is null or v_currency is null
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  begin
    perform now() at time zone v_timezone;
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_TIMEZONE_INVALID');
  end;

  if v_branch is null then
    insert into public.workspace_branches(
      workspace_id, code, name, timezone, currency, is_default, active, created_at, updated_at
    ) values (
      v_workspace, v_code, v_name, v_timezone, v_currency, false, v_active, v_now, v_now
    )
    returning * into v_row;
  else
    if exists (
      select 1 from public.workspace_branches
      where workspace_id = v_workspace and id = v_branch and is_default and not v_active
    ) then
      return jsonb_build_object('ok', false, 'code', 'DEFAULT_BRANCH_REQUIRED');
    end if;

    update public.workspace_branches
    set code = v_code,
        name = v_name,
        timezone = v_timezone,
        currency = v_currency,
        active = v_active,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace
      and id = v_branch
      and version = v_expected
    returning * into v_row;

    if not found then
      return jsonb_build_object('ok', false, 'code',
        case when exists (
          select 1 from public.workspace_branches where workspace_id = v_workspace and id = v_branch
        ) then 'VERSION_CONFLICT' else 'BRANCH_NOT_FOUND' end
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'branchId', v_row.id,
    'code', v_row.code,
    'name', v_row.name,
    'timezone', v_row.timezone,
    'currency', v_row.currency,
    'isDefault', v_row.is_default,
    'active', v_row.active,
    'version', v_row.version
  );
exception when unique_violation or check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_set_branch_membership(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_user uuid := nullif(p_input->>'userId','')::uuid;
  v_status text := upper(trim(p_input->>'status'));
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_member public.memberships%rowtype;
  v_row public.branch_memberships%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_branch is null or v_user is null or v_status not in ('ACTIVE','REVOKED')
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_MEMBERSHIP_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.workspace_branches
    where workspace_id = v_workspace and id = v_branch and active
  ) then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_NOT_FOUND');
  end if;

  select * into v_member
  from public.memberships
  where workspace_id = v_workspace and user_id = v_user and status = 'ACTIVE';

  if not found then
    return jsonb_build_object('ok', false, 'code', 'STAFF_MEMBERSHIP_NOT_FOUND');
  end if;

  if v_member.role = 'OWNER' then
    return jsonb_build_object('ok', false, 'code', 'OWNER_BRANCH_ASSIGNMENT_NOT_REQUIRED');
  end if;

  insert into public.branch_memberships(
    workspace_id, branch_id, user_id, status, version, created_at, updated_at
  ) values (
    v_workspace, v_branch, v_user, v_status, 1, v_now, v_now
  )
  on conflict (workspace_id, branch_id, user_id) do update
  set status = excluded.status,
      version = public.branch_memberships.version + 1,
      updated_at = v_now
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'branchId', v_row.branch_id,
    'userId', v_row.user_id,
    'status', v_row.status,
    'version', v_row.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_MEMBERSHIP_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_upsert_workspace_branch(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_set_branch_membership(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_upsert_workspace_branch(jsonb) to service_role;
grant execute on function public.servicedesk_set_branch_membership(jsonb) to service_role;

alter table public.workspace_branches enable row level security;
alter table public.branch_memberships enable row level security;

create policy workspace_branches_staff_select on public.workspace_branches
for select to authenticated
using (public.servicedesk_has_branch_access(workspace_id, id, null));

create policy branch_memberships_owner_or_self_select on public.branch_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
);

drop policy if exists properties_staff_all on public.properties;
create policy properties_staff_all on public.properties
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists requests_staff_all on public.requests;
create policy requests_staff_all on public.requests
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists conversations_staff_all on public.conversations;
create policy conversations_staff_all on public.conversations
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists crews_staff_all on public.crews;
create policy crews_staff_all on public.crews
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists capacity_slots_staff_all on public.capacity_slots;
create policy capacity_slots_staff_all on public.capacity_slots
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists visits_staff_all on public.visits;
create policy visits_staff_all on public.visits
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists recurrence_rules_staff_all on public.recurrence_rules;
create policy recurrence_rules_staff_all on public.recurrence_rules
for all to authenticated
using (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]))
with check (public.servicedesk_has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists messages_staff_select on public.messages;
create policy messages_staff_select on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.workspace_id = messages.workspace_id
      and c.id = messages.conversation_id
      and public.servicedesk_has_branch_access(c.workspace_id, c.branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
  )
);

comment on table public.workspace_branches is
  'Branch dimension within a workspace. A branch never grants access to another workspace.';
comment on table public.branch_memberships is
  'Explicit non-owner staff branch assignments. Active workspace owners can access every active branch.';
