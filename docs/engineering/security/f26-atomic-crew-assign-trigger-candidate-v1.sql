-- ServiceDesk SONIC F26: SOURCE-ONLY REVIEW CANDIDATE (NOT INSTALLED)
-- Prerequisite: migrations 0001, 0003, 0053, 0062 and current visit RPCs.
-- OWNER + independent DBA approval required before ANY live execution.
--
-- Atomic invariant for new ASSIGNED visit transitions. Existing 0011
-- servicedesk_transition_visit only checks crew_id IS NOT NULL; the existing
-- F26 application guard can race with crew/member revocation. This trigger
-- rejects direct/alternate SQL transitions as well.
--
-- Concurrency: FOR SHARE row locks on the SAME crew, slot, request,
-- crew_member and memberships rows serialize deactivation/revocation
-- with the update that moves the visit to ASSIGNED. It proves readiness
-- at transaction commit, NOT uninterrupted crew availability afterward.
-- Runs as SECURITY INVOKER; no bypass-RLS or elevated definer.
create or replace function public.servicedesk_f26_guard_assigned_crew()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $f26$
declare
  v_request_id uuid;
  v_crew_id uuid;
  v_slot_id uuid;
  v_member_id uuid;
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'visits' then
    raise exception 'F26_GUARD_WRONG_TABLE' using errcode = '23514';
  end if;
  if new.status <> 'ASSIGNED' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'ASSIGNED'
       and old.workspace_id is not distinct from new.workspace_id
       and old.request_id is not distinct from new.request_id
       and old.slot_id is not distinct from new.slot_id
       and old.crew_id is not distinct from new.crew_id
       and old.branch_id is not distinct from new.branch_id then
      return new;
    end if;
  end if;

  if new.workspace_id is null or new.branch_id is null
     or new.request_id is null or new.slot_id is null
     or new.crew_id is null then
    raise exception 'F26_ASSIGNED_SOURCE_INCOMPLETE' using errcode = '23514';
  end if;

  select r.id into v_request_id
    from public.requests r
   where r.workspace_id = new.workspace_id
     and r.id = new.request_id
     and r.branch_id = new.branch_id
   for share;
  if v_request_id is null then
    raise exception 'F26_ASSIGNED_REQUEST_BRANCH_MISMATCH' using errcode = '23514';
  end if;

  select c.id into v_crew_id
    from public.crews c
   where c.workspace_id = new.workspace_id
     and c.id = new.crew_id
     and c.branch_id = new.branch_id
     and c.active is true
   for share;
  if v_crew_id is null then
    raise exception 'F26_ASSIGNED_CREW_INACTIVE_OR_FOREIGN' using errcode = '23514';
  end if;

  select s.id into v_slot_id
    from public.capacity_slots s
   where s.workspace_id = new.workspace_id
     and s.id = new.slot_id
     and s.crew_id = new.crew_id
     and s.branch_id = new.branch_id
   for share;
  if v_slot_id is null then
    raise exception 'F26_ASSIGNED_SLOT_CREW_MISMATCH' using errcode = '23514';
  end if;

  -- One eligible member is sufficient, but BOTH member and membership rows
  -- MUST be locked: a SELECT EXISTS without row locks can accept a member
  -- who is revoked just before the ASSIGN transaction commits.
  select cm.id into v_member_id
    from public.crew_members cm
    join public.memberships m
      on m.workspace_id = cm.workspace_id
     and m.user_id = cm.user_id
   where cm.workspace_id = new.workspace_id
     and cm.crew_id = new.crew_id
     and cm.active is true
     and m.status = 'ACTIVE'
     and m.role = 'CREW'
   order by cm.id
   limit 1
   for share of cm, m;
  if v_member_id is null then
    raise exception 'F26_ASSIGNED_NO_ACTIVE_CREW_MEMBER' using errcode = '23514';
  end if;
  return new;
end;
$f26$;

-- Name sorts AFTER the existing branch/default normalization triggers.
-- The trigger enforces both ordinary visit ASSIGN updates and any alternate
-- SQL path that inserts or changes a visit into ASSIGNED status.
drop trigger if exists zz_servicedesk_f26_assigned_crew_guard on public.visits;
create trigger zz_servicedesk_f26_assigned_crew_guard
before insert or update of status, crew_id, slot_id, request_id, branch_id, workspace_id
on public.visits
for each row
execute function public.servicedesk_f26_guard_assigned_crew();

revoke all on function public.servicedesk_f26_guard_assigned_crew() from public, anon, authenticated;
-- PostgreSQL invokes a trigger function through its trigger binding;
-- untrusted roles MUST NOT be given callable EXECUTE on the function.
