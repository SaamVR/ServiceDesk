-- ServiceDesk AI V2 Wave 2B.3A: accounting reconciliation result authority.
-- Provider adapters may record only normalized IDs, versions, fingerprints and code-only errors here.

create or replace function public.servicedesk_record_accounting_reconciliation(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_provider text := lower(trim(p_input->>'provider'));
  v_entity text := p_input->>'entityType';
  v_kind text := p_input->>'localResourceKind';
  v_resource uuid := nullif(p_input->>'localResourceId','')::uuid;
  v_local_version bigint := nullif(p_input->>'localVersion','')::bigint;
  v_external_id text := nullif(trim(p_input->>'externalId'),'');
  v_external_version text := nullif(p_input->>'externalVersion','');
  v_owner text := p_input->>'syncOwner';
  v_state text := p_input->>'state';
  v_error text := nullif(trim(p_input->>'lastErrorCode'),'');
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'),'');
  v_fingerprint text := nullif(trim(p_input->>'payloadFingerprint'),'');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_current_version bigint;
  v_integration public.accounting_integrations%rowtype;
  v_existing public.accounting_reconciliation_records%rowtype;
  v_row public.accounting_reconciliation_records%rowtype;
  v_conflict_code text;
begin
  if v_workspace is null
     or v_provider !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
     or v_entity not in ('CONTACT','INVOICE','PAYMENT','CREDIT')
     or v_kind not in ('COMMERCIAL_ORGANIZATION','INVOICE','VERIFIED_PAYMENT','MANUAL_PAYMENT','COMMERCIAL_BILLING_LINE')
     or v_resource is null
     or v_local_version is null or v_local_version <= 0
     or v_owner not in ('SERVICEDESK','EXTERNAL')
     or v_state not in ('PENDING','SYNCED','CONFLICT','ERROR')
     or v_idempotency is null or length(v_idempotency) not between 8 and 160
     or v_fingerprint is null or length(v_fingerprint) not between 8 and 160
     or (v_state in ('CONFLICT','ERROR') and v_error is null)
     or (v_error is not null and length(v_error) > 120)
     or (v_state = 'SYNCED' and v_external_id is null) then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_RECONCILIATION_INPUT_INVALID');
  end if;

  if not (
    (v_entity = 'CONTACT' and v_kind = 'COMMERCIAL_ORGANIZATION')
    or (v_entity = 'INVOICE' and v_kind = 'INVOICE')
    or (v_entity = 'PAYMENT' and v_kind in ('VERIFIED_PAYMENT','MANUAL_PAYMENT'))
    or (v_entity = 'CREDIT' and v_kind = 'COMMERCIAL_BILLING_LINE')
  ) then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_RECONCILIATION_SOURCE_MISMATCH');
  end if;

  select * into v_integration
  from public.accounting_integrations
  where workspace_id = v_workspace and provider = v_provider
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_INTEGRATION_NOT_FOUND');
  end if;

  if v_integration.status <> 'READY' and v_state in ('PENDING','SYNCED') then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_INTEGRATION_NOT_READY');
  end if;

  v_current_version := public.servicedesk_accounting_local_version(v_workspace, v_kind, v_resource);
  if v_current_version is null then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_LOCAL_RESOURCE_NOT_ELIGIBLE');
  end if;
  if v_local_version < v_current_version then
    return jsonb_build_object(
      'ok', false, 'code', 'ACCOUNTING_LOCAL_VERSION_STALE',
      'currentLocalVersion', v_current_version
    );
  end if;
  if v_local_version > v_current_version then
    return jsonb_build_object(
      'ok', false, 'code', 'ACCOUNTING_LOCAL_VERSION_AHEAD',
      'currentLocalVersion', v_current_version
    );
  end if;

  select * into v_existing
  from public.accounting_reconciliation_records
  where workspace_id = v_workspace
    and integration_id = v_integration.id
    and entity_type = v_entity
    and local_resource_kind = v_kind
    and local_resource_id = v_resource
  for update;

  if found and v_existing.idempotency_key = v_idempotency then
    if v_existing.payload_fingerprint = v_fingerprint then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'record', public.servicedesk_accounting_reconciliation_json(v_existing)
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_IDEMPOTENCY_CONFLICT');
  end if;

  if found
     and v_existing.external_id is not null
     and v_external_id is not null
     and v_existing.external_id <> v_external_id then
    v_conflict_code := 'EXTERNAL_ID_MISMATCH';
  elsif found
     and v_existing.state = 'SYNCED'
     and v_existing.sync_owner = 'SERVICEDESK'
     and v_existing.local_version = v_local_version
     and v_existing.external_version is not null
     and v_external_version is not null
     and v_existing.external_version <> v_external_version then
    v_conflict_code := 'EXTERNAL_VERSION_CHANGED';
  end if;

  if v_conflict_code is not null then
    update public.accounting_reconciliation_records
    set state = 'CONFLICT',
        last_error_code = v_conflict_code,
        idempotency_key = v_idempotency,
        payload_fingerprint = v_fingerprint,
        version = version + 1,
        updated_at = v_now
    where id = v_existing.id
    returning * into v_row;
  elsif found then
    update public.accounting_reconciliation_records
    set local_resource_kind = v_kind,
        local_version = v_local_version,
        external_id = coalesce(v_external_id, external_id),
        external_version = coalesce(v_external_version, external_version),
        sync_owner = v_owner,
        state = v_state,
        last_error_code = case when v_state in ('CONFLICT','ERROR') then v_error else null end,
        idempotency_key = v_idempotency,
        payload_fingerprint = v_fingerprint,
        synced_at = case when v_state = 'SYNCED' then v_now else synced_at end,
        version = version + 1,
        updated_at = v_now
    where id = v_existing.id
    returning * into v_row;
  else
    insert into public.accounting_reconciliation_records(
      workspace_id, integration_id, entity_type, local_resource_kind, local_resource_id,
      local_version, external_id, external_version, sync_owner, state, last_error_code,
      idempotency_key, payload_fingerprint, synced_at, version, created_at, updated_at
    ) values (
      v_workspace, v_integration.id, v_entity, v_kind, v_resource,
      v_local_version, v_external_id, v_external_version, v_owner, v_state,
      case when v_state in ('CONFLICT','ERROR') then v_error else null end,
      v_idempotency, v_fingerprint,
      case when v_state = 'SYNCED' then v_now else null end,
      1, v_now, v_now
    )
    returning * into v_row;
  end if;

  if v_row.state in ('CONFLICT','ERROR') then
    insert into public.attention_items(
      workspace_id, type, resource_type, resource_id, severity, status, summary, created_at, updated_at
    ) values (
      v_workspace, 'ACCOUNTING_RECONCILIATION', 'accounting_reconciliation', v_row.id,
      'WARNING', 'OPEN', 'Accounting reconciliation requires review.', v_now, v_now
    )
    on conflict (workspace_id, type, resource_type, resource_id) where status = 'OPEN'
    do update set severity = excluded.severity, summary = excluded.summary, updated_at = excluded.updated_at;
  elsif v_row.state = 'SYNCED' then
    update public.attention_items
    set status = 'RESOLVED', updated_at = v_now
    where workspace_id = v_workspace
      and type = 'ACCOUNTING_RECONCILIATION'
      and resource_type = 'accounting_reconciliation'
      and resource_id = v_row.id
      and status = 'OPEN';

    update public.accounting_integrations
    set last_success_at = v_now, last_error_code = null, updated_at = v_now
    where workspace_id = v_workspace and id = v_integration.id;
  end if;

  insert into public.audit_events(
    workspace_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, 'SYSTEM', 'ACCOUNTING_RECONCILIATION_RECORDED',
    'accounting_reconciliation', v_row.id,
    jsonb_build_object(
      'provider', v_provider,
      'entityType', v_entity,
      'localResourceKind', v_kind,
      'localVersion', v_local_version,
      'syncOwner', v_owner,
      'state', v_row.state,
      'errorCode', v_row.last_error_code,
      'recordVersion', v_row.version
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'record', public.servicedesk_accounting_reconciliation_json(v_row)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_RECONCILIATION_IDENTITY_CONFLICT');
end;
$$;

revoke all on function public.servicedesk_record_accounting_reconciliation(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_record_accounting_reconciliation(jsonb) to service_role;
