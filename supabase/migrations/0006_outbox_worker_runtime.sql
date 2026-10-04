-- ServiceDesk AI V1 E04: durable outbox claim / lease / retry runtime
-- Adds explicit worker runtime metadata and an atomic claim primitive for trusted server execution.

alter type public.outbox_status add value if not exists 'SUPPRESSED';

alter table public.outbox_events
  add column if not exists provider_reference text,
  add column if not exists last_error_code text;

comment on column public.outbox_events.locked_by is 'Trusted server outbox worker lease owner. Completion updates must match this value.';
comment on column public.outbox_events.locked_at is 'Trusted server lease acquisition timestamp. A row may be reclaimed after the configured lease window expires.';
comment on column public.outbox_events.next_attempt_at is 'Ready-at scheduling timestamp. Null means immediately ready when pending and unlocked.';
comment on column public.outbox_events.provider_reference is 'Opaque downstream provider/message reference after successful execution.';
comment on column public.outbox_events.last_error_code is 'Redacted last execution or suppression error code.';

create index if not exists outbox_ready_claim_idx
on public.outbox_events(status, coalesce(next_attempt_at, created_at), created_at)
where status = 'PENDING';

create index if not exists outbox_stale_lease_idx
on public.outbox_events(status, locked_at, locked_by)
where status = 'PENDING' and locked_at is not null;

create or replace function public.claim_ready_outbox_events(
  p_worker_id text,
  p_now timestamptz,
  p_lease_seconds integer,
  p_limit integer
)
returns table (
  id uuid,
  workspace_id uuid,
  topic text,
  payload jsonb,
  status public.outbox_status,
  attempts integer,
  idempotency_key text,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  provider_reference text,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  if p_now is null then
    raise exception 'claim timestamp is required' using errcode = '22023';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 1 then
    raise exception 'lease seconds must be positive' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'claim limit must be positive' using errcode = '22023';
  end if;

  return query
  with ready as (
    select o.id
    from public.outbox_events o
    where o.status = 'PENDING'
      and (o.next_attempt_at is null or o.next_attempt_at <= p_now)
      and (
        o.locked_at is null
        or o.locked_by is null
        or o.locked_at + make_interval(secs => p_lease_seconds) <= p_now
      )
    order by coalesce(o.next_attempt_at, o.created_at), o.created_at, o.id
    limit p_limit
    for update skip locked
  )
  update public.outbox_events claimed
  set
    locked_by = p_worker_id,
    locked_at = p_now,
    attempts = claimed.attempts + 1,
    updated_at = p_now
  from ready
  where claimed.id = ready.id
  returning
    claimed.id,
    claimed.workspace_id,
    claimed.topic,
    claimed.payload,
    claimed.status,
    claimed.attempts,
    claimed.idempotency_key,
    claimed.next_attempt_at,
    claimed.locked_at,
    claimed.locked_by,
    claimed.sent_at,
    claimed.provider_reference,
    claimed.last_error_code,
    claimed.created_at,
    claimed.updated_at;
end;
$$;

revoke all on function public.claim_ready_outbox_events(text, timestamptz, integer, integer) from public;
revoke all on function public.claim_ready_outbox_events(text, timestamptz, integer, integer) from anon;
revoke all on function public.claim_ready_outbox_events(text, timestamptz, integer, integer) from authenticated;
grant execute on function public.claim_ready_outbox_events(text, timestamptz, integer, integer) to service_role;

comment on function public.claim_ready_outbox_events(text, timestamptz, integer, integer) is
  'Trusted server/service-role atomic outbox claim. Uses FOR UPDATE SKIP LOCKED and lease expiry; terminal rows are never claimed.';
