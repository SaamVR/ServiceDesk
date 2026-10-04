create index if not exists outbox_terminal_idx
on public.outbox_events(workspace_id, status, updated_at desc)
where status in ('SENT', 'FAILED', 'SUPPRESSED');

-- ServiceDesk AI V1 E04 follow-up: lease-owner guarded outbox completion RPC

create or replace function public.complete_outbox_event(
  p_event_id uuid,
  p_worker_id text,
  p_status public.outbox_status,
  p_at timestamptz,
  p_attempts integer default null,
  p_error_code text default null,
  p_next_attempt_at timestamptz default null,
  p_provider_reference text default null
)
returns public.outbox_events
language plpgsql
security invoker
set search_path = public
as $$
declare
  completed public.outbox_events;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'worker id is required' using errcode = '22023';
  end if;
  if p_at is null then
    raise exception 'completion timestamp is required' using errcode = '22023';
  end if;
  if p_attempts is not null and p_attempts < 1 then
    raise exception 'attempts must be positive when provided' using errcode = '22023';
  end if;
  if p_status not in ('PENDING','SENT','FAILED','SUPPRESSED') then
    raise exception 'unsupported outbox completion status' using errcode = '22023';
  end if;
  if p_status = 'PENDING' and p_next_attempt_at is null then
    raise exception 'retry completion requires next_attempt_at' using errcode = '22023';
  end if;

  update public.outbox_events
  set
    status = p_status,
    attempts = coalesce(p_attempts, attempts),
    next_attempt_at = case when p_status = 'PENDING' then p_next_attempt_at else null end,
    sent_at = case when p_status = 'SENT' then p_at else sent_at end,
    provider_reference = case when p_status = 'SENT' then p_provider_reference else provider_reference end,
    last_error_code = case when p_status = 'SENT' then null else p_error_code end,
    locked_at = null,
    locked_by = null,
    updated_at = p_at
  where id = p_event_id
    and status = 'PENDING'
    and locked_by = p_worker_id
  returning * into completed;

  return completed;
end;
$$;

revoke all on function public.complete_outbox_event(uuid, text, public.outbox_status, timestamptz, integer, text, timestamptz, text)
from public, anon, authenticated;

grant execute on function public.complete_outbox_event(uuid, text, public.outbox_status, timestamptz, integer, text, timestamptz, text)
to service_role;

comment on function public.complete_outbox_event(uuid, text, public.outbox_status, timestamptz, integer, text, timestamptz, text) is
  'Trusted server completion for a currently leased outbox row. Stale/non-owner workers update zero rows.';
