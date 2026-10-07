-- ServiceDesk AI V2 Wave 2D.1: branch-scoped reporting and owner comparison.
-- Monetary values stay in each branch's recorded currency. Mixed-currency company totals are
-- intentionally withheld unless a separate verified FX policy is introduced.

create or replace function public.servicedesk_branch_reporting_row(
  p_workspace uuid,
  p_branch uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_branch public.workspace_branches%rowtype;
  v_request_count bigint;
  v_booked_count bigint;
  v_collected bigint;
  v_outstanding bigint;
  v_service_minutes bigint;
  v_buffer_minutes bigint;
  v_quality bigint;
begin
  select * into v_branch
  from public.workspace_branches
  where workspace_id = p_workspace and id = p_branch;

  if not found then
    return null;
  end if;

  select count(*) into v_request_count
  from public.requests r
  where r.workspace_id = p_workspace
    and r.branch_id = p_branch
    and (p_from is null or r.created_at >= p_from)
    and (p_to is null or r.created_at < p_to);

  select count(*) into v_booked_count
  from public.requests r
  where r.workspace_id = p_workspace
    and r.branch_id = p_branch
    and r.status = 'BOOKED'
    and (p_from is null or r.created_at >= p_from)
    and (p_to is null or r.created_at < p_to);

  select coalesce(sum(le.amount_minor), 0) into v_collected
  from public.ledger_entries le
  join public.invoices i
    on i.workspace_id = le.workspace_id
   and i.id = le.resource_id
   and le.resource_type = 'invoice'
  join public.quotes q
    on q.workspace_id = i.workspace_id and q.id = i.quote_id
  join public.requests r
    on r.workspace_id = q.workspace_id and r.id = q.request_id
  where le.workspace_id = p_workspace
    and r.branch_id = p_branch
    and le.direction = 'CREDIT'
    and (p_from is null or le.occurred_at >= p_from)
    and (p_to is null or le.occurred_at < p_to);

  select coalesce(sum(i.balance_minor), 0) into v_outstanding
  from public.invoices i
  join public.quotes q
    on q.workspace_id = i.workspace_id and q.id = i.quote_id
  join public.requests r
    on r.workspace_id = q.workspace_id and r.id = q.request_id
  where i.workspace_id = p_workspace
    and r.branch_id = p_branch
    and i.status <> 'VOID';

  select
    coalesce(sum(coalesce(
      q.duration_minutes,
      greatest(0, floor(extract(epoch from (v.ends_at - v.starts_at)) / 60)::int)
    )), 0),
    coalesce(sum(coalesce(q.buffer_minutes, 0)), 0)
  into v_service_minutes, v_buffer_minutes
  from public.visits v
  left join public.quotes q
    on q.workspace_id = v.workspace_id and q.id = v.quote_id
  where v.workspace_id = p_workspace
    and v.branch_id = p_branch
    and v.status in ('SCHEDULED','ASSIGNED','EN_ROUTE','IN_PROGRESS','NEEDS_REVIEW','COMPLETED')
    and (p_from is null or v.starts_at >= p_from)
    and (p_to is null or v.starts_at < p_to);

  select count(*) into v_quality
  from public.quality_cases qc
  join public.visits v
    on v.workspace_id = qc.workspace_id and v.id = qc.visit_id
  where qc.workspace_id = p_workspace
    and v.branch_id = p_branch
    and qc.state <> 'RESOLVED';

  return jsonb_build_object(
    'branchId', v_branch.id,
    'code', v_branch.code,
    'name', v_branch.name,
    'timezone', v_branch.timezone,
    'currency', v_branch.currency,
    'active', v_branch.active,
    'from', p_from,
    'to', p_to,
    'localFrom', case when p_from is null then null else p_from at time zone v_branch.timezone end,
    'localTo', case when p_to is null then null else p_to at time zone v_branch.timezone end,
    'requestCount', coalesce(v_request_count, 0),
    'bookedRequestCount', coalesce(v_booked_count, 0),
    'conversionRateBps', case
      when coalesce(v_request_count, 0) = 0 then null
      else floor((v_booked_count::numeric / v_request_count::numeric) * 10000)::int
    end,
    'collectedMinor', coalesce(v_collected, 0),
    'outstandingMinor', coalesce(v_outstanding, 0),
    'scheduledServiceMinutes', coalesce(v_service_minutes, 0),
    'scheduledBufferMinutes', coalesce(v_buffer_minutes, 0),
    'unresolvedQualityCount', coalesce(v_quality, 0)
  );
end;
$$;

revoke all on function public.servicedesk_branch_reporting_row(uuid, uuid, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.servicedesk_branch_reporting_row(uuid, uuid, timestamptz, timestamptz)
to service_role;

create or replace function public.servicedesk_read_branch_reporting_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_from timestamptz := nullif(p_input->>'from','')::timestamptz;
  v_to timestamptz := nullif(p_input->>'to','')::timestamptz;
  v_snapshot jsonb;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null or v_branch is null then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_REPORTING_INPUT_INVALID');
  end if;
  if v_from is not null and v_to is not null and v_from > v_to then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_REPORTING_RANGE_INVALID');
  end if;
  if not public.servicedesk_require_branch_staff(v_workspace, v_branch, v_actor_user, v_actor_role)
     or v_actor_role not in ('OWNER','DISPATCHER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_snapshot := public.servicedesk_branch_reporting_row(v_workspace, v_branch, v_from, v_to);
  if v_snapshot is null then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'ok', true,
    'snapshot', v_snapshot || jsonb_build_object('generatedAt', now())
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_REPORTING_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_read_branch_comparison_snapshot(p_input jsonb)
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
  v_rows jsonb;
  v_currency_count integer;
  v_currency char(3);
  v_collected bigint;
  v_outstanding bigint;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER' then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_COMPARISON_INPUT_INVALID');
  end if;
  if v_from is not null and v_to is not null and v_from > v_to then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_REPORTING_RANGE_INVALID');
  end if;
  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(
    public.servicedesk_branch_reporting_row(v_workspace, b.id, v_from, v_to)
    order by b.is_default desc, b.name, b.id
  ), '[]'::jsonb)
  into v_rows
  from public.workspace_branches b
  where b.workspace_id = v_workspace and b.active;

  select count(distinct b.currency), min(b.currency)
  into v_currency_count, v_currency
  from public.workspace_branches b
  where b.workspace_id = v_workspace and b.active;

  if v_currency_count = 1 then
    select
      coalesce(sum((row->>'collectedMinor')::bigint), 0),
      coalesce(sum((row->>'outstandingMinor')::bigint), 0)
    into v_collected, v_outstanding
    from jsonb_array_elements(v_rows) row;
  else
    v_collected := null;
    v_outstanding := null;
    v_currency := null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'from', v_from,
      'to', v_to,
      'branches', v_rows,
      'mixedCurrency', v_currency_count > 1,
      'aggregateCurrency', v_currency,
      'aggregateCollectedMinor', v_collected,
      'aggregateOutstandingMinor', v_outstanding,
      'currencyDisclosure', case
        when v_currency_count > 1
          then 'Branches use multiple currencies. Company money totals are withheld until a verified FX conversion policy is configured.'
        else 'Company money totals are summed only because all active branches use the same recorded currency.'
      end,
      'generatedAt', now()
    )
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_COMPARISON_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_read_branch_reporting_snapshot(jsonb)
from public, anon, authenticated;
revoke all on function public.servicedesk_read_branch_comparison_snapshot(jsonb)
from public, anon, authenticated;
grant execute on function public.servicedesk_read_branch_reporting_snapshot(jsonb)
to service_role;
grant execute on function public.servicedesk_read_branch_comparison_snapshot(jsonb)
to service_role;

comment on function public.servicedesk_read_branch_comparison_snapshot(jsonb) is
  'Owner-only branch comparison. Per-branch timezone/currency remain explicit; mixed-currency company money totals are withheld instead of inventing FX conversion.';
