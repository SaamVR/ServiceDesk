-- ServiceDesk AI V2 Wave 2C.3: request-photo retention and storage deletion recovery.
-- Retention is two-phase: first retire the asset and expire pending AI suggestions,
-- then delete private storage bytes, then tombstone the database reference.

create or replace function public.servicedesk_audit_request_photo_asset_state()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events(
      workspace_id, actor_role, action, resource_type, resource_id, after_data, created_at
    ) values (
      new.workspace_id,
      'SYSTEM',
      'REQUEST_PHOTO_ASSET_REGISTERED',
      'request_photo_asset',
      new.id,
      jsonb_build_object(
        'requestId', new.request_id,
        'source', new.source,
        'consentStatus', new.consent_status,
        'processingOptOut', new.processing_opt_out,
        'trainingAllowed', false,
        'retentionUntil', new.retention_until,
        'state', new.state,
        'version', new.version
      ),
      new.updated_at
    );
  elsif old.state is distinct from new.state
     or old.processing_opt_out is distinct from new.processing_opt_out
     or old.consent_status is distinct from new.consent_status
  then
    insert into public.audit_events(
      workspace_id, actor_role, action, resource_type, resource_id, before_data, after_data, created_at
    ) values (
      new.workspace_id,
      'SYSTEM',
      'REQUEST_PHOTO_ASSET_STATE_CHANGED',
      'request_photo_asset',
      new.id,
      jsonb_build_object(
        'consentStatus', old.consent_status,
        'processingOptOut', old.processing_opt_out,
        'state', old.state,
        'version', old.version
      ),
      jsonb_build_object(
        'requestId', new.request_id,
        'consentStatus', new.consent_status,
        'processingOptOut', new.processing_opt_out,
        'state', new.state,
        'version', new.version
      ),
      new.updated_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists request_photo_assets_audit_state on public.request_photo_assets;
create trigger request_photo_assets_audit_state
after insert or update on public.request_photo_assets
for each row execute function public.servicedesk_audit_request_photo_asset_state();

create or replace function public.servicedesk_claim_request_photo_for_deletion(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_asset_id uuid := nullif(p_input->>'photoAssetId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_asset public.request_photo_assets%rowtype;
begin
  if v_workspace is null or v_asset_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_RETENTION_INPUT_INVALID');
  end if;

  select * into v_asset
  from public.request_photo_assets
  where workspace_id = v_workspace and id = v_asset_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_ASSET_NOT_FOUND');
  end if;

  if v_asset.state = 'DELETED' then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'assetId', v_asset.id,
      'requestId', v_asset.request_id,
      'state', v_asset.state,
      'version', v_asset.version
    );
  end if;

  if v_asset.state = 'RETIRED' then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'assetId', v_asset.id,
      'requestId', v_asset.request_id,
      'storageRef', v_asset.storage_ref,
      'state', v_asset.state,
      'version', v_asset.version
    );
  end if;

  if v_asset.retention_until > v_now and not v_asset.processing_opt_out then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_RETENTION_NOT_DUE');
  end if;

  if v_asset.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;

  update public.request_photo_assets
  set processing_opt_out = true,
      state = 'RETIRED',
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_asset.id
  returning * into v_asset;

  update public.request_photo_suggestions
  set state = 'EXPIRED',
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace
    and photo_asset_id = v_asset.id
    and state = 'PENDING_REVIEW';

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'assetId', v_asset.id,
    'requestId', v_asset.request_id,
    'storageRef', v_asset.storage_ref,
    'state', v_asset.state,
    'version', v_asset.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'PHOTO_RETENTION_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_mark_request_photo_deleted(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_asset_id uuid := nullif(p_input->>'photoAssetId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_asset public.request_photo_assets%rowtype;
begin
  if v_workspace is null or v_asset_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_DELETE_INPUT_INVALID');
  end if;

  select * into v_asset
  from public.request_photo_assets
  where workspace_id = v_workspace and id = v_asset_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_ASSET_NOT_FOUND');
  end if;

  if v_asset.state = 'DELETED' then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'assetId', v_asset.id,
      'requestId', v_asset.request_id,
      'state', v_asset.state,
      'version', v_asset.version
    );
  end if;

  if v_asset.state <> 'RETIRED' then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_DELETE_NOT_RETIRED');
  end if;

  if v_asset.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;

  update public.request_photo_assets
  set storage_ref = 'deleted:' || id::text,
      state = 'DELETED',
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_asset.id
  returning * into v_asset;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'assetId', v_asset.id,
    'requestId', v_asset.request_id,
    'state', v_asset.state,
    'version', v_asset.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'PHOTO_DELETE_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_audit_request_photo_asset_state() from public, anon, authenticated;
revoke all on function public.servicedesk_claim_request_photo_for_deletion(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_mark_request_photo_deleted(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_claim_request_photo_for_deletion(jsonb) to service_role;
grant execute on function public.servicedesk_mark_request_photo_deleted(jsonb) to service_role;

comment on function public.servicedesk_claim_request_photo_for_deletion(jsonb) is
  'Retires an expired or opted-out request photo before storage deletion; returns opaque storageRef to service_role only for deletion recovery.';
comment on function public.servicedesk_mark_request_photo_deleted(jsonb) is
  'Tombstones a retired request photo only after the application confirms private storage deletion.';
