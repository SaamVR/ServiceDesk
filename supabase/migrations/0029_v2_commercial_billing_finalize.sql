-- ServiceDesk AI V2 Wave 2B.2A: edit and finalize consolidated commercial billing drafts.

create or replace function public.servicedesk_set_commercial_billing_line_state(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_draft_id uuid := nullif(p_input->>'draftId','')::uuid;
  v_line_id uuid := nullif(p_input->>'lineId','')::uuid;
  v_state text := p_input->>'state';
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_line public.commercial_billing_lines%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_draft_id is null or v_line_id is null or v_expected is null
     or v_state not in ('INCLUDED','EXCLUDED') then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_LINE_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1
    from public.workspace_feature_flags
    where workspace_id = v_workspace
      and feature_key = 'COMMERCIAL_OPERATIONS'
      and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_NOT_FOUND');
  end if;
  if v_draft.state <> 'DRAFT' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_LOCKED');
  end if;
  if v_draft.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VERSION_CONFLICT');
  end if;

  select * into v_line
  from public.commercial_billing_lines
  where workspace_id = v_workspace and draft_id = v_draft_id and id = v_line_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_LINE_NOT_FOUND');
  end if;

  if v_state = 'INCLUDED' and v_line.visit_id is not null and exists (
    select 1
    from public.commercial_billing_lines other
    where other.workspace_id = v_workspace
      and other.visit_id = v_line.visit_id
      and other.state = 'INCLUDED'
      and other.id <> v_line.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED');
  end if;

  update public.commercial_billing_lines
  set state = v_state, updated_at = v_now
  where workspace_id = v_workspace and id = v_line_id;

  update public.commercial_billing_drafts
  set version = version + 1, updated_at = v_now
  where workspace_id = v_workspace and id = v_draft_id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft_id, v_now);

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'COMMERCIAL_BILLING_LINE_STATE_CHANGED',
    'commercial_billing_line',
    v_line_id,
    jsonb_build_object('draftId', v_draft_id, 'state', v_state)
  );

  return jsonb_build_object(
    'ok', true,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft_id)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED');
end;
$$;

create or replace function public.servicedesk_finalize_commercial_billing_draft(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_draft_id uuid := nullif(p_input->>'draftId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_invoice public.invoices%rowtype;
  v_count integer;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_draft_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_FINALIZE_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1
    from public.workspace_feature_flags
    where workspace_id = v_workspace
      and feature_key = 'COMMERCIAL_OPERATIONS'
      and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_NOT_FOUND');
  end if;

  if v_draft.state = 'FINALIZED' and v_draft.invoice_id is not null then
    select * into v_invoice
    from public.invoices
    where workspace_id = v_workspace and id = v_draft.invoice_id;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_INVOICE_MISSING');
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id),
      'invoice', jsonb_build_object(
        'id', v_invoice.id,
        'workspaceId', v_invoice.workspace_id,
        'status', v_invoice.status::text,
        'currency', v_invoice.currency,
        'totalMinor', v_invoice.total_minor,
        'allocatedMinor', v_invoice.allocated_minor,
        'refundedMinor', v_invoice.refunded_minor,
        'balanceMinor', v_invoice.balance_minor
      )
    );
  end if;

  if v_draft.state <> 'DRAFT' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_LOCKED');
  end if;
  if v_draft.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VERSION_CONFLICT');
  end if;

  if not exists (
    select 1
    from public.commercial_contract_versions cv
    join public.commercial_contracts cc
      on cc.workspace_id = cv.workspace_id and cc.id = cv.contract_id
    where cv.workspace_id = v_workspace
      and cv.id = v_draft.contract_version_id
      and cv.state = 'APPROVED'
      and cc.status = 'ACTIVE'
      and v_draft.period_start >= cv.effective_from
      and (cv.effective_to is null or v_draft.period_end <= cv.effective_to)
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_CONTRACT_NO_LONGER_ISSUABLE');
  end if;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft_id, v_now);

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  select count(*) into v_count
  from public.commercial_billing_lines
  where workspace_id = v_workspace
    and draft_id = v_draft_id
    and state = 'INCLUDED';

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_EMPTY_DRAFT');
  end if;
  if v_draft.net_total_minor <= 0 then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_NONPOSITIVE_TOTAL');
  end if;

  insert into public.invoices(
    workspace_id, quote_id, visit_id, commercial_billing_draft_id,
    status, currency, total_minor, allocated_minor, refunded_minor, balance_minor,
    version, created_at, updated_at
  ) values (
    v_workspace, null, null, v_draft.id,
    'ISSUED', v_draft.currency, v_draft.net_total_minor, 0, 0, v_draft.net_total_minor,
    1, v_now, v_now
  )
  returning * into v_invoice;

  update public.commercial_billing_drafts
  set state = 'FINALIZED',
      invoice_id = v_invoice.id,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_draft.id;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'COMMERCIAL_BILLING_FINALIZED',
    'commercial_billing_draft',
    v_draft.id,
    jsonb_build_object(
      'invoiceId', v_invoice.id,
      'totalMinor', v_invoice.total_minor,
      'currency', v_invoice.currency
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id),
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'workspaceId', v_invoice.workspace_id,
      'status', v_invoice.status::text,
      'currency', v_invoice.currency,
      'totalMinor', v_invoice.total_minor,
      'allocatedMinor', v_invoice.allocated_minor,
      'refundedMinor', v_invoice.refunded_minor,
      'balanceMinor', v_invoice.balance_minor
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_FINALIZE_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_set_commercial_billing_line_state(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_finalize_commercial_billing_draft(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_set_commercial_billing_line_state(jsonb) to service_role;
grant execute on function public.servicedesk_finalize_commercial_billing_draft(jsonb) to service_role;
