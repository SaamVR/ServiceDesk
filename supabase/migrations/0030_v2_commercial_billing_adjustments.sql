-- ServiceDesk AI V2 Wave 2B.2C: policy-bound commercial billing adjustments.
-- A resolved commercial exception may become one explicit credit/charge line on an editable billing draft.
-- This command never issues an invoice and never applies payment.

create or replace function public.servicedesk_add_commercial_billing_adjustment(p_input jsonb)
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
  v_exception_id uuid := nullif(p_input->>'exceptionCaseId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_case public.commercial_exception_cases%rowtype;
  v_existing public.commercial_billing_lines%rowtype;
  v_line public.commercial_billing_lines%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_draft_id is null or v_exception_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_INPUT_INVALID');
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

  select * into v_case
  from public.commercial_exception_cases
  where workspace_id = v_workspace and id = v_exception_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_EXCEPTION_NOT_FOUND');
  end if;
  if v_case.state <> 'RESOLVED' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_EXCEPTION_NOT_RESOLVED');
  end if;
  if v_case.requested_adjustment_kind is null
     or v_case.requested_adjustment_minor is null
     or v_case.requested_adjustment_currency is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_NOT_REQUESTED');
  end if;
  if v_case.contract_version_id is null or v_case.contract_version_id <> v_draft.contract_version_id then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_CONTRACT_VERSION_MISMATCH');
  end if;
  if v_case.organization_id <> v_draft.organization_id or v_case.contract_id <> v_draft.contract_id then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_CONTRACT_MISMATCH');
  end if;
  if v_case.requested_adjustment_currency <> v_draft.currency then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_CURRENCY_MISMATCH');
  end if;

  select * into v_existing
  from public.commercial_billing_lines
  where workspace_id = v_workspace
    and exception_case_id = v_exception_id
    and state = 'INCLUDED'
  order by created_at
  limit 1;

  if found then
    if v_existing.draft_id = v_draft.id then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_ALREADY_INCLUDED');
  end if;

  insert into public.commercial_billing_lines(
    workspace_id,
    draft_id,
    source_type,
    visit_id,
    exception_case_id,
    direction,
    amount_minor,
    currency,
    state,
    description_snapshot,
    created_at,
    updated_at
  ) values (
    v_workspace,
    v_draft.id,
    'ADJUSTMENT',
    null,
    v_case.id,
    v_case.requested_adjustment_kind,
    v_case.requested_adjustment_minor,
    v_case.requested_adjustment_currency,
    'INCLUDED',
    jsonb_strip_nulls(jsonb_build_object(
      'exceptionType', v_case.type,
      'siteId', v_case.site_id,
      'visitId', v_case.visit_id,
      'sourceCaseVersion', v_case.version
    )),
    v_now,
    v_now
  )
  returning * into v_line;

  update public.commercial_billing_drafts
  set version = version + 1, updated_at = v_now
  where workspace_id = v_workspace and id = v_draft.id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft.id, v_now);

  insert into public.audit_events(
    workspace_id,
    actor_user_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    after_data
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'COMMERCIAL_BILLING_ADJUSTMENT_ADDED',
    'commercial_billing_line',
    v_line.id,
    jsonb_build_object(
      'draftId', v_draft.id,
      'exceptionCaseId', v_case.id,
      'direction', v_line.direction,
      'amountMinor', v_line.amount_minor,
      'currency', v_line.currency
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_ADJUSTMENT_ALREADY_INCLUDED');
end;
$$;

revoke all on function public.servicedesk_add_commercial_billing_adjustment(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_add_commercial_billing_adjustment(jsonb) to service_role;
