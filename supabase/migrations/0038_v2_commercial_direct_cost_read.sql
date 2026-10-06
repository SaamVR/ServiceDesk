-- ServiceDesk AI V2 Wave 2B.4A: commercial direct-cost read snapshot.

create or replace function public.servicedesk_read_commercial_direct_cost_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_from timestamptz := nullif(p_input->>'from','')::timestamptz;
  v_to timestamptz := nullif(p_input->>'to','')::timestamptz;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or (v_from is not null and v_to is not null and v_to < v_from) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_DIRECT_COST_SNAPSHOT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'entries', coalesce((
        select jsonb_agg(public.servicedesk_commercial_direct_cost_json(e) order by e.occurred_at desc, e.id)
        from (
          select *
          from public.commercial_direct_cost_entries
          where workspace_id = v_workspace
            and (v_from is null or occurred_at >= v_from)
            and (v_to is null or occurred_at <= v_to)
          order by occurred_at desc, id
          limit 500
        ) e
      ), '[]'::jsonb),
      'totals', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', currency,
          'category', category,
          'basis', basis,
          'netMinor', net_minor
        ) order by currency, category, basis)
        from (
          select
            currency,
            category,
            basis,
            sum(case when direction = 'COST' then amount_minor else -amount_minor end)::bigint as net_minor
          from public.commercial_direct_cost_entries
          where workspace_id = v_workspace
            and (v_from is null or occurred_at >= v_from)
            and (v_to is null or occurred_at <= v_to)
          group by currency, category, basis
        ) grouped
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.servicedesk_read_commercial_direct_cost_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_read_commercial_direct_cost_snapshot(jsonb) to service_role;
