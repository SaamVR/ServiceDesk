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

revoke all on function public.servicedesk_default_branch(uuid) from public;
revoke all on function public.servicedesk_has_branch_access(uuid, uuid, public.membership_role[]) from public;
grant execute on function public.servicedesk_default_branch(uuid) to authenticated, service_role;
grant execute on function public.servicedesk_has_branch_access(uuid, uuid, public.membership_role[]) to authenticated, service_role;

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

drop policy if exists recurrence_staff_all on public.recurrence_rules;
create policy recurrence_staff_all on public.recurrence_rules
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
