-- ServiceDesk AI V2 Wave 2B.2A: commercial billing helper/read functions.

create or replace function public.servicedesk_commercial_billing_draft_json(
  p_workspace uuid,
  p_draft uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', d.id,
    'workspaceId', d.workspace_id,
    'organizationId', d.organization_id,
    'contractId', d.contract_id,
    'contractVersionId', d.contract_version_id,
    'periodStart', d.period_start,
    'periodEnd', d.period_end,
    'state', d.state,
    'currency', d.currency,
    'chargeMinor', d.charge_minor,
    'creditMinor', d.credit_minor,
    'netTotalMinor', d.net_total_minor,
    'invoiceId', d.invoice_id,
    'version', d.version,
    'createdAt', d.created_at,
    'updatedAt', d.updated_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'workspaceId', l.workspace_id,
        'draftId', l.draft_id,
        'sourceType', l.source_type,
        'visitId', l.visit_id,
        'exceptionCaseId', l.exception_case_id,
        'direction', l.direction,
        'amountMinor', l.amount_minor,
        'currency', l.currency,
        'state', l.state,
        'descriptionSnapshot', l.description_snapshot,
        'createdAt', l.created_at,
        'updatedAt', l.updated_at
      ) order by l.created_at, l.id)
      from public.commercial_billing_lines l
      where l.workspace_id = d.workspace_id and l.draft_id = d.id
    ), '[]'::jsonb)
  )
  from public.commercial_billing_drafts d
  where d.workspace_id = p_workspace and d.id = p_draft;
$$;

create or replace function public.servicedesk_recalculate_commercial_billing_draft(
  p_workspace uuid,
  p_draft uuid,
  p_now timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_charge bigint;
  v_credit bigint;
begin
  select
    coalesce(sum(case when state = 'INCLUDED' and direction = 'CHARGE' then amount_minor else 0 end), 0),
    coalesce(sum(case when state = 'INCLUDED' and direction = 'CREDIT' then amount_minor else 0 end), 0)
  into v_charge, v_credit
  from public.commercial_billing_lines
  where workspace_id = p_workspace and draft_id = p_draft;

  update public.commercial_billing_drafts
  set charge_minor = v_charge,
      credit_minor = v_credit,
      net_total_minor = v_charge - v_credit,
      updated_at = p_now
  where workspace_id = p_workspace and id = p_draft;
end;
$$;

create or replace function public.servicedesk_commercial_billing_candidates(
  p_workspace uuid,
  p_contract_version uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  visit_id uuid,
  contract_site_id uuid,
  site_id uuid,
  service_id uuid,
  visit_starts_at timestamptz,
  timezone text,
  amount_minor bigint,
  rate_source text,
  rate_resolved boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    v.id,
    cs.id,
    cs.site_id,
    cs.service_id,
    v.starts_at,
    sp.timezone,
    resolved.amount_minor,
    case
      when cs.rate_override_snapshot is not null and cs.rate_override_snapshot <> '{}'::jsonb
        then 'SITE_OVERRIDE'
      else 'CONTRACT'
    end,
    resolved.amount_minor is not null
  from public.commercial_site_service_plans sp
  join public.commercial_contract_versions cv
    on cv.workspace_id = sp.workspace_id and cv.id = sp.contract_version_id
  join public.commercial_contract_sites cs
    on cs.workspace_id = sp.workspace_id and cs.id = sp.contract_site_id
  join public.commercial_sites site
    on site.workspace_id = cs.workspace_id and site.id = cs.site_id and site.active
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
  cross join lateral (
    select case
      when cs.rate_override_snapshot is not null and cs.rate_override_snapshot <> '{}'::jsonb
        then cs.rate_override_snapshot
      else cv.rate_snapshot
    end as rate
  ) pricing
  cross join lateral (
    select case
      when coalesce(pricing.rate->>'billingModel','') = 'FIXED_PER_VISIT'
       and coalesce(pricing.rate->>'amountMinor','') ~ '^[0-9]+$'
       and (pricing.rate->>'amountMinor')::numeric between 1 and 9223372036854775807
        then (pricing.rate->>'amountMinor')::bigint
      else null
    end as amount_minor
  ) resolved
  where sp.workspace_id = p_workspace
    and sp.contract_version_id = p_contract_version
    and sp.status = 'ACTIVE'
    and cs.active
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between p_period_start and p_period_end
    and not exists (
      select 1
      from public.quality_cases qc
      where qc.workspace_id = v.workspace_id
        and qc.visit_id = v.id
        and qc.state in ('OPEN','IN_REVIEW')
    )
    and not exists (
      select 1
      from public.commercial_exception_cases ec
      where ec.workspace_id = v.workspace_id
        and ec.visit_id = v.id
        and ec.state in ('OPEN','IN_REVIEW')
    );
$$;

revoke all on function public.servicedesk_commercial_billing_draft_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.servicedesk_recalculate_commercial_billing_draft(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.servicedesk_commercial_billing_candidates(uuid, uuid, date, date) from public, anon, authenticated;

grant execute on function public.servicedesk_commercial_billing_draft_json(uuid, uuid) to service_role;
grant execute on function public.servicedesk_recalculate_commercial_billing_draft(uuid, uuid, timestamptz) to service_role;
grant execute on function public.servicedesk_commercial_billing_candidates(uuid, uuid, date, date) to service_role;
