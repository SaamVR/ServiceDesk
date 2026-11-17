-- F23 review-only atomic unused-HELD-slot release candidate. NOT INSTALLED.
-- This is NOT a migration, a permit to enable flags, or payment-provider proof.
-- Matches lock order in historical 0010_e03_verified_payment_rpc.sql:
-- quote FOR UPDATE -> hold FOR UPDATE -> capacity slot. All checks and the
-- release update run in ONE database transaction, rather than two API reads
-- followed by a service-role table UPDATE.
--
-- Prerequisites for any future approved install:
--  * human DBA verifies exact connected migration preimage and ledger;
--  * independent original-payment/deposit concurrency race review;
--  * role-level EXECUTE ACL / rollback and two-tenant acceptance;
--  * F23 activation remains default OFF until separate human approval.
create or replace function public.servicedesk_release_held_slot_atomic(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_quote_id uuid := nullif(p_input->>'quoteId','')::uuid;
  v_hold_id uuid := nullif(p_input->>'holdId','')::uuid;
  v_slot_id uuid := nullif(p_input->>'slotId','')::uuid;
  v_original_expiry timestamptz := nullif(p_input->>'expiresAt','')::timestamptz;
  v_quote public.quotes%rowtype;
  v_hold public.slot_holds%rowtype;
  v_request public.requests%rowtype;
  v_slot public.capacity_slots%rowtype;
  v_crew public.crews%rowtype;
  v_owner boolean;
  v_current_count integer;
  v_updated uuid;
begin
  -- The service-role key must never be client-exposed. Verify the actual
  -- OWNER row despite privileged RPC use; actorUserId alone is not proof.
  if current_user <> 'service_role' then
    return jsonb_build_object('ok',false,'code','FORBIDDEN');
  end if;
  if v_workspace is null or v_actor is null or v_quote_id is null
     or v_hold_id is null or v_slot_id is null or v_original_expiry is null
     or v_workspace = v_actor or v_quote_id = v_hold_id then
    return jsonb_build_object('ok',false,'code','INVALID_SELECTION');
  end if;

  -- Historical deposit application always locks quote BEFORE hold, so this
  -- new path uses the SAME order to avoid inversion under payment races.
  select * into v_quote from public.quotes
  where workspace_id = v_workspace and id = v_quote_id for update;
  if not found or v_quote.status <> 'ACCEPTED' or v_quote.version < 1 then
    return jsonb_build_object('ok',false,'code','QUOTE_NOT_ELIGIBLE');
  end if;

  select * into v_hold from public.slot_holds
  where workspace_id = v_workspace and id = v_hold_id for update;
  if not found or v_hold.quote_id <> v_quote_id
    or v_hold.slot_id <> v_slot_id or v_hold.status <> 'HELD'
    or v_hold.expires_at is distinct from v_original_expiry
    or v_hold.expires_at <= clock_timestamp() then
    return jsonb_build_object('ok',false,'code','HOLD_NOT_ELIGIBLE');
  end if;

  -- Recheck OWNER status under the very transaction that releases the hold.
  select true into v_owner from public.memberships m
  where m.workspace_id = v_workspace and m.user_id = v_actor
    and m.status = 'ACTIVE' and m.role = 'OWNER'
  for share of m;
  if not coalesce(v_owner,false) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN');
  end if;

  select * into v_request from public.requests
  where workspace_id = v_workspace and id = v_quote.request_id for share;
  if not found or v_request.version < 1 then
    return jsonb_build_object('ok',false,'code','REQUEST_NOT_ELIGIBLE');
  end if;
  select count(*) into v_current_count from public.quotes q
  where q.workspace_id = v_workspace and q.request_id = v_request.id
    and q.status <> 'SUPERSEDED';
  if v_current_count <> 1 then
    return jsonb_build_object('ok',false,'code','AMBIGUOUS_QUOTE');
  end if;

  select * into v_slot from public.capacity_slots
  where workspace_id = v_workspace and id = v_hold.slot_id for share;
  if not found or v_slot.crew_id is null or
     v_slot.starts_at <= clock_timestamp() then
    return jsonb_build_object('ok',false,'code','SLOT_NOT_ELIGIBLE');
  end if;
  select * into v_crew from public.crews
  where workspace_id = v_workspace and id = v_slot.crew_id for share;
  if not found or v_crew.branch_id <> v_request.branch_id then
    return jsonb_build_object('ok',false,'code','CREW_NOT_ELIGIBLE');
  end if;

  -- No payment/booking row of ANY state may exist for the exact quote.
  -- This blocks release after a committed provider receipt (even REVIEW).
  if exists(select 1 from public.visits v
            where v.workspace_id = v_workspace and v.quote_id = v_quote_id)
     or exists(select 1 from public.verified_payment_applications a
            where a.workspace_id = v_workspace and a.quote_id = v_quote_id)
  then return jsonb_build_object('ok',false,'code','PAYMENT_OR_BOOKING_RECORDED');
  end if;

  update public.slot_holds
  set status = 'RELEASED',updated_at = clock_timestamp()
  where workspace_id = v_workspace and id = v_hold_id
    and quote_id = v_quote_id and slot_id = v_slot_id
    and status = 'HELD' and expires_at = v_original_expiry
    and expires_at > clock_timestamp()
  returning id into v_updated;
  if v_updated is distinct from v_hold_id then
    return jsonb_build_object('ok',false,'code','RELEASE_NOT_VERIFIED');
  end if;
  return jsonb_build_object('ok',true,'state','HOLD_RELEASED',
    'holdId',v_hold_id,'quoteId',v_quote_id,'slotId',v_slot_id,
    'newCapacityVerified',false,'paymentChanged',false,'customerMessaged',false);
end;
$$;

-- Explicit service-role-only boundary: avoid PostgreSQL default PUBLIC EXECUTE.
revoke all on function public.servicedesk_release_held_slot_atomic(jsonb) from public;
revoke all on function public.servicedesk_release_held_slot_atomic(jsonb) from anon;
revoke all on function public.servicedesk_release_held_slot_atomic(jsonb) from authenticated;
grant execute on function public.servicedesk_release_held_slot_atomic(jsonb) to service_role;
