-- F15 V3 DISPOSABLE / HUMAN DBA REVIEW CANDIDATE ONLY (2026-10-30).
-- NEVER an automatically applied migration. Do not run against live Supabase.
-- Requires complete 0001 + 0008 + 0053 baseline and explicit deployment audit.
-- Supersedes original reviewed F15 SQL for any FUTURE install consideration;
-- the original PR #884 candidate remains immutable and has NOT been installed.
-- This candidate has no dependency on public.digest or extensions.digest.
-- NEW V3 ATOMIC INTERNAL OUTCOME: source review and OPEN Attention Center row
-- are written in the SAME request-locked transaction, zero provider sends.
-- DO NOT install V1/V2 alongside V3 or apply to any connected Supabase.
-- No worker, outbound provider, payments, customer contact or rule execution.
--
-- EVENT SOURCE CONSISTENCY: every writer of messages and conversations must
-- share a REQUEST-SCOPED advisory lock. Triggers below enforce that for the
-- existing tables; changes to producer bypass paths require separate review.
-- The claim uses DB clock_timestamp, never client-observed time as authority.
-- No CREATE EXTENSION: core PostgreSQL 17 pg_catalog.sha256(bytea) is used.

create table public.f15_unanswered_lead_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  branch_id uuid not null,
  request_id uuid not null,
  inbound_message_id uuid not null,
  source_version bigint not null check (source_version > 0),
  source_last_inbound_at timestamptz not null,
  event_key char(64) not null check(event_key ~ '^[0-9a-f]{64}$'),
  due_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  state text not null default 'OWNER_REVIEW_REQUIRED'
    check (state = 'OWNER_REVIEW_REQUIRED'),
  unique (workspace_id,branch_id,event_key),
  unique (workspace_id,branch_id,request_id,inbound_message_id),
  foreign key (workspace_id,branch_id)
    references public.workspace_branches(workspace_id,id),
  foreign key (workspace_id,request_id)
    references public.requests(workspace_id,id),
  foreign key (workspace_id,inbound_message_id)
    references public.messages(workspace_id,id)
);

alter table public.f15_unanswered_lead_reviews enable row level security;
revoke all on public.f15_unanswered_lead_reviews from public, anon, authenticated;
grant select, insert on public.f15_unanswered_lead_reviews to service_role;
-- No RLS policies: authenticated clients cannot view or modify this ledger.
-- Do NOT add a trigger that publishes a workflow or outbox event.

create or replace function public.servicedesk_f15_lock_request(
  p_workspace uuid, p_request uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_workspace is not null and p_request is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'F15:request:' || p_workspace::text || ':' || p_request::text, 0));
  end if;
end;
$$;
revoke all on function public.servicedesk_f15_lock_request(uuid,uuid)
  from public,anon,authenticated;
-- A trigger may execute in the current writer's role, including authenticated.
-- A minimal fixed-ID lock is permitted; it does NOT expose any saved data.
grant execute on function public.servicedesk_f15_lock_request(uuid,uuid)
  to service_role;

-- Message write path locking: INSERT/UPDATE/DELETE cannot COMMIT a reply
-- or newly linked inbound for a request while a claim holds its lock.
create or replace function public.servicedesk_f15_message_source_lock()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare old_req uuid; new_req uuid;
begin
  if tg_op <> 'INSERT' then
    select c.request_id into old_req from public.conversations c
    where c.workspace_id=old.workspace_id and c.id=old.conversation_id;
    perform public.servicedesk_f15_lock_request(old.workspace_id,old_req);
  end if;
  if tg_op <> 'DELETE' then
    select c.request_id into new_req from public.conversations c
    where c.workspace_id=new.workspace_id and c.id=new.conversation_id;
    perform public.servicedesk_f15_lock_request(new.workspace_id,new_req);
  end if;
  return null;
end;
$$;
revoke all on function public.servicedesk_f15_message_source_lock()
  from public,anon,authenticated;
drop trigger if exists servicedesk_f15_message_source_lock on public.messages;
create trigger servicedesk_f15_message_source_lock
after insert or update or delete on public.messages
for each row execute function public.servicedesk_f15_message_source_lock();

