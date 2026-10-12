-- ServiceDesk V4: repair the shared, seven-table branch consistency trigger.
--
-- Every trigger invokes the SAME function but NEW has the row type of the
-- calling table. Expressions like
--   tg_table_name = 'requests' AND NEW.property_id IS NOT NULL
-- are unsafe on a properties/crews/conversations row: PostgreSQL may evaluate
-- NEW.property_id even when the discriminator is false (SQLSTATE 42703).
--
-- Isolate every table-specific NEW field inside a procedural IF/ELSIF branch.
-- Keep existing branch defaults and mismatch/error contracts unchanged.
-- CREATE OR REPLACE preserves the existing seven trigger bindings and grants.
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
    if tg_table_name = 'requests' then
      if new.property_id is not null then
        select branch_id into v_related_branch
        from public.properties
        where workspace_id = new.workspace_id and id = new.property_id;
      end if;
    elsif tg_table_name = 'conversations' then
      if new.request_id is not null then
        select branch_id into v_related_branch
        from public.requests
        where workspace_id = new.workspace_id and id = new.request_id;
      end if;
    elsif tg_table_name = 'capacity_slots' then
      if new.crew_id is not null then
        select branch_id into v_related_branch
        from public.crews
        where workspace_id = new.workspace_id and id = new.crew_id;
      end if;
    elsif tg_table_name = 'visits' then
      if new.request_id is not null then
        select branch_id into v_related_branch
        from public.requests
        where workspace_id = new.workspace_id and id = new.request_id;
      end if;
    elsif tg_table_name = 'recurrence_rules' then
      if new.request_id is not null then
        select branch_id into v_related_branch
        from public.requests
        where workspace_id = new.workspace_id and id = new.request_id;
      end if;
    end if;
    new.branch_id := coalesce(v_related_branch, public.servicedesk_default_branch(new.workspace_id));
  end if;

  if new.branch_id is null or not exists (
    select 1 from public.workspace_branches b
    where b.workspace_id = new.workspace_id and b.id = new.branch_id and b.active
  ) then
    raise exception 'BRANCH_NOT_AVAILABLE';
  end if;

  if tg_table_name = 'requests' then
    if new.property_id is not null and exists (
      select 1 from public.properties p
      where p.workspace_id = new.workspace_id and p.id = new.property_id
        and p.branch_id <> new.branch_id
    ) then
      raise exception 'REQUEST_PROPERTY_BRANCH_MISMATCH';
    end if;
  elsif tg_table_name = 'conversations' then
    if new.request_id is not null and exists (
      select 1 from public.requests r
      where r.workspace_id = new.workspace_id and r.id = new.request_id
        and r.branch_id <> new.branch_id
    ) then
      raise exception 'CONVERSATION_REQUEST_BRANCH_MISMATCH';
    end if;
  elsif tg_table_name = 'capacity_slots' then
    if new.crew_id is not null and exists (
      select 1 from public.crews c
      where c.workspace_id = new.workspace_id and c.id = new.crew_id
        and c.branch_id <> new.branch_id
    ) then
      raise exception 'CAPACITY_CREW_BRANCH_MISMATCH';
    end if;
  elsif tg_table_name = 'visits' then
    if exists (
      select 1 from public.requests r
      where r.workspace_id = new.workspace_id and r.id = new.request_id
        and r.branch_id <> new.branch_id
    ) then
      raise exception 'VISIT_REQUEST_BRANCH_MISMATCH';
    end if;
    if new.crew_id is not null and exists (
      select 1 from public.crews c
      where c.workspace_id = new.workspace_id and c.id = new.crew_id
        and c.branch_id <> new.branch_id
    ) then
      raise exception 'VISIT_CREW_BRANCH_MISMATCH';
    end if;
    if new.slot_id is not null and exists (
      select 1 from public.capacity_slots s
      where s.workspace_id = new.workspace_id and s.id = new.slot_id
        and s.branch_id <> new.branch_id
    ) then
      raise exception 'VISIT_SLOT_BRANCH_MISMATCH';
    end if;
  elsif tg_table_name = 'recurrence_rules' then
    if exists (
      select 1 from public.requests r
      where r.workspace_id = new.workspace_id and r.id = new.request_id
        and r.branch_id <> new.branch_id
    ) or exists (
      select 1 from public.properties p
      where p.workspace_id = new.workspace_id and p.id = new.property_id
        and p.branch_id <> new.branch_id
    ) then
      raise exception 'RECURRENCE_BRANCH_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;
