-- ServiceDesk AI V2 Wave 2D.1: multi-branch tenancy-safe foundation.
-- A branch is a scoped dimension inside one workspace. Workspace remains the tenant boundary.
-- Existing V1 workspaces receive exactly one default branch and current staff are assigned to it.

create table if not exists public.workspace_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (
    code = upper(code)
    and code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'
  ),
  name text not null check (length(trim(name)) between 1 and 120),
  timezone text not null,
  currency char(3) not null,
  active boolean not null default true,
  is_default boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, code)
);

create unique index if not exists workspace_branches_one_default_idx
  on public.workspace_branches(workspace_id)
  where is_default;

create table if not exists public.branch_memberships (
  workspace_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, branch_id, user_id),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.memberships(workspace_id, user_id) on delete cascade
);

create index if not exists branch_memberships_user_idx
  on public.branch_memberships(workspace_id, user_id, active, branch_id);

insert into public.workspace_branches(
  workspace_id, code, name, timezone, currency, active, is_default
)
select
  w.id,
  'MAIN',
  'Main branch',
  w.timezone,
  w.currency,
  true,
  true
from public.workspaces w
where not exists (
  select 1 from public.workspace_branches b where b.workspace_id = w.id
);

insert into public.branch_memberships(workspace_id, branch_id, user_id, active)
select
  m.workspace_id,
  b.id,
  m.user_id,
  m.status = 'ACTIVE'
from public.memberships m
join public.workspace_branches b
  on b.workspace_id = m.workspace_id and b.is_default
on conflict (workspace_id, branch_id, user_id) do nothing;

create or replace function public.servicedesk_seed_default_branch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.workspace_branches(
    workspace_id, code, name, timezone, currency, active, is_default
  ) values (
    new.id, 'MAIN', 'Main branch', new.timezone, new.currency, true, true
  )
  on conflict (workspace_id, code) do nothing;
  return new;
end;
$$;

drop trigger if exists servicedesk_workspace_default_branch on public.workspaces;
create trigger servicedesk_workspace_default_branch
after insert on public.workspaces
for each row execute function public.servicedesk_seed_default_branch();

revoke all on function public.servicedesk_seed_default_branch() from public, anon, authenticated;

create or replace function public.has_branch_access(
  target_workspace uuid,
  target_branch uuid,
  allowed_roles public.membership_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
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
            and bm.active
        )
      )
  );
$$;

revoke all on function public.has_branch_access(uuid, uuid, public.membership_role[]) from public;
grant execute on function public.has_branch_access(uuid, uuid, public.membership_role[]) to authenticated;

create or replace function public.servicedesk_require_branch_staff(
  p_workspace uuid,
  p_branch uuid,
  p_user uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace
      and m.user_id = p_user
      and m.status = 'ACTIVE'
      and m.role::text = p_role
      and m.role in ('OWNER','DISPATCHER','CREW')
      and (
        m.role = 'OWNER'
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.workspace_id = p_workspace
            and bm.branch_id = p_branch
            and bm.user_id = p_user
            and bm.active
        )
      )
  );
$$;

