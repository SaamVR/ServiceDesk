-- ServiceDesk AI V2 Wave 2B.4C: owner-only tax profile lifecycle.
-- Review records configuration provenance; it does not certify legal/tax correctness or auto-apply tax.

create or replace function public.servicedesk_upsert_tax_profile(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_profile_id uuid := nullif(p_input->>'profileId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_jurisdiction text := upper(trim(p_input->>'jurisdictionCode'));
  v_tax_code text := upper(trim(p_input->>'taxCode'));
  v_rate integer := nullif(p_input->>'rateBasisPoints','')::integer;
  v_price_includes boolean := case lower(coalesce(p_input->>'priceIncludesTax',''))
    when 'true' then true
    when 'false' then false
    else null
  end;
  v_provenance text := p_input->>'provenanceKind';
  v_reference text := nullif(trim(p_input->>'provenanceReference'),'');
  v_effective_from date := nullif(p_input->>'effectiveFrom','')::date;
  v_effective_to date := nullif(p_input->>'effectiveTo','')::date;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_existing public.workspace_tax_profiles%rowtype;
  v_row public.workspace_tax_profiles%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or length(v_jurisdiction) not between 2 and 80
     or length(v_tax_code) not between 1 and 80
     or v_rate is null or v_rate not between 0 and 10000
     or v_price_includes is null
     or v_provenance not in ('ACCOUNTANT_GUIDANCE','TAX_AUTHORITY','ACCOUNTING_SYSTEM','OTHER')
     or v_reference is null or length(v_reference) not between 3 and 240
     or v_effective_from is null
     or (v_effective_to is not null and v_effective_to < v_effective_from)
     or (v_profile_id is not null and (v_expected is null or v_expected <= 0)) then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_INPUT_INVALID');
  end if;

  if v_actor_role <> 'OWNER'
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_profile_id is null then
    insert into public.workspace_tax_profiles(
      workspace_id, jurisdiction_code, tax_code, rate_basis_points, price_includes_tax,
      status, provenance_kind, provenance_reference, effective_from, effective_to,
      version, created_by_user_id, created_at, updated_at
    ) values (
      v_workspace, v_jurisdiction, v_tax_code, v_rate, v_price_includes,
      'DRAFT', v_provenance, v_reference, v_effective_from, v_effective_to,
      1, v_actor_user, v_now, v_now
    )
    returning * into v_row;
  else
    select * into v_existing
    from public.workspace_tax_profiles
    where workspace_id = v_workspace and id = v_profile_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_NOT_FOUND');
    end if;
    if v_existing.status <> 'DRAFT' then
      return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_LOCKED');
    end if;
    if v_existing.version <> v_expected then
      return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_VERSION_CONFLICT');
    end if;

    update public.workspace_tax_profiles
    set jurisdiction_code = v_jurisdiction,
        tax_code = v_tax_code,
        rate_basis_points = v_rate,
        price_includes_tax = v_price_includes,
        provenance_kind = v_provenance,
        provenance_reference = v_reference,
        effective_from = v_effective_from,
        effective_to = v_effective_to,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace and id = v_profile_id
    returning * into v_row;
  end if;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'TAX_PROFILE_DRAFT_SAVED', 'workspace_tax_profile', v_row.id,
    jsonb_build_object(
      'jurisdictionCode', v_row.jurisdiction_code,
      'taxCode', v_row.tax_code,
      'rateBasisPoints', v_row.rate_basis_points,
      'priceIncludesTax', v_row.price_includes_tax,
      'provenanceKind', v_row.provenance_kind,
      'effectiveFrom', v_row.effective_from,
      'effectiveTo', v_row.effective_to,
      'version', v_row.version
    ),
    v_now
  );

  return jsonb_build_object('ok', true, 'profile', public.servicedesk_tax_profile_json(v_row));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_IDENTITY_CONFLICT');
end;
$$;

create or replace function public.servicedesk_review_tax_profile(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_profile_id uuid := nullif(p_input->>'profileId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_confirmed boolean := case lower(coalesce(p_input->>'accountantReviewConfirmed',''))
    when 'true' then true
    else false
  end;
  v_attestation text := nullif(trim(p_input->>'reviewAttestation'),'');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.workspace_tax_profiles%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_profile_id is null or v_expected is null or v_expected <= 0
     or not v_confirmed
     or v_attestation is null or length(v_attestation) not between 3 and 240 then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_REVIEW_INPUT_INVALID');
  end if;

  if v_actor_role <> 'OWNER'
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_row
  from public.workspace_tax_profiles
  where workspace_id = v_workspace and id = v_profile_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_NOT_FOUND');
  end if;
  if v_row.status <> 'DRAFT' then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_REVIEW_STATE_INVALID');
  end if;
  if v_row.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_VERSION_CONFLICT');
  end if;

  update public.workspace_tax_profiles
  set status = 'REVIEWED',
      reviewed_by_user_id = v_actor_user,
      reviewed_at = v_now,
      review_attestation = v_attestation,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_profile_id
  returning * into v_row;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'TAX_PROFILE_REVIEW_RECORDED', 'workspace_tax_profile', v_row.id,
    jsonb_build_object(
      'jurisdictionCode', v_row.jurisdiction_code,
      'taxCode', v_row.tax_code,
      'rateBasisPoints', v_row.rate_basis_points,
      'provenanceKind', v_row.provenance_kind,
      'effectiveFrom', v_row.effective_from,
      'effectiveTo', v_row.effective_to,
      'version', v_row.version
    ),
    v_now
  );

  return jsonb_build_object('ok', true, 'profile', public.servicedesk_tax_profile_json(v_row));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_REVIEW_CONFLICT');
end;
$$;

create or replace function public.servicedesk_retire_tax_profile(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_profile_id uuid := nullif(p_input->>'profileId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.workspace_tax_profiles%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_profile_id is null or v_expected is null or v_expected <= 0 then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_RETIRE_INPUT_INVALID');
  end if;

  if v_actor_role <> 'OWNER'
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_row
  from public.workspace_tax_profiles
  where workspace_id = v_workspace and id = v_profile_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_NOT_FOUND');
  end if;
  if v_row.status = 'RETIRED' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'profile', public.servicedesk_tax_profile_json(v_row));
  end if;
  if v_row.version <> v_expected then
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_VERSION_CONFLICT');
  end if;

  update public.workspace_tax_profiles
  set status = 'RETIRED',
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace and id = v_profile_id
  returning * into v_row;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data, created_at
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'TAX_PROFILE_RETIRED', 'workspace_tax_profile', v_row.id,
    jsonb_build_object(
      'jurisdictionCode', v_row.jurisdiction_code,
      'taxCode', v_row.tax_code,
      'previousStatus', 'ACTIVE_OR_DRAFT',
      'version', v_row.version
    ),
    v_now
  );

  return jsonb_build_object('ok', true, 'duplicate', false, 'profile', public.servicedesk_tax_profile_json(v_row));
end;
$$;

revoke all on function public.servicedesk_upsert_tax_profile(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_review_tax_profile(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_retire_tax_profile(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_upsert_tax_profile(jsonb) to service_role;
grant execute on function public.servicedesk_review_tax_profile(jsonb) to service_role;
grant execute on function public.servicedesk_retire_tax_profile(jsonb) to service_role;