create or replace function public.servicedesk_f15_conversation_source_lock()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.servicedesk_f15_lock_request(old.workspace_id,old.request_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.servicedesk_f15_lock_request(new.workspace_id,new.request_id);
  end if;
  return null;
end;
$$;
revoke all on function public.servicedesk_f15_conversation_source_lock()
  from public,anon,authenticated;
drop trigger if exists servicedesk_f15_conversation_source_lock on public.conversations;
create trigger servicedesk_f15_conversation_source_lock
after insert or update or delete on public.conversations
for each row execute function public.servicedesk_f15_conversation_source_lock();

-- Only a trusted SERVICE ROLE backend may invoke. SECURITY INVOKER keeps
-- privileges visible and auditable; no user-supplied actor/role bypass.
create or replace function public.servicedesk_claim_f15_unanswered_lead_sla_review(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_workspace uuid; v_branch uuid; v_request uuid; v_message uuid;
  v_version bigint; v_limit integer; v_inbound timestamptz;
  v_observed timestamptz; v_due timestamptz; v_now timestamptz;
  v_key text; v_expected text;
  v_request_row record; v_linked integer; v_last record;
  v_answered timestamptz; v_inserted uuid; v_prior record;
  v_review_id uuid; v_attention_id uuid; v_attentions integer;
  v_keys text[] := array[
    'workspaceId','branchId','requestId','sourceVersion','sourceLastInboundAt',
    'sourceLastInboundMessageId','eventType','eventKey','observedAt','dueAt',
    'thresholdMinutes','transactionalSourceRecheckRequired',
    'uniqueEventKeyRequired','requiresOwnerReview',
    'customerMessageAuthorized','financialMutationAuthorized'];
begin
  -- Exactly 16 keys, no extra fields (including PII, provider or payment data).
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or (select count(*) from pg_catalog.jsonb_object_keys(p_input))<>16
     or not (p_input ?& v_keys)
     or p_input->>'eventType' <> 'UNANSWERED_LEAD_SLA_REVIEW'
     or p_input->'transactionalSourceRecheckRequired' is distinct from 'true'::jsonb
     or p_input->'uniqueEventKeyRequired' is distinct from 'true'::jsonb
     or p_input->'requiresOwnerReview' is distinct from 'true'::jsonb
     or p_input->'customerMessageAuthorized' is distinct from 'false'::jsonb
     or p_input->'financialMutationAuthorized' is distinct from 'false'::jsonb
     or jsonb_typeof(p_input->'sourceVersion') <> 'number'
     or jsonb_typeof(p_input->'thresholdMinutes') <> 'number'
     or p_input->>'sourceVersion' !~ '^[1-9][0-9]{0,9}$'
     or p_input->>'thresholdMinutes' !~ '^[0-9]{1,4}$'
     or (p_input->>'eventKey') !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('ok',false,'code','F15_INPUT_DENIED');
  end if;

  v_workspace := (p_input->>'workspaceId')::uuid;
  v_branch := (p_input->>'branchId')::uuid;
  v_request := (p_input->>'requestId')::uuid;
  v_message := (p_input->>'sourceLastInboundMessageId')::uuid;
  v_version := (p_input->>'sourceVersion')::bigint;
  v_limit := (p_input->>'thresholdMinutes')::integer;
  v_inbound := (p_input->>'sourceLastInboundAt')::timestamptz;
  v_observed := (p_input->>'observedAt')::timestamptz;
  v_due := (p_input->>'dueAt')::timestamptz;
  v_key := p_input->>'eventKey';
  if v_version<1 or v_version>2147483647 or v_limit<15 or v_limit>1440
     or v_inbound is null or v_due is null or v_observed is null
  then return jsonb_build_object('ok',false,'code','F15_INPUT_DENIED'); end if;

  -- Re-derive SHA-256 from canonical UUIDs and immutable saved message ID.
  -- json_build_array emits ", " between string elements; remove ONLY that
  -- separator (all elements here are fixed ASCII namespace/UUID strings).
  v_expected := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.replace(pg_catalog.json_build_array(
      'SONIC_F15_UNANSWERED_LEAD_SLA_V1',v_workspace::text,v_branch::text,
      v_request::text,v_message::text)::text,', ',','),'UTF8')),'hex');
  if v_key <> v_expected then
    return jsonb_build_object('ok',false,'code','F15_EVENT_KEY_DENIED');
  end if;

  perform public.servicedesk_f15_lock_request(v_workspace,v_request);
  select r.id,r.workspace_id,r.branch_id,r.version,r.status::text as status,
    r.created_at,r.customer_id
  into v_request_row from public.requests r
  join public.workspace_branches b
    on b.workspace_id=r.workspace_id and b.id=r.branch_id and b.active
  where r.workspace_id=v_workspace and r.id=v_request and r.branch_id=v_branch
  for update of r;
  if not found or v_request_row.version<>v_version or
     v_request_row.status not in ('NEW','COLLECTING','NEEDS_REVIEW') then
    return jsonb_build_object('ok',false,'code','F15_SOURCE_CHANGED');
  end if;

  -- One unambiguous saved request conversation. An unlinked sibling
  -- conversation for the same saved customer makes "no staff reply"
  -- incomplete evidence. A multi-thread request must be reconciled first.
  select count(*) into v_linked from public.conversations c
  where c.workspace_id=v_workspace and c.request_id=v_request
    and c.branch_id=v_branch and
    c.customer_id is not distinct from v_request_row.customer_id;
  if v_linked<>1 or exists (
    select 1 from public.conversations c
    where c.workspace_id=v_workspace and
      (c.request_id=v_request or (v_request_row.customer_id is not null
        and c.customer_id=v_request_row.customer_id))
      and (c.request_id is distinct from v_request
        or c.branch_id is distinct from v_branch
        or c.customer_id is distinct from v_request_row.customer_id)
  ) then
    return jsonb_build_object('ok',false,'code','F15_RESPONSE_HISTORY_AMBIGUOUS');
  end if;

  select m.id,m.created_at into v_last
  from public.messages m join public.conversations c
    on c.workspace_id=m.workspace_id and c.id=m.conversation_id
  where c.workspace_id=v_workspace and c.branch_id=v_branch
    and c.request_id=v_request and m.direction='INBOUND'
    and m.sender_kind='CUSTOMER'
  order by m.created_at desc,m.id desc limit 1;
  if not found or v_last.id is distinct from v_message
    or v_last.created_at is distinct from v_inbound then
    return jsonb_build_object('ok',false,'code','F15_INBOUND_CHANGED');
  end if;
  select max(m.created_at) into v_answered
  from public.messages m join public.conversations c
    on c.workspace_id=m.workspace_id and c.id=m.conversation_id
  where c.workspace_id=v_workspace and c.branch_id=v_branch
    and c.request_id=v_request and m.direction='OUTBOUND'
    and m.sender_kind='STAFF';

  v_now := pg_catalog.clock_timestamp();
  if v_inbound < v_request_row.created_at or v_inbound>v_now
    or v_due is distinct from v_inbound+pg_catalog.make_interval(mins=>v_limit)
    or v_observed>v_now or v_observed<v_due or v_now<v_due
    or (v_answered is not null and v_answered>=v_inbound)
  then
    return jsonb_build_object('ok',false,'code','F15_NOT_DUE_OR_ANSWERED');
  end if;

  insert into public.f15_unanswered_lead_reviews(
    workspace_id,branch_id,request_id,inbound_message_id,source_version,
    source_last_inbound_at,event_key,due_at)
  values(v_workspace,v_branch,v_request,v_message,v_version,v_inbound,v_key,v_due)
  on conflict (workspace_id,branch_id,event_key) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select e.id,e.request_id,e.inbound_message_id,e.source_last_inbound_at,e.source_version
    into v_prior from public.f15_unanswered_lead_reviews e
    where e.workspace_id=v_workspace and e.branch_id=v_branch
      and e.event_key=v_key;
    if not found or v_prior.request_id is distinct from v_request
      or v_prior.inbound_message_id is distinct from v_message or
      v_prior.source_last_inbound_at is distinct from v_inbound
      or v_prior.source_version is distinct from v_version then
      return jsonb_build_object('ok',false,'code','F15_REPLAY_INCONSISTENT');
    end if;
  end if;

  -- The internal Attention Center is the actual owner-facing durable
  -- effect. This is NOT a workflow rule execution and cannot dispatch a
  -- provider. Each unique review can have ONE linked attention item.
  v_review_id := coalesce(v_inserted,v_prior.id);
  if v_review_id is null then
    raise exception 'F15_REVIEW_SOURCE_NOT_VERIFIED';
  end if;
  if v_inserted is not null then
    insert into public.attention_items(
      workspace_id,type,resource_type,resource_id,severity,status,
      summary,due_at
    ) values (
      v_workspace,'UNANSWERED_LEAD_SLA','f15_unanswered_lead_review',
      v_review_id,'WARNING','OPEN',
      'Saved unanswered customer lead needs owner review',v_due
    ) returning id into v_attention_id;
  end if;
  -- A replay MUST verify that its exact existing review still owns a saved
  -- attention, even when a human acknowledged or resolved the item.
  select count(*),min(a.id::text)::uuid into v_attentions,v_attention_id
  from public.attention_items a
  where a.workspace_id=v_workspace
    and a.type='UNANSWERED_LEAD_SLA'
    and a.resource_type='f15_unanswered_lead_review'
    and a.resource_id=v_review_id
    and a.severity='WARNING'
    and a.status in ('OPEN','ACKNOWLEDGED','RESOLVED');
  if v_attentions<>1 or v_attention_id is null then
    raise exception 'F15_ATTENTION_NOT_COMMITTED_WITH_REVIEW';
  end if;

  -- Exact receipt contract; HTTP RPC must complete its transaction before
  -- this becomes evidence to the caller. No provider and no workflow run.
  return jsonb_build_object(
    'state',case when v_inserted is null then 'ALREADY_RECORDED' else 'INSERTED' end,
    'eventKey',v_key,'workspaceId',v_workspace,'branchId',v_branch,
    'requestId',v_request,'sourceVersion',v_version,
    'sourceLastInboundAt',p_input->>'sourceLastInboundAt',
    'sourceLastInboundMessageId',v_message,
    'transactionCommitted',true,'sourceRecheckedUnderLock',true,
    'uniqueEventKeyEnforced',true,'externalSideEffects',false,
    'savedRowsInserted',case when v_inserted is null then 0 else 1 end
  );
exception
  when invalid_text_representation or datetime_field_overflow
    or numeric_value_out_of_range then
    return jsonb_build_object('ok',false,'code','F15_INPUT_DENIED');
end;
$$;
revoke all on function public.servicedesk_claim_f15_unanswered_lead_sla_review(jsonb)
  from public, anon, authenticated;
grant execute on function public.servicedesk_claim_f15_unanswered_lead_sla_review(jsonb)
  to service_role;