revoke all on function public.servicedesk_require_branch_staff(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.servicedesk_require_branch_staff(uuid, uuid, uuid, text)
to service_role;

alter table public.properties add column if not exists branch_id uuid;
alter table public.requests add column if not exists branch_id uuid;
alter table public.crews add column if not exists branch_id uuid;
alter table public.capacity_slots add column if not exists branch_id uuid;
alter table public.visits add column if not exists branch_id uuid;
alter table public.recurrence_rules add column if not exists branch_id uuid;

update public.properties p
set branch_id = b.id
from public.workspace_branches b
where p.branch_id is null
  and b.workspace_id = p.workspace_id
  and b.is_default;

update public.requests r
set branch_id = coalesce(
  (select p.branch_id
   from public.properties p
   where p.workspace_id = r.workspace_id and p.id = r.property_id),
  (select b.id
   from public.workspace_branches b
   where b.workspace_id = r.workspace_id and b.is_default)
)
where r.branch_id is null;

update public.crews c
set branch_id = b.id
from public.workspace_branches b
where c.branch_id is null
  and b.workspace_id = c.workspace_id
  and b.is_default;

update public.capacity_slots s
set branch_id = c.branch_id
from public.crews c
where s.branch_id is null
  and c.workspace_id = s.workspace_id
  and c.id = s.crew_id;

update public.visits v
set branch_id = r.branch_id
from public.requests r
where v.branch_id is null
  and r.workspace_id = v.workspace_id
  and r.id = v.request_id;

update public.recurrence_rules rr
set branch_id = r.branch_id
from public.requests r
where rr.branch_id is null
  and r.workspace_id = rr.workspace_id
  and r.id = rr.request_id;

alter table public.properties alter column branch_id set not null;
alter table public.requests alter column branch_id set not null;
alter table public.crews alter column branch_id set not null;
alter table public.capacity_slots alter column branch_id set not null;
alter table public.visits alter column branch_id set not null;
alter table public.recurrence_rules alter column branch_id set not null;

alter table public.properties
  add constraint properties_workspace_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.requests
  add constraint requests_workspace_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.crews
  add constraint crews_workspace_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.capacity_slots
  add constraint capacity_slots_workspace_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.visits
  add constraint visits_workspace_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;
alter table public.recurrence_rules
  add constraint recurrence_rules_workspace_branch_fk
  foreign key (workspace_id, branch_id)
  references public.workspace_branches(workspace_id, id) on delete restrict;

alter table public.properties
  add constraint properties_workspace_id_branch_uq unique (workspace_id, id, branch_id);
alter table public.requests
  add constraint requests_workspace_id_branch_uq unique (workspace_id, id, branch_id);
alter table public.crews
  add constraint crews_workspace_id_branch_uq unique (workspace_id, id, branch_id);

alter table public.requests
  add constraint requests_property_same_branch_fk
  foreign key (workspace_id, property_id, branch_id)
  references public.properties(workspace_id, id, branch_id) on delete restrict;
alter table public.capacity_slots
  add constraint capacity_slots_crew_same_branch_fk
  foreign key (workspace_id, crew_id, branch_id)
  references public.crews(workspace_id, id, branch_id) on delete restrict;
alter table public.visits
  add constraint visits_request_same_branch_fk
  foreign key (workspace_id, request_id, branch_id)
  references public.requests(workspace_id, id, branch_id) on delete restrict;
alter table public.visits
  add constraint visits_crew_same_branch_fk
  foreign key (workspace_id, crew_id, branch_id)
  references public.crews(workspace_id, id, branch_id) on delete restrict;
alter table public.recurrence_rules
  add constraint recurrence_request_same_branch_fk
  foreign key (workspace_id, request_id, branch_id)
  references public.requests(workspace_id, id, branch_id) on delete restrict;
alter table public.recurrence_rules
  add constraint recurrence_property_same_branch_fk
  foreign key (workspace_id, property_id, branch_id)
  references public.properties(workspace_id, id, branch_id) on delete restrict;

create index if not exists properties_branch_idx
  on public.properties(workspace_id, branch_id, archived_at);
create index if not exists requests_branch_idx
  on public.requests(workspace_id, branch_id, status, created_at desc);
create index if not exists crews_branch_idx
  on public.crews(workspace_id, branch_id, active, name);
create index if not exists capacity_slots_branch_window_idx
  on public.capacity_slots(workspace_id, branch_id, starts_at, ends_at);
create index if not exists visits_branch_schedule_idx
  on public.visits(workspace_id, branch_id, starts_at, status);
create index if not exists recurrence_rules_branch_idx
  on public.recurrence_rules(workspace_id, branch_id, active);

alter table public.workspace_branches enable row level security;
alter table public.branch_memberships enable row level security;

revoke all on table public.workspace_branches from public, anon, authenticated;
revoke all on table public.branch_memberships from public, anon, authenticated;
grant select on table public.workspace_branches to authenticated;
grant select on table public.branch_memberships to authenticated;
grant select, insert, update, delete on table public.workspace_branches to service_role;
grant select, insert, update, delete on table public.branch_memberships to service_role;

drop policy if exists workspace_branches_staff_select on public.workspace_branches;
create policy workspace_branches_staff_select
on public.workspace_branches
for select to authenticated
using (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or public.has_branch_access(workspace_id, id, array['DISPATCHER','CREW']::public.membership_role[])
);

drop policy if exists branch_memberships_owner_or_self_select on public.branch_memberships;
create policy branch_memberships_owner_or_self_select
on public.branch_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
);

