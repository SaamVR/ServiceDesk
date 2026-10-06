-- ServiceDesk AI V2 Wave 2B.3B: dry-run accounting backfill planner.
-- This function performs no writes and sends no provider requests.

create or replace function public.servicedesk_plan_accounting_backfill(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_provider text := lower(trim(p_input->>'provider'));
  v_limit integer := greatest(1, least(coalesce(nullif(p_input->>'limit','')::integer, 100), 500));
  v_integration public.accounting_integrations%rowtype;
  v_candidates jsonb;
  v_candidate_count bigint;
  v_blocked_count bigint;
  v_pending_count bigint;
  v_current_count bigint;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or v_provider !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_BACKFILL_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_integration
  from public.accounting_integrations
  where workspace_id = v_workspace and provider = v_provider;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_INTEGRATION_NOT_FOUND');
  end if;
  if v_integration.status <> 'READY' then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNTING_INTEGRATION_NOT_READY');
  end if;

  with local_rows as (
    select
      'CONTACT'::text as entity_type,
      'COMMERCIAL_ORGANIZATION'::text as local_resource_kind,
      co.id as local_resource_id,
      co.version::bigint as local_version,
      co.updated_at as sort_time
    from public.commercial_organizations co
    where co.workspace_id = v_workspace and co.status = 'ACTIVE'

    union all

    select
      'INVOICE',
      'INVOICE',
      i.id,
      i.version::bigint,
      i.updated_at
    from public.invoices i
    where i.workspace_id = v_workspace
      and i.status in ('ISSUED','PARTIALLY_PAID','PAID')

    union all

    select
      'PAYMENT',
      'VERIFIED_PAYMENT',
      p.id,
      1::bigint,
      p.created_at
    from public.verified_payment_applications p
    where p.workspace_id = v_workspace
      and p.state = 'APPLIED'
      and p.invoice_id is not null

    union all

    select
      'PAYMENT',
      'MANUAL_PAYMENT',
      p.id,
      1::bigint,
      p.created_at
    from public.manual_payment_records p
    where p.workspace_id = v_workspace

    union all

    select
      'CREDIT',
      'COMMERCIAL_BILLING_LINE',
      l.id,
      1::bigint,
      l.updated_at
    from public.commercial_billing_lines l
    join public.commercial_billing_drafts d
      on d.workspace_id = l.workspace_id and d.id = l.draft_id
    where l.workspace_id = v_workspace
      and l.source_type = 'ADJUSTMENT'
      and l.direction = 'CREDIT'
      and l.state = 'INCLUDED'
      and d.state = 'FINALIZED'
  ),
  joined as (
    select
      lr.*,
      ar.id as reconciliation_id,
      ar.local_version as reconciled_local_version,
      ar.state as reconciliation_state
    from local_rows lr
    left join public.accounting_reconciliation_records ar
      on ar.workspace_id = v_workspace
     and ar.integration_id = v_integration.id
     and ar.entity_type = lr.entity_type
     and ar.local_resource_kind = lr.local_resource_kind
     and ar.local_resource_id = lr.local_resource_id
  ),
  candidate_rows as (
    select
      entity_type,
      local_resource_kind,
      local_resource_id,
      local_version,
      case
        when reconciliation_id is null then 'UNTRACKED'
        else 'LOCAL_VERSION_ADVANCED'
      end as reason,
      sort_time
    from joined
    where reconciliation_id is null
       or (
         reconciliation_state = 'SYNCED'
         and reconciled_local_version < local_version
       )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'entityType', entity_type,
      'localResourceKind', local_resource_kind,
      'localResourceId', local_resource_id,
      'localVersion', local_version,
      'reason', reason
    ) order by sort_time, local_resource_id) filter (where rn <= v_limit), '[]'::jsonb),
    count(*)
  into v_candidates, v_candidate_count
  from (
    select candidate_rows.*, row_number() over (order by sort_time, local_resource_id) as rn
    from candidate_rows
  ) ranked;

  with local_rows as (
    select 'CONTACT'::text entity_type, 'COMMERCIAL_ORGANIZATION'::text local_resource_kind, id local_resource_id, version::bigint local_version
      from public.commercial_organizations where workspace_id = v_workspace and status = 'ACTIVE'
    union all
    select 'INVOICE','INVOICE',id,version::bigint from public.invoices
      where workspace_id = v_workspace and status in ('ISSUED','PARTIALLY_PAID','PAID')
    union all
    select 'PAYMENT','VERIFIED_PAYMENT',id,1::bigint from public.verified_payment_applications
      where workspace_id = v_workspace and state = 'APPLIED' and invoice_id is not null
    union all
    select 'PAYMENT','MANUAL_PAYMENT',id,1::bigint from public.manual_payment_records
      where workspace_id = v_workspace
    union all
    select 'CREDIT','COMMERCIAL_BILLING_LINE',l.id,1::bigint
      from public.commercial_billing_lines l
      join public.commercial_billing_drafts d on d.workspace_id = l.workspace_id and d.id = l.draft_id
      where l.workspace_id = v_workspace and l.source_type = 'ADJUSTMENT' and l.direction = 'CREDIT'
        and l.state = 'INCLUDED' and d.state = 'FINALIZED'
  ),
  joined as (
    select lr.*, ar.state reconciliation_state, ar.local_version reconciled_local_version
    from local_rows lr
    left join public.accounting_reconciliation_records ar
      on ar.workspace_id = v_workspace
     and ar.integration_id = v_integration.id
     and ar.entity_type = lr.entity_type
     and ar.local_resource_kind = lr.local_resource_kind
     and ar.local_resource_id = lr.local_resource_id
  )
  select
    count(*) filter (where reconciliation_state in ('CONFLICT','ERROR')),
    count(*) filter (where reconciliation_state = 'PENDING'),
    count(*) filter (where reconciliation_state = 'SYNCED' and reconciled_local_version = local_version)
  into v_blocked_count, v_pending_count, v_current_count
  from joined;

  return jsonb_build_object(
    'ok', true,
    'plan', jsonb_build_object(
      'workspaceId', v_workspace,
      'provider', v_provider,
      'dryRun', true,
      'candidateCount', coalesce(v_candidate_count, 0),
      'blockedCount', coalesce(v_blocked_count, 0),
      'pendingCount', coalesce(v_pending_count, 0),
      'currentCount', coalesce(v_current_count, 0),
      'candidates', coalesce(v_candidates, '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.servicedesk_plan_accounting_backfill(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_plan_accounting_backfill(jsonb) to service_role;
