-- ServiceDesk AI V2 Wave 2B.4A: commercial direct-cost command authority.

create or replace function public.servicedesk_commercial_direct_cost_json(
  p_row public.commercial_direct_cost_entries
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_row.id is null then null else jsonb_build_object(
    'id', p_row.id,
    'workspaceId', p_row.workspace_id,
    'visitId', p_row.visit_id,
    'contractVersionId', p_row.contract_version_id,
    'siteId', p_row.site_id,
    'serviceId', p_row.service_id,
    'category', p_row.category,
    'basis', p_row.basis,
    'direction', p_row.direction,
    'amountMinor', p_row.amount_minor,
    'currency', p_row.currency,
    'sourceKind', p_row.source_kind,
    'sourceReference', p_row.source_reference,
    'reversesEntryId', p_row.reverses_entry_id,
    'occurredAt', p_row.occurred_at,
    'createdAt', p_row.created_at
  ) end;
$$;

create or replace function public.servicedesk_record_commercial_direct_cost(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_visit_id uuid := nullif(p_input->>'visitId','')::uuid;
  v_category text := p_input->>'category';
  v_basis text := p_input->>'basis';
  v_direction text := p_input->>'direction';
  v_amount bigint := nullif(p_input->>'amountMinor','')::bigint;
  v_currency char(3) := upper(p_input->>'currency');
  v_source_kind text := p_input->>'sourceKind';
  v_source_ref text := nullif(trim(p_input->>'sourceReference'),'');
  v_reverses uuid := nullif(p_input->>'reversesEntryId','')::uuid;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'),'');
  v_occurred timestamptz := nullif(p_input->>'occurredAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_visit public.visits%rowtype;
  v_contract_version_id uuid;
  v_site_id uuid;
  v_service_id uuid;
  v_contract_currency char(3);
  v_existing public.commercial_direct_cost_entries%rowtype;
  v_original public.commercial_direct_cost_entries%rowtype;
  v_row public.commercial_direct_cost_entries%rowtype;
  v_reversed bigint;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_visit_id is null
     or v_category not in ('LABOR','SUPPLIES','TRAVEL')
     or v_basis not in ('ESTIMATED','ACTUAL')
     or v_direction not in ('COST','REVERSAL')
     or v_amount is null or v_amount <= 0
     or v_currency is null or length(v_currency) <> 3
     or v_source_kind not in ('MANUAL','CREW_RATE','SUPPLY','TRAVEL')
     or v_idempotency is null or length(v_idempotency) not between 8 and 160
     or v_occurred is null
     or (v_source_ref is not null and length(v_source_ref) > 160)
     or (v_direction = 'COST' and v_reverses is not null)
     or (v_direction = 'REVERSAL' and v_reverses is null) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_INPUT_INVALID');
  end if;

  if (v_category = 'LABOR' and v_source_kind not in ('MANUAL','CREW_RATE'))
     or (v_category = 'SUPPLIES' and v_source_kind not in ('MANUAL','SUPPLY'))
     or (v_category = 'TRAVEL' and v_source_kind not in ('MANUAL','TRAVEL')) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_SOURCE_MISMATCH');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.workspace_feature_flags
    where workspace_id = v_workspace and feature_key = 'COMMERCIAL_OPERATIONS' and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  select * into v_existing
  from public.commercial_direct_cost_entries
  where workspace_id = v_workspace and idempotency_key = v_idempotency
  limit 1;

  if found then
    if v_existing.visit_id = v_visit_id
       and v_existing.category = v_category
       and v_existing.basis = v_basis
       and v_existing.direction = v_direction
       and v_existing.amount_minor = v_amount
       and v_existing.currency = v_currency
       and v_existing.source_kind = v_source_kind
       and coalesce(v_existing.source_reference,'') = coalesce(v_source_ref,'')
       and v_existing.reverses_entry_id is not distinct from v_reverses
       and v_existing.occurred_at = v_occurred then
      return jsonb_build_object(
        'ok', true, 'duplicate', true,
        'entry', public.servicedesk_commercial_direct_cost_json(v_existing)
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_IDEMPOTENCY_CONFLICT');
  end if;

  select v.*,
         sp.contract_version_id,
         cs.site_id,
         cs.service_id,
         cv.currency
  into v_visit, v_contract_version_id, v_site_id, v_service_id, v_contract_currency
  from public.visits v
  join public.requests req
    on req.workspace_id = v.workspace_id and req.id = v.request_id
  join public.recurrence_occurrences ro
    on ro.workspace_id = req.workspace_id and ro.request_id = req.id
  join public.commercial_site_service_plans sp
    on sp.workspace_id = ro.workspace_id and sp.recurrence_rule_id = ro.rule_id
  join public.commercial_contract_sites cs
    on cs.workspace_id = sp.workspace_id and cs.id = sp.contract_site_id
  join public.commercial_sites site
    on site.workspace_id = cs.workspace_id and site.id = cs.site_id
   and site.property_id = req.property_id
  join public.commercial_contract_versions cv
    on cv.workspace_id = sp.workspace_id and cv.id = sp.contract_version_id
  where v.workspace_id = v_workspace
    and v.id = v_visit_id
    and cs.service_id = req.service_id
  order by ro.sequence desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_VISIT_NOT_CONTRACT_BACKED');
  end if;

  if v_visit.status = 'CANCELLED' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_VISIT_CANCELLED');
  end if;
  if v_basis = 'ACTUAL' and v_visit.status <> 'COMPLETED' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_ACTUAL_REQUIRES_COMPLETION');
  end if;
  if v_currency <> v_contract_currency then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_CURRENCY_MISMATCH');
  end if;

  if v_direction = 'REVERSAL' then
    select * into v_original
    from public.commercial_direct_cost_entries
    where workspace_id = v_workspace and id = v_reverses
    for update;

    if not found
       or v_original.direction <> 'COST'
       or v_original.visit_id <> v_visit_id
       or v_original.contract_version_id <> v_contract_version_id
       or v_original.site_id <> v_site_id
       or v_original.service_id <> v_service_id
       or v_original.category <> v_category
       or v_original.basis <> v_basis
       or v_original.currency <> v_currency then
      return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_REVERSAL_MISMATCH');
    end if;
    if v_occurred < v_original.occurred_at then
      return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_REVERSAL_TIME_INVALID');
    end if;

    select coalesce(sum(amount_minor),0) into v_reversed
    from public.commercial_direct_cost_entries
    where workspace_id = v_workspace
      and direction = 'REVERSAL'
      and reverses_entry_id = v_original.id;

    if v_reversed + v_amount > v_original.amount_minor then
      return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_OVER_REVERSAL');
    end if;
  end if;

  insert into public.commercial_direct_cost_entries(
    workspace_id, visit_id, contract_version_id, site_id, service_id,
    category, basis, direction, amount_minor, currency, source_kind, source_reference,
    reverses_entry_id, idempotency_key, created_by, occurred_at, created_at
  ) values (
    v_workspace, v_visit_id, v_contract_version_id, v_site_id, v_service_id,
    v_category, v_basis, v_direction, v_amount, v_currency, v_source_kind, v_source_ref,
    v_reverses, v_idempotency, v_actor_user, v_occurred, v_now
  )
  returning * into v_row;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role,
    case when v_direction = 'REVERSAL'
      then 'COMMERCIAL_DIRECT_COST_REVERSED'
      else 'COMMERCIAL_DIRECT_COST_RECORDED'
    end,
    'commercial_direct_cost', v_row.id,
    jsonb_build_object(
      'visitId', v_visit_id,
      'category', v_category,
      'basis', v_basis,
      'direction', v_direction,
      'amountMinor', v_amount,
      'currency', v_currency,
      'sourceKind', v_source_kind,
      'reversesEntryId', v_reverses
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true, 'duplicate', false,
    'entry', public.servicedesk_commercial_direct_cost_json(v_row)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_commercial_direct_cost_json(public.commercial_direct_cost_entries) from public;
revoke all on function public.servicedesk_record_commercial_direct_cost(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_commercial_direct_cost_json(public.commercial_direct_cost_entries) to service_role;
grant execute on function public.servicedesk_record_commercial_direct_cost(jsonb) to service_role;
