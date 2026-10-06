-- ServiceDesk AI V2 Wave 2B.3A: accounting reconciliation read boundary.

create or replace function public.servicedesk_accounting_integration_json(p_row public.accounting_integrations)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_row.id is null then null else jsonb_build_object(
    'id', p_row.id,
    'workspaceId', p_row.workspace_id,
    'provider', p_row.provider,
    'status', p_row.status,
    'defaultSyncOwner', p_row.default_sync_owner,
    'lastSuccessAt', p_row.last_success_at,
    'lastErrorCode', p_row.last_error_code,
    'version', p_row.version,
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at
  ) end;
$$;

create or replace function public.servicedesk_accounting_reconciliation_json(p_row public.accounting_reconciliation_records)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_row.id is null then null else jsonb_build_object(
    'id', p_row.id,
    'workspaceId', p_row.workspace_id,
    'integrationId', p_row.integration_id,
    'entityType', p_row.entity_type,
    'localResourceKind', p_row.local_resource_kind,
    'localResourceId', p_row.local_resource_id,
    'localVersion', p_row.local_version,
    'externalId', p_row.external_id,
    'externalVersion', p_row.external_version,
    'syncOwner', p_row.sync_owner,
    'state', p_row.state,
    'lastErrorCode', p_row.last_error_code,
    'idempotencyKey', p_row.idempotency_key,
    'payloadFingerprint', p_row.payload_fingerprint,
    'syncedAt', p_row.synced_at,
    'version', p_row.version,
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at
  ) end;
$$;

create or replace function public.servicedesk_read_accounting_reconciliation_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_SNAPSHOT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'integrations', coalesce((
        select jsonb_agg(public.servicedesk_accounting_integration_json(ai) order by ai.provider)
        from public.accounting_integrations ai
        where ai.workspace_id = v_workspace
      ), '[]'::jsonb),
      'records', coalesce((
        select jsonb_agg(public.servicedesk_accounting_reconciliation_json(ar) order by ar.updated_at desc, ar.id)
        from public.accounting_reconciliation_records ar
        where ar.workspace_id = v_workspace
      ), '[]'::jsonb),
      'pendingCount', (
        select count(*) from public.accounting_reconciliation_records
        where workspace_id = v_workspace and state = 'PENDING'
      ),
      'conflictCount', (
        select count(*) from public.accounting_reconciliation_records
        where workspace_id = v_workspace and state = 'CONFLICT'
      ),
      'errorCount', (
        select count(*) from public.accounting_reconciliation_records
        where workspace_id = v_workspace and state = 'ERROR'
      )
    )
  );
end;
$$;

revoke all on function public.servicedesk_accounting_integration_json(public.accounting_integrations) from public;
revoke all on function public.servicedesk_accounting_reconciliation_json(public.accounting_reconciliation_records) from public;
revoke all on function public.servicedesk_read_accounting_reconciliation_snapshot(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_accounting_integration_json(public.accounting_integrations) to service_role;
grant execute on function public.servicedesk_accounting_reconciliation_json(public.accounting_reconciliation_records) to service_role;
grant execute on function public.servicedesk_read_accounting_reconciliation_snapshot(jsonb) to service_role;
