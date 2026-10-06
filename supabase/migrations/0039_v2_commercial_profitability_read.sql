-- ServiceDesk AI V2 Wave 2B.4B: provider-neutral commercial profitability read model.
-- Reports recorded direct-cost margins only. It does not infer missing costs, allocate partial payments,
-- or certify tax/profitability.

create or replace function public.servicedesk_read_commercial_profitability_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_from date := nullif(p_input->>'fromDate','')::date;
  v_to date := nullif(p_input->>'toDate','')::date;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null
     or (v_from is not null and v_to is not null and v_to < v_from) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_PROFITABILITY_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1
    from public.workspace_feature_flags
    where workspace_id = v_workspace
      and feature_key = 'COMMERCIAL_OPERATIONS'
      and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  return (
    with visit_source as (
      select distinct on (v.id)
        v.id as visit_id,
        v.status::text as visit_status,
        (v.starts_at at time zone sp.timezone)::date as local_visit_date,
        cs.site_id,
        site.site_code,
        cs.service_id,
        svc.code as service_code,
        svc.name as service_name,
        cv.currency,
        case
          when (
            case
              when cs.rate_override_snapshot is not null
                   and cs.rate_override_snapshot <> '{}'::jsonb
                then cs.rate_override_snapshot
              else cv.rate_snapshot
            end
          )->>'billingModel' = 'FIXED_PER_VISIT'
          and coalesce((
            case
              when cs.rate_override_snapshot is not null
                   and cs.rate_override_snapshot <> '{}'::jsonb
                then cs.rate_override_snapshot
              else cv.rate_snapshot
            end
          )->>'amountMinor','') ~ '^[0-9]+$'
          then ((
            case
              when cs.rate_override_snapshot is not null
                   and cs.rate_override_snapshot <> '{}'::jsonb
                then cs.rate_override_snapshot
              else cv.rate_snapshot
            end
          )->>'amountMinor')::bigint
          else null
        end as contract_value_minor
      from public.commercial_site_service_plans sp
      join public.commercial_contract_sites cs
        on cs.workspace_id = sp.workspace_id and cs.id = sp.contract_site_id
      join public.commercial_sites site
        on site.workspace_id = cs.workspace_id and site.id = cs.site_id
      join public.service_catalog svc
        on svc.workspace_id = cs.workspace_id and svc.id = cs.service_id
      join public.commercial_contract_versions cv
        on cv.workspace_id = sp.workspace_id and cv.id = sp.contract_version_id
      join public.recurrence_rules rr
        on rr.workspace_id = sp.workspace_id and rr.id = sp.recurrence_rule_id
       and rr.property_id = site.property_id
      join public.recurrence_occurrences ro
        on ro.workspace_id = rr.workspace_id and ro.rule_id = rr.id and ro.request_id is not null
      join public.requests req
        on req.workspace_id = ro.workspace_id and req.id = ro.request_id
       and req.property_id = site.property_id and req.service_id = cs.service_id
      join public.visits v
        on v.workspace_id = req.workspace_id and v.request_id = req.id
      where sp.workspace_id = v_workspace
        and cs.active
        and v.status <> 'CANCELLED'
        and (v_from is null or (v.starts_at at time zone sp.timezone)::date >= v_from)
        and (v_to is null or (v.starts_at at time zone sp.timezone)::date <= v_to)
      order by v.id, ro.sequence desc
    ),
    cost_by_visit as (
      select
        visit_id,
        currency,
        coalesce(sum(
          case
            when basis = 'ESTIMATED'
              then case when direction = 'COST' then amount_minor else -amount_minor end
            else 0
          end
        ),0)::bigint as estimated_cost_minor,
        coalesce(sum(
          case
            when basis = 'ACTUAL'
              then case when direction = 'COST' then amount_minor else -amount_minor end
            else 0
          end
        ),0)::bigint as actual_cost_minor,
        bool_or(basis = 'ESTIMATED') as has_estimated_cost,
        bool_or(basis = 'ACTUAL') as has_actual_cost
      from public.commercial_direct_cost_entries
      where workspace_id = v_workspace
      group by visit_id, currency
    ),
    billing_by_visit as (
      select
        l.visit_id,
        l.currency,
        l.amount_minor as billed_visit_minor,
        i.id as invoice_id,
        i.status::text as invoice_status,
        i.balance_minor,
        greatest(i.allocated_minor - i.refunded_minor, 0)::bigint as net_collected_minor
      from public.commercial_billing_lines l
      join public.commercial_billing_drafts d
        on d.workspace_id = l.workspace_id and d.id = l.draft_id and d.state = 'FINALIZED'
      join public.invoices i
        on i.workspace_id = d.workspace_id and i.id = d.invoice_id
      where l.workspace_id = v_workspace
        and l.source_type = 'VISIT'
        and l.direction = 'CHARGE'
        and l.state = 'INCLUDED'
        and l.visit_id is not null
    ),
    grouped as (
      select
        vs.site_id,
        vs.site_code,
        vs.service_id,
        vs.service_code,
        vs.service_name,
        vs.currency,
        count(*)::bigint as quoted_visit_count,
        count(*) filter (where vs.visit_status = 'COMPLETED')::bigint as completed_visit_count,
        count(*) filter (
          where b.invoice_status = 'PAID' and b.balance_minor = 0
        )::bigint as paid_visit_count,
        count(*) filter (where vs.contract_value_minor is null)::bigint as unresolved_rate_count,
        count(*) filter (where coalesce(c.has_estimated_cost,false))::bigint as estimated_costed_visit_count,
        count(*) filter (
          where vs.visit_status = 'COMPLETED' and coalesce(c.has_actual_cost,false)
        )::bigint as actual_costed_completed_visit_count,
        count(*) filter (
          where b.invoice_status = 'PAID' and b.balance_minor = 0 and coalesce(c.has_actual_cost,false)
        )::bigint as actual_costed_paid_visit_count,
        count(*) filter (
          where b.invoice_status = 'PARTIALLY_PAID'
             or (b.net_collected_minor > 0 and b.balance_minor > 0)
        )::bigint as partial_payment_visit_count,
        coalesce(sum(vs.contract_value_minor),0)::bigint as quoted_revenue_minor,
        coalesce(sum(vs.contract_value_minor) filter (where vs.visit_status = 'COMPLETED'),0)::bigint
          as completed_revenue_minor,
        coalesce(sum(b.billed_visit_minor) filter (
          where b.invoice_status = 'PAID' and b.balance_minor = 0
        ),0)::bigint as paid_revenue_minor,
        coalesce(sum(c.estimated_cost_minor),0)::bigint as recorded_estimated_cost_minor,
        coalesce(sum(c.actual_cost_minor) filter (where vs.visit_status = 'COMPLETED'),0)::bigint
          as recorded_actual_completed_cost_minor,
        coalesce(sum(c.actual_cost_minor) filter (
          where b.invoice_status = 'PAID' and b.balance_minor = 0
        ),0)::bigint as recorded_actual_paid_cost_minor
      from visit_source vs
      left join cost_by_visit c
        on c.visit_id = vs.visit_id and c.currency = vs.currency
      left join billing_by_visit b
        on b.visit_id = vs.visit_id and b.currency = vs.currency
      group by
        vs.site_id, vs.site_code, vs.service_id, vs.service_code, vs.service_name, vs.currency
    ),
    adjustment_totals as (
      select
        l.currency,
        coalesce(sum(
          case when l.direction = 'CHARGE' then l.amount_minor else -l.amount_minor end
        ),0)::bigint as finalized_adjustment_net_minor,
        coalesce(sum(
          case when i.status = 'PAID' and i.balance_minor = 0
            then case when l.direction = 'CHARGE' then l.amount_minor else -l.amount_minor end
            else 0
          end
        ),0)::bigint as paid_adjustment_net_minor,
        count(*)::bigint as adjustment_line_count
      from public.commercial_billing_lines l
      join public.commercial_billing_drafts d
        on d.workspace_id = l.workspace_id and d.id = l.draft_id and d.state = 'FINALIZED'
      join public.invoices i
        on i.workspace_id = d.workspace_id and i.id = d.invoice_id
      where l.workspace_id = v_workspace
        and l.source_type = 'ADJUSTMENT'
        and l.state = 'INCLUDED'
        and (v_from is null or d.period_end >= v_from)
        and (v_to is null or d.period_start <= v_to)
      group by l.currency
    ),
    partial_invoices as (
      select count(distinct i.id)::bigint as invoice_count
      from public.invoices i
      join public.commercial_billing_drafts d
        on d.workspace_id = i.workspace_id and d.invoice_id = i.id
      where i.workspace_id = v_workspace
        and (i.status = 'PARTIALLY_PAID' or (i.allocated_minor - i.refunded_minor > 0 and i.balance_minor > 0))
        and (v_from is null or d.period_end >= v_from)
        and (v_to is null or d.period_start <= v_to)
    )
    select jsonb_build_object(
      'ok', true,
      'snapshot', jsonb_build_object(
        'workspaceId', v_workspace,
        'fromDate', v_from,
        'toDate', v_to,
        'rows', coalesce((
          select jsonb_agg(jsonb_build_object(
            'siteId', g.site_id,
            'siteCode', g.site_code,
            'serviceId', g.service_id,
            'serviceCode', g.service_code,
            'serviceName', g.service_name,
            'currency', g.currency,
            'quotedVisitCount', g.quoted_visit_count,
            'completedVisitCount', g.completed_visit_count,
            'paidVisitCount', g.paid_visit_count,
            'unresolvedRateCount', g.unresolved_rate_count,
            'estimatedCostedVisitCount', g.estimated_costed_visit_count,
            'actualCostedCompletedVisitCount', g.actual_costed_completed_visit_count,
            'actualCostedPaidVisitCount', g.actual_costed_paid_visit_count,
            'partialPaymentVisitCount', g.partial_payment_visit_count,
            'quotedRevenueMinor', g.quoted_revenue_minor,
            'completedRevenueMinor', g.completed_revenue_minor,
            'paidRevenueMinor', g.paid_revenue_minor,
            'recordedEstimatedCostMinor', g.recorded_estimated_cost_minor,
            'recordedActualCompletedCostMinor', g.recorded_actual_completed_cost_minor,
            'recordedActualPaidCostMinor', g.recorded_actual_paid_cost_minor,
            'recordedQuotedMarginMinor', g.quoted_revenue_minor - g.recorded_estimated_cost_minor,
            'recordedCompletedMarginMinor', g.completed_revenue_minor - g.recorded_actual_completed_cost_minor,
            'recordedPaidMarginMinor', g.paid_revenue_minor - g.recorded_actual_paid_cost_minor
          ) order by g.site_code nulls last, g.service_name, g.currency)
          from grouped g
        ), '[]'::jsonb),
        'unattributedAdjustments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'currency', a.currency,
            'finalizedNetMinor', a.finalized_adjustment_net_minor,
            'paidNetMinor', a.paid_adjustment_net_minor,
            'lineCount', a.adjustment_line_count
          ) order by a.currency)
          from adjustment_totals a
        ), '[]'::jsonb),
        'partialPaymentInvoiceCount', (select invoice_count from partial_invoices)
      )
    )
  );
end;
$$;

revoke all on function public.servicedesk_read_commercial_profitability_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_read_commercial_profitability_snapshot(jsonb) to service_role;

comment on function public.servicedesk_read_commercial_profitability_snapshot(jsonb) is
  'Reports recorded commercial margins by site/service. Missing direct costs remain visible through coverage counts; partial payments and unattributed adjustments are never prorated.';
