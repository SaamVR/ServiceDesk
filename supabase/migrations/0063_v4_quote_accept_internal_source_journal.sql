-- ServiceDesk V4: durable INTERNAL quote-accepted event journal.
-- NOT applied by CI. Requires authorized staging migration and tenant UAT.
-- Never put these events in outbox_events, whose topics may dispatch providers.
--
-- The AFTER UPDATE trigger executes in the SAME transaction as acceptance:
-- an opted-in quote cannot commit ACCEPTED without its source event.
-- A forced insert error rolls back quote acceptance; this deliberate
-- availability-vs-durability trade-off must be verified before production use.
create table if not exists public.workflow_source_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quote_id uuid not null,
  event_type text not null default 'QUOTE_ACCEPTED'
    check (event_type = 'QUOTE_ACCEPTED'),
  state text not null default 'PENDING'
    check (state in ('PENDING','PROCESSING','RETRY_PENDING','SUCCEEDED','SKIPPED','DEAD_LETTER')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  last_error_code text,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_source_events_workspace_quote_fk
    foreign key (workspace_id, quote_id) references public.quotes(workspace_id,id)
      on delete cascade,
  constraint workflow_source_events_unique_quote
    unique (workspace_id, event_type, quote_id),
  constraint workflow_source_events_lock_pair
    check ((locked_by is null) = (locked_until is null))
);
create index if not exists workflow_source_events_due
  on public.workflow_source_events (next_attempt_at,created_at)
  where state in ('PENDING','RETRY_PENDING','PROCESSING');

alter table public.workflow_source_events enable row level security;
revoke all on public.workflow_source_events from public, anon, authenticated;
grant select, insert, update on public.workflow_source_events to service_role;

create or replace function public.servicedesk_record_accepted_quote_source()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status::text is distinct from 'ACCEPTED'
     and new.status::text = 'ACCEPTED'
     and exists (
       select 1 from public.workspace_feature_flags f
       where f.workspace_id = new.workspace_id
         and f.feature_key = 'AUTO_INTERNAL_QUOTE_ACCEPTED'
         and f.enabled is true
     )
  then
    insert into public.workflow_source_events (
      workspace_id,quote_id,event_type,state
    ) values (new.workspace_id,new.id,'QUOTE_ACCEPTED','PENDING')
    on conflict (workspace_id,event_type,quote_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.servicedesk_record_accepted_quote_source()
  from public,anon,authenticated;
-- The trigger fires under table DML; do not grant client EXECUTE.
drop trigger if exists servicedesk_quote_accept_source_event on public.quotes;
create trigger servicedesk_quote_accept_source_event
after update of status on public.quotes
for each row execute function public.servicedesk_record_accepted_quote_source();

-- A bounded, atomic, service-only SKIP LOCKED lease claim.
-- It also recovers stale PROCESSING rows after an interrupted worker.
create or replace function public.servicedesk_claim_quote_source_events(
  p_worker text, p_limit integer default 10
)
returns setof public.workflow_source_events
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9_-]{8,80}$'
     or p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'QUOTE_SOURCE_CLAIM_INVALID';
  end if;
  -- A crash on the final allowed attempt must not strand a leased row forever.
  update public.workflow_source_events set
    state='DEAD_LETTER',last_error_code='LEASE_EXPIRED_MAX_ATTEMPTS',
    locked_by=null,locked_until=null,finished_at=now(),updated_at=now()
  where state='PROCESSING' and attempts >= 8 and locked_until < now();
  return query
  with due as (
    select e.id
    from public.workflow_source_events e
    where e.attempts < 8
      and (
        (e.state in ('PENDING','RETRY_PENDING') and e.next_attempt_at <= now())
        or (e.state='PROCESSING' and e.locked_until < now())
      )
    order by e.next_attempt_at,e.created_at
    limit p_limit
    for update skip locked
  )
  update public.workflow_source_events e set
    state = 'PROCESSING',
    attempts = e.attempts + 1,
    locked_by = p_worker,
    locked_until = now() + interval '90 seconds',
    updated_at = now()
  from due where e.id=due.id returning e.*;
end;
$$;

create or replace function public.servicedesk_complete_quote_source_event(
  p_id uuid, p_worker text, p_outcome text, p_error_code text default null
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare v_attempts integer;
begin
  if p_id is null or p_worker is null
     or p_worker !~ '^[A-Za-z0-9_-]{8,80}$'
     or p_outcome is null or p_outcome not in ('SUCCEEDED','FAILED','SKIPPED')
     or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_]{1,80}$') then
    return jsonb_build_object('ok',false,'code','QUOTE_SOURCE_COMPLETION_INVALID');
  end if;
  select attempts into v_attempts from public.workflow_source_events
    where id=p_id and state='PROCESSING' and locked_by=p_worker
      and locked_until > now() for update;
  if not found then
    return jsonb_build_object('ok',false,'code','QUOTE_SOURCE_LEASE_UNVERIFIED');
  end if;
  update public.workflow_source_events set
    state=case when p_outcome='SUCCEEDED' then 'SUCCEEDED'
      when p_outcome='SKIPPED' then 'SKIPPED'
      when v_attempts >= 8 then 'DEAD_LETTER'
      else 'RETRY_PENDING' end,
    next_attempt_at=case when p_outcome='FAILED' then
      now() + make_interval(secs => least(3600,(power(2,least(v_attempts,8))*15)::integer))
      else next_attempt_at end,
    last_error_code=case when p_outcome='FAILED' then coalesce(p_error_code,'INTERNAL_RETRY_UNVERIFIED')
      else null end,
    locked_by=null,locked_until=null,
    finished_at=case when p_outcome in ('SUCCEEDED','SKIPPED') or v_attempts >= 8
      then now() else null end,
    updated_at=now()
    where id=p_id;
  return jsonb_build_object('ok',true,'state',
    case when p_outcome='SUCCEEDED' then 'SUCCEEDED'
      when p_outcome='SKIPPED' then 'SKIPPED'
      when v_attempts >= 8 then 'DEAD_LETTER' else 'RETRY_PENDING' end);
end;
$$;
revoke all on function public.servicedesk_claim_quote_source_events(text,integer)
  from public,anon,authenticated;
revoke all on function public.servicedesk_complete_quote_source_event(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.servicedesk_claim_quote_source_events(text,integer)
  to service_role;
grant execute on function public.servicedesk_complete_quote_source_event(uuid,text,text,text)
  to service_role;
comment on table public.workflow_source_events is
  'Internal, quote-accepted automation source events only. Not an external provider outbox.';
