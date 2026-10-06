-- ServiceDesk AI V2 Wave 2B.1: feature-gated commercial portfolio read snapshot.
-- Read-only trusted RPC. Commercial writes remain unavailable until explicit command contracts are approved.

create or replace function public.servicedesk_read_commercial_portfolio_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_feature public.workspace_feature_flags%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_READ_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_feature
  from public.workspace_feature_flags
  where workspace_id = v_workspace
    and feature_key = 'COMMERCIAL_OPERATIONS';

  if not found or not v_feature.enabled then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'feature', jsonb_build_object(
        'workspaceId', v_feature.workspace_id,
        'featureKey', v_feature.feature_key,
        'enabled', v_feature.enabled,
        'config', v_feature.config,
        'version', v_feature.version,
        'updatedAt', v_feature.updated_at
      ),
      'organizations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'workspaceId', o.workspace_id,
          'displayName', o.display_name,
          'legalName', o.legal_name,
          'reference', o.reference,
          'status', o.status,
          'version', o.version,
          'createdAt', o.created_at,
          'updatedAt', o.updated_at
        ) order by o.display_name, o.id)
        from public.commercial_organizations o
        where o.workspace_id = v_workspace
      ), '[]'::jsonb),
      'contacts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'workspaceId', c.workspace_id,
          'organizationId', c.organization_id,
          'customerId', c.customer_id,
          'title', c.title,
          'authorizedRequester', c.authorized_requester,
          'billingContact', c.billing_contact,
          'operationsContact', c.operations_contact,
          'createdAt', c.created_at,
          'updatedAt', c.updated_at
        ) order by c.organization_id, c.created_at, c.id)
        from public.commercial_portfolio_contacts c
        where c.workspace_id = v_workspace
      ), '[]'::jsonb),
      'sites', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'workspaceId', s.workspace_id,
          'organizationId', s.organization_id,
          'propertyId', s.property_id,
          'siteCode', s.site_code,
          'active', s.active,
          'version', s.version,
          'createdAt', s.created_at,
          'updatedAt', s.updated_at
        ) order by s.organization_id, s.site_code nulls last, s.id)
        from public.commercial_sites s
        where s.workspace_id = v_workspace
      ), '[]'::jsonb),
      'contracts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'workspaceId', c.workspace_id,
          'organizationId', c.organization_id,
          'contractNumber', c.contract_number,
          'status', c.status,
          'version', c.version,
          'createdAt', c.created_at,
          'updatedAt', c.updated_at
        ) order by c.organization_id, c.contract_number, c.id)
        from public.commercial_contracts c
        where c.workspace_id = v_workspace
      ), '[]'::jsonb),
      'contractVersions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', v.id,
          'workspaceId', v.workspace_id,
          'contractId', v.contract_id,
          'versionNumber', v.version_number,
          'state', v.state,
          'effectiveFrom', v.effective_from::text,
          'effectiveTo', case when v.effective_to is null then null else v.effective_to::text end,
          'currency', v.currency,
          'rateSnapshot', v.rate_snapshot,
          'approvalAuthority', v.approval_authority,
          'approvedByUserId', v.approved_by_user_id,
          'approvedAt', v.approved_at,
          'createdAt', v.created_at
        ) order by v.contract_id, v.version_number, v.id)
        from public.commercial_contract_versions v
        where v.workspace_id = v_workspace
      ), '[]'::jsonb),
      'contractSites', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cs.id,
          'workspaceId', cs.workspace_id,
          'contractVersionId', cs.contract_version_id,
          'siteId', cs.site_id,
          'serviceId', cs.service_id,
          'scopeSnapshot', cs.scope_snapshot,
          'serviceLevelTargetMinutes', cs.service_level_target_minutes,
          'availabilitySnapshot', cs.availability_snapshot,
          'rateOverrideSnapshot', cs.rate_override_snapshot,
          'active', cs.active,
          'createdAt', cs.created_at
        ) order by cs.contract_version_id, cs.site_id, cs.service_id, cs.id)
        from public.commercial_contract_sites cs
        where cs.workspace_id = v_workspace
      ), '[]'::jsonb),
      'servicePlans', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'workspaceId', p.workspace_id,
          'contractVersionId', p.contract_version_id,
          'contractSiteId', p.contract_site_id,
          'recurrenceRuleId', p.recurrence_rule_id,
          'frequency', p.frequency::text,
          'timezone', p.timezone,
          'localStartTime', p.local_start_time::text,
          'startsOn', p.starts_on::text,
          'endsOn', case when p.ends_on is null then null else p.ends_on::text end,
          'preferredWindowStart', case when p.preferred_window_start is null then null else p.preferred_window_start::text end,
          'preferredWindowEnd', case when p.preferred_window_end is null then null else p.preferred_window_end::text end,
          'status', p.status,
          'version', p.version,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at
        ) order by p.contract_version_id, p.starts_on, p.id)
        from public.commercial_site_service_plans p
        where p.workspace_id = v_workspace
      ), '[]'::jsonb),
      'exceptionCases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id,
          'workspaceId', e.workspace_id,
          'organizationId', e.organization_id,
          'contractId', e.contract_id,
          'contractVersionId', e.contract_version_id,
          'siteId', e.site_id,
          'visitId', e.visit_id,
          'type', e.type,
          'state', e.state,
          'summary', e.summary,
          'ownerUserId', e.owner_user_id,
          'requestedAdjustmentKind', e.requested_adjustment_kind,
          'requestedAdjustmentMinor', e.requested_adjustment_minor,
          'requestedAdjustmentCurrency', e.requested_adjustment_currency,
          'resolutionNote', e.resolution_note,
          'version', e.version,
          'createdAt', e.created_at,
          'updatedAt', e.updated_at
        ) order by e.state, e.updated_at desc, e.id)
        from public.commercial_exception_cases e
        where e.workspace_id = v_workspace
      ), '[]'::jsonb)
    )
  );
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_READ_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) from public;
revoke all on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) from anon;
revoke all on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) from authenticated;
grant execute on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) to service_role;

comment on function public.servicedesk_read_commercial_portfolio_snapshot(jsonb) is
  'Trusted staff-only Wave 2B commercial snapshot. Requires active OWNER/DISPATCHER membership and COMMERCIAL_OPERATIONS feature enablement.';
