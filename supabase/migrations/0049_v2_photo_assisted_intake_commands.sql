-- ServiceDesk AI V2 Wave 2C.3: photo-assisted intake commands.
-- Image registration is consent-bound. Model suggestions are advisory and idempotent.
-- Human review never mutates request pricing or quote truth.

create or replace function public.servicedesk_register_request_photo_asset(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_visitor_session text := nullif(trim(p_input->>'actorVisitorSessionId'),'');
  v_request_id uuid := nullif(p_input->>'requestId','')::uuid;
  v_source text := p_input->>'source';
  v_storage_ref text := nullif(trim(p_input->>'storageRef'),'');
  v_content_type text := p_input->>'contentType';
  v_byte_size bigint := nullif(p_input->>'byteSize','')::bigint;
  v_consent_status text := p_input->>'consentStatus';
  v_consent_source text := nullif(trim(p_input->>'consentSource'),'');
  v_consent_at timestamptz := nullif(p_input->>'consentRecordedAt','')::timestamptz;
  v_retention_until timestamptz := nullif(p_input->>'retentionUntil','')::timestamptz;
  v_opt_out boolean := coalesce((p_input->>'processingOptOut')::boolean, false);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_request public.requests%rowtype;
  v_asset public.request_photo_assets%rowtype;
begin
  if v_workspace is null or v_request_id is null or v_actor_role is null
     or v_storage_ref is null or v_byte_size is null or v_consent_at is null
     or v_retention_until is null or v_consent_source is null
  then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_ASSET_INPUT_INVALID');
  end if;

  if coalesce((p_input->>'trainingAllowed')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_TRAINING_FORBIDDEN');
  end if;

  if v_consent_status <> 'GRANTED' then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_CONSENT_REQUIRED');
  end if;

  if v_retention_until <= v_now then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_RETENTION_INVALID');
  end if;

  select * into v_request
  from public.requests
  where workspace_id = v_workspace and id = v_request_id
  for share;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND');
  end if;

  if v_actor_role in ('OWNER','DISPATCHER') then
    if v_actor_user is null
       or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
  elsif v_actor_role = 'VISITOR' then
    if v_visitor_session is null
       or v_request.visitor_session_id is null
       or v_request.visitor_session_id <> v_visitor_session then
      return jsonb_build_object('ok', false, 'code', 'VISITOR_SCOPE_REQUIRED');
    end if;
  else
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_asset
  from public.request_photo_assets
  where workspace_id = v_workspace
    and request_id = v_request_id
    and storage_ref = v_storage_ref
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'assetId', v_asset.id,
      'requestId', v_asset.request_id,
      'state', v_asset.state,
      'version', v_asset.version
    );
  end if;

  begin
    insert into public.request_photo_assets(
      workspace_id, request_id, source, storage_ref, content_type, byte_size,
      consent_status, consent_source, consent_recorded_at, processing_opt_out,
      training_allowed, retention_until, state, created_at, updated_at
    ) values (
      v_workspace, v_request_id, v_source, v_storage_ref, v_content_type, v_byte_size,
      v_consent_status, v_consent_source, v_consent_at, v_opt_out,
      false, v_retention_until, 'AVAILABLE', v_now, v_now
    )
    returning * into v_asset;
  exception when unique_violation then
    select * into v_asset
    from public.request_photo_assets
    where workspace_id = v_workspace
      and request_id = v_request_id
      and storage_ref = v_storage_ref
    limit 1;
    if not found then raise; end if;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'assetId', v_asset.id,
      'requestId', v_asset.request_id,
      'state', v_asset.state,
      'version', v_asset.version
    );
  end;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'assetId', v_asset.id,
    'requestId', v_asset.request_id,
    'state', v_asset.state,
    'version', v_asset.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'PHOTO_ASSET_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_record_request_photo_suggestion(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_request_id uuid := nullif(p_input->>'requestId','')::uuid;
  v_asset_id uuid := nullif(p_input->>'photoAssetId','')::uuid;
  v_classifier_ref text := nullif(trim(p_input->>'classifierRef'),'');
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'),'');
  v_category text := nullif(trim(p_input->>'categoryCode'),'');
  v_addon text := nullif(trim(p_input->>'proposedAddOnCode'),'');
  v_confidence integer := nullif(p_input->>'confidenceBasisPoints','')::integer;
  v_rationale text := nullif(trim(p_input->>'rationale'),'');
  v_questions jsonb := coalesce(p_input->'followUpQuestions', '[]'::jsonb);
  v_generated_at timestamptz := nullif(p_input->>'generatedAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_asset public.request_photo_assets%rowtype;
  v_suggestion public.request_photo_suggestions%rowtype;
begin
  if v_workspace is null or v_request_id is null or v_asset_id is null
     or v_classifier_ref is null or v_idempotency is null or v_category is null
     or v_confidence is null or v_generated_at is null
  then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_SUGGESTION_INPUT_INVALID');
  end if;

  if jsonb_typeof(v_questions) <> 'array'
     or jsonb_array_length(v_questions) > 5
     or exists (
       select 1 from jsonb_array_elements(v_questions) q
       where jsonb_typeof(q) <> 'string' or length(trim(q #>> '{}')) > 200
     )
  then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_FOLLOWUP_INVALID');
  end if;

  select * into v_suggestion
  from public.request_photo_suggestions
  where workspace_id = v_workspace and idempotency_key = v_idempotency
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'suggestionId', v_suggestion.id,
      'requestId', v_suggestion.request_id,
      'state', v_suggestion.state,
      'version', v_suggestion.version
    );
  end if;

  select * into v_asset
  from public.request_photo_assets
  where workspace_id = v_workspace and id = v_asset_id
  for share;

  if not found or v_asset.request_id <> v_request_id then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_ASSET_NOT_FOUND');
  end if;

  if v_asset.state <> 'AVAILABLE'
     or v_asset.consent_status <> 'GRANTED'
     or v_asset.processing_opt_out
     or v_asset.retention_until <= v_now
  then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_PROCESSING_NOT_ALLOWED');
  end if;

  begin
    insert into public.request_photo_suggestions(
      workspace_id, request_id, photo_asset_id, classifier_ref, idempotency_key,
      category_code, proposed_addon_code, confidence_basis_points, rationale,
      follow_up_questions, state, version, generated_at, created_at, updated_at
    ) values (
      v_workspace, v_request_id, v_asset_id, v_classifier_ref, v_idempotency,
      v_category, v_addon, v_confidence, v_rationale,
      v_questions, 'PENDING_REVIEW', 1, v_generated_at, v_now, v_now
    )
    returning * into v_suggestion;
  exception when unique_violation then
    select * into v_suggestion
    from public.request_photo_suggestions
    where workspace_id = v_workspace and idempotency_key = v_idempotency
    limit 1;
    if not found then raise; end if;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'suggestionId', v_suggestion.id,
      'requestId', v_suggestion.request_id,
      'state', v_suggestion.state,
      'version', v_suggestion.version
    );
  end;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'suggestionId', v_suggestion.id,
    'requestId', v_suggestion.request_id,
    'state', v_suggestion.state,
    'version', v_suggestion.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'PHOTO_SUGGESTION_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_review_request_photo_suggestion(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_suggestion_id uuid := nullif(p_input->>'suggestionId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_decision text := p_input->>'decision';
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_suggestion public.request_photo_suggestions%rowtype;
  v_asset public.request_photo_assets%rowtype;
  v_accepted_quote_id uuid;
  v_quote_revision_required boolean := false;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_suggestion_id is null or v_expected is null
     or v_decision not in ('ACCEPTED','REJECTED')
  then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_REVIEW_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_suggestion
  from public.request_photo_suggestions
  where workspace_id = v_workspace and id = v_suggestion_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_SUGGESTION_NOT_FOUND');
  end if;

  if v_suggestion.state = v_decision then
    select q.id into v_accepted_quote_id
    from public.quotes q
    where q.workspace_id = v_workspace
      and q.request_id = v_suggestion.request_id
      and q.status = 'ACCEPTED'
    order by q.accepted_at desc nulls last, q.version desc
    limit 1;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'suggestionId', v_suggestion.id,
      'requestId', v_suggestion.request_id,
      'state', v_suggestion.state,
      'version', v_suggestion.version,
      'quoteRevisionRequired', v_suggestion.state = 'ACCEPTED' and v_accepted_quote_id is not null,
      'acceptedQuoteId', v_accepted_quote_id
    );
  end if;

  if v_suggestion.state <> 'PENDING_REVIEW' then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_REVIEW_STATE_INVALID');
  end if;

  if v_suggestion.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;

  select * into v_asset
  from public.request_photo_assets
  where workspace_id = v_workspace and id = v_suggestion.photo_asset_id
  for share;

  if v_decision = 'ACCEPTED' and (
    not found
    or v_asset.state <> 'AVAILABLE'
    or v_asset.consent_status <> 'GRANTED'
    or v_asset.processing_opt_out
    or v_asset.retention_until <= v_now
  ) then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_PROCESSING_NOT_ALLOWED');
  end if;

  select q.id into v_accepted_quote_id
  from public.quotes q
  where q.workspace_id = v_workspace
    and q.request_id = v_suggestion.request_id
    and q.status = 'ACCEPTED'
  order by q.accepted_at desc nulls last, q.version desc
  limit 1;

  v_quote_revision_required := v_decision = 'ACCEPTED' and v_accepted_quote_id is not null;

  update public.request_photo_suggestions
  set state = v_decision,
      reviewed_by = v_actor_user,
      reviewed_at = v_now,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_suggestion.id
  returning * into v_suggestion;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role,
    'REQUEST_PHOTO_SUGGESTION_' || v_decision,
    'request_photo_suggestion', v_suggestion.id,
    jsonb_build_object(
      'requestId', v_suggestion.request_id,
      'photoAssetId', v_suggestion.photo_asset_id,
      'state', v_suggestion.state,
      'confidenceBasisPoints', v_suggestion.confidence_basis_points,
      'quoteRevisionRequired', v_quote_revision_required
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'suggestionId', v_suggestion.id,
    'requestId', v_suggestion.request_id,
    'state', v_suggestion.state,
    'version', v_suggestion.version,
    'quoteRevisionRequired', v_quote_revision_required,
    'acceptedQuoteId', v_accepted_quote_id
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'PHOTO_REVIEW_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_opt_out_request_photo_processing(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_visitor_session text := nullif(trim(p_input->>'actorVisitorSessionId'),'');
  v_asset_id uuid := nullif(p_input->>'photoAssetId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_asset public.request_photo_assets%rowtype;
  v_request public.requests%rowtype;
begin
  if v_workspace is null or v_actor_role is null or v_asset_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_OPT_OUT_INPUT_INVALID');
  end if;

  select * into v_asset
  from public.request_photo_assets
  where workspace_id = v_workspace and id = v_asset_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PHOTO_ASSET_NOT_FOUND');
  end if;

  select * into v_request
  from public.requests
  where workspace_id = v_workspace and id = v_asset.request_id
  for share;

  if v_actor_role in ('OWNER','DISPATCHER') then
    if v_actor_user is null
       or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
  elsif v_actor_role = 'VISITOR' then
    if v_visitor_session is null
       or v_request.visitor_session_id is null
       or v_request.visitor_session_id <> v_visitor_session then
      return jsonb_build_object('ok', false, 'code', 'VISITOR_SCOPE_REQUIRED');
    end if;
  else
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_asset.processing_opt_out and v_asset.state = 'RETIRED' then
    return jsonb_build_object(
      'ok', true, 'duplicate', true, 'assetId', v_asset.id,
      'requestId', v_asset.request_id, 'state', v_asset.state, 'version', v_asset.version
    );
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
    'ok', true, 'duplicate', false, 'assetId', v_asset.id,
    'requestId', v_asset.request_id, 'state', v_asset.state, 'version', v_asset.version
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'PHOTO_OPT_OUT_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_register_request_photo_asset(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_record_request_photo_suggestion(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_review_request_photo_suggestion(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_opt_out_request_photo_processing(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_register_request_photo_asset(jsonb) to service_role;
grant execute on function public.servicedesk_record_request_photo_suggestion(jsonb) to service_role;
grant execute on function public.servicedesk_review_request_photo_suggestion(jsonb) to service_role;
grant execute on function public.servicedesk_opt_out_request_photo_processing(jsonb) to service_role;

comment on function public.servicedesk_review_request_photo_suggestion(jsonb) is
  'Records human review only. Never modifies request pricing, quote snapshots, invoices or payments; accepted quotes require a separate explicit revision workflow.';
