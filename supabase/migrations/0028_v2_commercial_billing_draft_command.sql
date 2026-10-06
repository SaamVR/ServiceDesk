-- ServiceDesk AI V2 Wave 2B.2A: create consolidated commercial invoice draft.

create or replace function public.servicedesk_create_commercial_billing_draft(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_contract_version_id uuid := nullif(p_input->>'contractVersionId','')::uuid;
  v_period_start date := nullif(p_input->>'periodStart','')::date;
  v_period_end date := nullif(p_input->>'periodEnd','')::date;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_version public.commercial_contract_versions%rowtype;
  v_contract public.commercial_contracts%rowtype;
  v_draft public.commercial_billing_drafts%rowtype;
  v_bad_visit uuid;
  v_duplicate_visit uuid;
  v_count integer;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_contract_version_id is null or v_period_start is null or v_period_end is null
     or v_period_end < v_period_start then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_INPUT_INVALID');
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

  select * into v_version
  from public.commercial_contract_versions
  where workspace_id = v_workspace and id = v_contract_version_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_CONTRACT_VERSION_NOT_FOUND');
  end if;
  if v_version.state <> 'APPROVED' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_CONTRACT_VERSION_NOT_APPROVED');
  end if;
  if v_period_start < v_version.effective_from
     or (v_version.effective_to is not null and v_period_end > v_version.effective_to) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_PERIOD_OUTSIDE_CONTRACT');
  end if;

  select * into v_contract
  from public.commercial_contracts
  where workspace_id = v_workspace and id = v_version.contract_id
  for update;

  if not found or v_contract.status <> 'ACTIVE' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_CONTRACT_NOT_ACTIVE');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace
    and contract_version_id = v_contract_version_id
    and period_start = v_period_start
    and period_end = v_period_end
    and state in ('DRAFT','FINALIZED')
  order by created_at
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
    );
  end if;

  select visit_id into v_bad_visit
  from public.servicedesk_commercial_billing_candidates(
    v_workspace, v_contract_version_id, v_period_start, v_period_end
  )
  where not rate_resolved
  order by visit_starts_at, visit_id
  limit 1;

  if v_bad_visit is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'COMMERCIAL_BILLING_RATE_UNRESOLVED',
      'visitId', v_bad_visit
    );
  end if;

  select c.visit_id into v_duplicate_visit
  from public.servicedesk_commercial_billing_candidates(
    v_workspace, v_contract_version_id, v_period_start, v_period_end
  ) c
  join public.commercial_billing_lines l
    on l.workspace_id = v_workspace
   and l.visit_id = c.visit_id
   and l.state = 'INCLUDED'
  where c.rate_resolved
  order by c.visit_starts_at, c.visit_id
  limit 1;

  if v_duplicate_visit is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED',
      'visitId', v_duplicate_visit
    );
  end if;

  select count(*) into v_count
  from public.servicedesk_commercial_billing_candidates(
    v_workspace, v_contract_version_id, v_period_start, v_period_end
  )
  where rate_resolved;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_NO_ELIGIBLE_VISITS');
  end if;

  insert into public.commercial_billing_drafts(
    workspace_id, organization_id, contract_id, contract_version_id,
    period_start, period_end, state, currency, created_by, created_at, updated_at
  ) values (
    v_workspace, v_contract.organization_id, v_contract.id, v_version.id,
    v_period_start, v_period_end, 'DRAFT', v_version.currency, v_actor_user, v_now, v_now
  )
  returning * into v_draft;

  insert into public.commercial_billing_lines(
    workspace_id, draft_id, source_type, visit_id, direction, amount_minor, currency,
    state, description_snapshot, created_at, updated_at
  )
  select
    v_workspace,
    v_draft.id,
    'VISIT',
    c.visit_id,
    'CHARGE',
    c.amount_minor,
    v_version.currency,
    'INCLUDED',
    jsonb_build_object(
      'contractSiteId', c.contract_site_id,
      'siteId', c.site_id,
      'serviceId', c.service_id,
      'visitStartsAt', c.visit_starts_at,
      'billingModel', 'FIXED_PER_VISIT',
      'rateSource', c.rate_source
    ),
    v_now,
    v_now
  from public.servicedesk_commercial_billing_candidates(
    v_workspace, v_contract_version_id, v_period_start, v_period_end
  ) c
  where c.rate_resolved
  order by c.visit_starts_at, c.visit_id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft.id, v_now);

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace,
    v_actor_user,
    v_actor_role,
    'COMMERCIAL_BILLING_DRAFT_CREATED',
    'commercial_billing_draft',
    v_draft.id,
    jsonb_build_object(
      'contractVersionId', v_contract_version_id,
      'periodStart', v_period_start,
      'periodEnd', v_period_end,
      'visitCount', v_count
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_create_commercial_billing_draft(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_create_commercial_billing_draft(jsonb) to service_role;