drop policy if exists customers_staff_all on public.customers;
create policy customers_branch_staff_all on public.customers
for all to authenticated
using (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.properties p
    where p.workspace_id = customers.workspace_id
      and p.customer_id = customers.id
      and public.has_branch_access(
        p.workspace_id,
        p.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.requests r
    where r.workspace_id = customers.workspace_id
      and r.customer_id = customers.id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
)
with check (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.properties p
    where p.workspace_id = customers.workspace_id
      and p.customer_id = customers.id
      and public.has_branch_access(
        p.workspace_id,
        p.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.requests r
    where r.workspace_id = customers.workspace_id
      and r.customer_id = customers.id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists contacts_staff_all on public.customer_contacts;
create policy contacts_branch_staff_all on public.customer_contacts
for all to authenticated
using (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.properties p
    where p.workspace_id = customer_contacts.workspace_id
      and p.customer_id = customer_contacts.customer_id
      and public.has_branch_access(
        p.workspace_id,
        p.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.requests r
    where r.workspace_id = customer_contacts.workspace_id
      and r.customer_id = customer_contacts.customer_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
)
with check (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.properties p
    where p.workspace_id = customer_contacts.workspace_id
      and p.customer_id = customer_contacts.customer_id
      and public.has_branch_access(
        p.workspace_id,
        p.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.requests r
    where r.workspace_id = customer_contacts.workspace_id
      and r.customer_id = customer_contacts.customer_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists consents_staff_all on public.communication_consents;
create policy consents_branch_staff_all on public.communication_consents
for all to authenticated
using (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.properties p
    where p.workspace_id = communication_consents.workspace_id
      and p.customer_id = communication_consents.customer_id
      and public.has_branch_access(
        p.workspace_id,
        p.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.requests r
    where r.workspace_id = communication_consents.workspace_id
      and r.customer_id = communication_consents.customer_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
)
with check (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.properties p
    where p.workspace_id = communication_consents.workspace_id
      and p.customer_id = communication_consents.customer_id
      and public.has_branch_access(
        p.workspace_id,
        p.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.requests r
    where r.workspace_id = communication_consents.workspace_id
      and r.customer_id = communication_consents.customer_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists conversations_staff_all on public.conversations;
create policy conversations_branch_staff_all on public.conversations
for all to authenticated
using (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or (
    request_id is not null
    and exists (
      select 1
      from public.requests r
      where r.workspace_id = conversations.workspace_id
        and r.id = conversations.request_id
        and public.has_branch_access(
          r.workspace_id,
          r.branch_id,
          array['DISPATCHER']::public.membership_role[]
        )
    )
  )
)
with check (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or (
    request_id is not null
    and exists (
      select 1
      from public.requests r
      where r.workspace_id = conversations.workspace_id
        and r.id = conversations.request_id
        and public.has_branch_access(
          r.workspace_id,
          r.branch_id,
          array['DISPATCHER']::public.membership_role[]
        )
    )
  )
);

drop policy if exists messages_staff_all on public.messages;
create policy messages_branch_staff_all on public.messages
for all to authenticated
using (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.conversations c
    join public.requests r
      on r.workspace_id = c.workspace_id and r.id = c.request_id
    where c.workspace_id = messages.workspace_id
      and c.id = messages.conversation_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
)
with check (
  public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[])
  or exists (
    select 1
    from public.conversations c
    join public.requests r
      on r.workspace_id = c.workspace_id and r.id = c.request_id
    where c.workspace_id = messages.workspace_id
      and c.id = messages.conversation_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists properties_staff_all on public.properties;
create policy properties_branch_staff_all on public.properties
for all to authenticated
using (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
)
with check (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
);

drop policy if exists requests_staff_all on public.requests;
create policy requests_branch_staff_all on public.requests
for all to authenticated
using (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
)
with check (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
);

drop policy if exists crews_staff_all on public.crews;
create policy crews_branch_staff_all on public.crews
for all to authenticated
using (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
)
with check (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
);

drop policy if exists capacity_slots_staff_all on public.capacity_slots;
create policy capacity_slots_branch_staff_all on public.capacity_slots
for all to authenticated
using (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
)
with check (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
);

drop policy if exists visits_staff_all on public.visits;
create policy visits_branch_staff_all on public.visits
for all to authenticated
using (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
)
with check (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
);

drop policy if exists recurrence_rules_staff_all on public.recurrence_rules;
create policy recurrence_rules_branch_staff_all on public.recurrence_rules
for all to authenticated
using (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
)
with check (
  public.has_branch_access(workspace_id, branch_id, array['OWNER','DISPATCHER']::public.membership_role[])
);

drop policy if exists quotes_staff_all on public.quotes;
create policy quotes_branch_staff_all on public.quotes
for all to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.workspace_id = quotes.workspace_id
      and r.id = quotes.request_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
)
with check (
  exists (
    select 1
    from public.requests r
    where r.workspace_id = quotes.workspace_id
      and r.id = quotes.request_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists quote_items_staff_select on public.quote_items;
create policy quote_items_branch_staff_select on public.quote_items
for select to authenticated
using (
  exists (
    select 1
    from public.quotes q
    join public.requests r
      on r.workspace_id = q.workspace_id and r.id = q.request_id
    where q.workspace_id = quote_items.workspace_id
      and q.id = quote_items.quote_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists approvals_staff_all on public.approvals;
create policy approvals_branch_staff_all on public.approvals
for all to authenticated
using (
  exists (
    select 1
    from public.quotes q
    join public.requests r
      on r.workspace_id = q.workspace_id and r.id = q.request_id
    where q.workspace_id = approvals.workspace_id
      and q.id = approvals.quote_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
)
with check (
  exists (
    select 1
    from public.quotes q
    join public.requests r
      on r.workspace_id = q.workspace_id and r.id = q.request_id
    where q.workspace_id = approvals.workspace_id
      and q.id = approvals.quote_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists invoices_staff_read on public.invoices;
create policy invoices_branch_staff_read on public.invoices
for select to authenticated
using (
  exists (
    select 1
    from public.quotes q
    join public.requests r
      on r.workspace_id = q.workspace_id and r.id = q.request_id
    where q.workspace_id = invoices.workspace_id
      and q.id = invoices.quote_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists payment_applications_staff_read on public.verified_payment_applications;
create policy payment_applications_branch_staff_read on public.verified_payment_applications
for select to authenticated
using (
  exists (
    select 1
    from public.quotes q
    join public.requests r
      on r.workspace_id = q.workspace_id and r.id = q.request_id
    where q.workspace_id = verified_payment_applications.workspace_id
      and q.id = verified_payment_applications.quote_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
  or exists (
    select 1
    from public.invoices i
    join public.quotes q
      on q.workspace_id = i.workspace_id and q.id = i.quote_id
    join public.requests r
      on r.workspace_id = q.workspace_id and r.id = q.request_id
    where i.workspace_id = verified_payment_applications.workspace_id
      and i.id = verified_payment_applications.invoice_id
      and public.has_branch_access(
        r.workspace_id,
        r.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists visit_evidence_staff_select on public.visit_evidence;
create policy visit_evidence_branch_staff_select on public.visit_evidence
for select to authenticated
using (
  exists (
    select 1
    from public.visits v
    where v.workspace_id = visit_evidence.workspace_id
      and v.id = visit_evidence.visit_id
      and public.has_branch_access(
        v.workspace_id,
        v.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

drop policy if exists visit_checklist_staff_select on public.visit_checklist_items;
create policy visit_checklist_branch_staff_select on public.visit_checklist_items
for select to authenticated
using (
  exists (
    select 1
    from public.visits v
    where v.workspace_id = visit_checklist_items.workspace_id
      and v.id = visit_checklist_items.visit_id
      and public.has_branch_access(
        v.workspace_id,
        v.branch_id,
        array['OWNER','DISPATCHER']::public.membership_role[]
      )
  )
);

comment on table public.workspace_branches is
  'Branch dimension inside a workspace tenant. Owners are company-wide; non-owner staff require explicit branch membership.';
comment on function public.has_branch_access(uuid, uuid, public.membership_role[]) is
  'Authenticated branch access predicate. Workspace owners can access all branches; other staff require an active branch assignment.';
