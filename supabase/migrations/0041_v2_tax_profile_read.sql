-- ServiceDesk AI V2 Wave 2B.4C: governed tax profile read boundary.

create or replace function public.servicedesk_tax_profile_json(p_row public.workspace_tax_profiles)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_row.id is null then null else jsonb_build_object(
    'id', p_row.id,
    'workspaceId', p_row.workspace_id,
    'jurisdictionCode', p_row.jurisdiction_code,
    'taxCode', p_row.tax_code,
    'rateBasisPoints', p_row.rate_basis_points,
    'priceIncludesTax', p_row.price_includes_tax,
    'status', p_row.status,
    'provenanceKind', p_row.provenance_kind,
    'provenanceReference', p_row.provenance_reference,
    'effectiveFrom', p_row.effective_from,
    'effectiveTo', p_row.effective_to,
    'reviewedByUserId', p_row.reviewed_by_user_id,
    'reviewedAt', p_row.reviewed_at,
    'version', p_row.version,
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at
  ) end;
$$;

create or replace function public.servicedesk_read_tax_profile_snapshot(p_input jsonb)
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
    return jsonb_build_object('ok', false, 'code', 'TAX_PROFILE_SNAPSHOT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'automaticApplicationEnabled', false,
      'profiles', coalesce((
        select jsonb_agg(public.servicedesk_tax_profile_json(tp) order by
          case tp.status when 'REVIEWED' then 0 when 'DRAFT' then 1 else 2 end,
          tp.effective_from desc,
          tp.updated_at desc
        )
        from public.workspace_tax_profiles tp
        where tp.workspace_id = v_workspace
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.servicedesk_tax_profile_json(public.workspace_tax_profiles) from public;
revoke all on function public.servicedesk_read_tax_profile_snapshot(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_tax_profile_json(public.workspace_tax_profiles) to service_role;
grant execute on function public.servicedesk_read_tax_profile_snapshot(jsonb) to service_role;
