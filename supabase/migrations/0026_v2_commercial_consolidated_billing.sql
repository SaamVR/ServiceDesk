-- ServiceDesk AI V2 Wave 2B.2A: consolidated commercial billing draft + invoice issue boundary.
-- Draft creation is derived from completed contract-backed visits. Finalization creates an ordinary
-- ServiceDesk invoice but never records payment, charges a saved method, or mutates payment truth.

create table if not exists public.commercial_billing_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  period_start date not null,
  period_end date not null,
  state text not null default 'DRAFT' check (state in ('DRAFT','FINALIZED','VOID')),
  currency char(3) not null,
  charge_minor bigint not null default 0 check (charge_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  net_total_minor bigint not null default 0,
  invoice_id uuid,
  version bigint not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, organization_id)
    references public.commercial_organizations(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_id)
    references public.commercial_contracts(workspace_id, id) on delete restrict,
  foreign key (workspace_id, contract_version_id)
    references public.commercial_contract_versions(workspace_id, id) on delete restrict,
  check (period_end >= period_start),
  check (net_total_minor = charge_minor - credit_minor)
);

create table if not exists public.commercial_billing_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null,
  source_type text not null check (source_type in ('VISIT','ADJUSTMENT')),
  visit_id uuid,
  exception_case_id uuid,
  direction text not null check (direction in ('CHARGE','CREDIT')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  state text not null default 'INCLUDED' check (state in ('INCLUDED','EXCLUDED')),
  description_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, draft_id)
    references public.commercial_billing_drafts(workspace_id, id) on delete cascade,
  foreign key (workspace_id, visit_id)
    references public.visits(workspace_id, id) on delete restrict,
  foreign key (workspace_id, exception_case_id)
    references public.commercial_exception_cases(workspace_id, id) on delete restrict,
  check (
    (source_type = 'VISIT' and visit_id is not null and exception_case_id is null and direction = 'CHARGE')
    or
    (source_type = 'ADJUSTMENT' and visit_id is null and exception_case_id is not null)
  )
);

create unique index if not exists commercial_billing_active_visit_uq
  on public.commercial_billing_lines(workspace_id, visit_id)
  where visit_id is not null and state = 'INCLUDED';

create unique index if not exists commercial_billing_active_adjustment_uq
  on public.commercial_billing_lines(workspace_id, exception_case_id)
  where exception_case_id is not null and state = 'INCLUDED';

create index if not exists commercial_billing_drafts_contract_period_idx
  on public.commercial_billing_drafts(workspace_id, contract_version_id, period_start, period_end, state);

create index if not exists commercial_billing_lines_draft_idx
  on public.commercial_billing_lines(workspace_id, draft_id, state, created_at);

create unique index if not exists commercial_billing_active_period_uq
  on public.commercial_billing_drafts(workspace_id, contract_version_id, period_start, period_end)
  where state in ('DRAFT','FINALIZED');

-- V1 invoices remain authoritative financial documents. Commercial invoices use the same table and
-- therefore the same payment application / ledger path, but have a commercial draft instead of a quote.
alter table public.invoices
  alter column quote_id drop not null;

alter table public.invoices
  add column if not exists commercial_billing_draft_id uuid;

alter table public.invoices
  drop constraint if exists invoices_business_source_ck;

alter table public.invoices
  add constraint invoices_business_source_ck
  check ((quote_id is not null) <> (commercial_billing_draft_id is not null));

alter table public.invoices
  drop constraint if exists invoices_commercial_billing_draft_fk;

alter table public.invoices
  add constraint invoices_commercial_billing_draft_fk
  foreign key (workspace_id, commercial_billing_draft_id)
  references public.commercial_billing_drafts(workspace_id, id) on delete restrict;

create unique index if not exists invoices_commercial_billing_draft_uq
  on public.invoices(workspace_id, commercial_billing_draft_id)
  where commercial_billing_draft_id is not null;

alter table public.commercial_billing_drafts
  drop constraint if exists commercial_billing_drafts_invoice_fk;

alter table public.commercial_billing_drafts
  add constraint commercial_billing_drafts_invoice_fk
  foreign key (workspace_id, invoice_id)
  references public.invoices(workspace_id, id) on delete restrict;

alter table public.commercial_billing_drafts enable row level security;
alter table public.commercial_billing_lines enable row level security;

create policy commercial_billing_drafts_staff_select on public.commercial_billing_drafts
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create policy commercial_billing_lines_staff_select on public.commercial_billing_lines
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

revoke all on table public.commercial_billing_drafts from anon, authenticated;
revoke all on table public.commercial_billing_lines from anon, authenticated;
grant select on table public.commercial_billing_drafts to authenticated;
grant select on table public.commercial_billing_lines to authenticated;
grant all on table public.commercial_billing_drafts to service_role;
grant all on table public.commercial_billing_lines to service_role;

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

create or replace function public.servicedesk_create_commercial_billing_draft(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_contract_version_id uuid := nullif(p_input->>'contractVersionId','')::uuid;
  v_period_start date := nullif(p_input->>'periodStart','')::date;
  v_period_end date := nullif(p_input->>'periodEnd','')::date;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_version public.commercial_contract_versions%rowtype;
  v_contract public.commercial_contracts%rowtype;
  v_draft public.commercial_billing_drafts%rowtype;
  v_bad_visit uuid;
  v_duplicate_visit uuid;
  v_count integer;
begin
  if v_workspace is null or v_actor_user is null or v_contract_version_id is null
     or v_period_start is null or v_period_end is null or v_period_end < v_period_start then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.workspace_feature_flags
    where workspace_id = v_workspace and feature_key = 'COMMERCIAL_OPERATIONS' and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  select * into v_version
  from public.commercial_contract_versions
  where workspace_id = v_workspace and id = v_contract_version_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_CONTRACT_VERSION_NOT_FOUND'); end if;
  if v_version.state <> 'APPROVED' then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_CONTRACT_VERSION_NOT_APPROVED'); end if;
  if v_period_start < v_version.effective_from
     or (v_version.effective_to is not null and v_period_end > v_version.effective_to) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_PERIOD_OUTSIDE_CONTRACT');
  end if;

  select * into v_contract
  from public.commercial_contracts
  where workspace_id = v_workspace and id = v_version.contract_id
  for update;

  if not found or v_contract.status <> 'ACTIVE' then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_CONTRACT_NOT_ACTIVE');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace
    and contract_version_id = v_contract_version_id
    and period_start = v_period_start
    and period_end = v_period_end
    and state in ('DRAFT','FINALIZED')
  order by created_at
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
    );
  end if;

  -- A supported V2.2A rate is an explicit fixed-per-visit amount. We fail closed instead of
  -- guessing from a quote, service catalog, or arbitrary JSON shape.
  select v.id into v_bad_visit
  from public.commercial_site_service_plans sp
  join public.commercial_contract_sites cs
    on cs.workspace_id = sp.workspace_id and cs.id = sp.contract_site_id
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  cross join lateral (
    select case
      when cs.rate_override_snapshot is not null and cs.rate_override_snapshot ? 'billingModel'
        then cs.rate_override_snapshot
      else v_version.rate_snapshot
    end as rate
  ) pricing
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and cs.active
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end
    and (
      coalesce(pricing.rate->>'billingModel','') <> 'FIXED_PER_VISIT'
      or not (
        case
          when coalesce(pricing.rate->>'amountMinor','') ~ '^[0-9]+
  order by v.starts_at, v.id
  limit 1;

  if v_bad_visit is not null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_RATE_UNRESOLVED', 'visitId', v_bad_visit);
  end if;

  select v.id into v_duplicate_visit
  from public.commercial_site_service_plans sp
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  join public.commercial_billing_lines l
    on l.workspace_id = v.workspace_id and l.visit_id = v.id and l.state = 'INCLUDED'
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end
  order by v.starts_at, v.id
  limit 1;

  if v_duplicate_visit is not null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED', 'visitId', v_duplicate_visit);
  end if;

  select count(*) into v_count
  from public.commercial_site_service_plans sp
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_NO_ELIGIBLE_VISITS');
  end if;

  insert into public.commercial_billing_drafts(
    workspace_id, organization_id, contract_id, contract_version_id,
    period_start, period_end, state, currency, created_by, created_at, updated_at
  ) values (
    v_workspace, v_contract.organization_id, v_contract.id, v_version.id,
    v_period_start, v_period_end, 'DRAFT', v_version.currency, v_actor_user, v_now, v_now
  )
  returning * into v_draft;

  insert into public.commercial_billing_lines(
    workspace_id, draft_id, source_type, visit_id, direction, amount_minor, currency,
    state, description_snapshot, created_at, updated_at
  )
  select
    v_workspace,
    v_draft.id,
    'VISIT',
    v.id,
    'CHARGE',
    (pricing.rate->>'amountMinor')::bigint,
    v_version.currency,
    'INCLUDED',
    jsonb_build_object(
      'contractSiteId', cs.id,
      'siteId', cs.site_id,
      'serviceId', cs.service_id,
      'visitStartsAt', v.starts_at,
      'billingModel', 'FIXED_PER_VISIT',
      'rateSource', case when cs.rate_override_snapshot is not null and cs.rate_override_snapshot ? 'billingModel' then 'SITE_OVERRIDE' else 'CONTRACT' end
    ),
    v_now,
    v_now
  from public.commercial_site_service_plans sp
  join public.commercial_contract_sites cs
    on cs.workspace_id = sp.workspace_id and cs.id = sp.contract_site_id
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  cross join lateral (
    select case
      when cs.rate_override_snapshot is not null and cs.rate_override_snapshot ? 'billingModel'
        then cs.rate_override_snapshot
      else v_version.rate_snapshot
    end as rate
  ) pricing
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and cs.active
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end
  order by v.starts_at, v.id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft.id, v_now);

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'COMMERCIAL_BILLING_DRAFT_CREATED', 'commercial_billing_draft', v_draft.id,
    jsonb_build_object('contractVersionId', v_contract_version_id, 'periodStart', v_period_start, 'periodEnd', v_period_end, 'visitCount', v_count)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
  );
end;
$$;

create or replace function public.servicedesk_set_commercial_billing_line_state(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_draft_id uuid := nullif(p_input->>'draftId','')::uuid;
  v_line_id uuid := nullif(p_input->>'lineId','')::uuid;
  v_state text := p_input->>'state';
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_line public.commercial_billing_lines%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_draft_id is null or v_line_id is null
     or v_state not in ('INCLUDED','EXCLUDED') or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_LINE_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.workspace_feature_flags
    where workspace_id = v_workspace and feature_key = 'COMMERCIAL_OPERATIONS' and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_NOT_FOUND'); end if;
  if v_draft.state <> 'DRAFT' then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_LOCKED'); end if;
  if v_draft.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VERSION_CONFLICT'); end if;

  select * into v_line
  from public.commercial_billing_lines
  where workspace_id = v_workspace and draft_id = v_draft_id and id = v_line_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_LINE_NOT_FOUND'); end if;

  if v_state = 'INCLUDED' and v_line.visit_id is not null and exists (
    select 1 from public.commercial_billing_lines other
    where other.workspace_id = v_workspace
      and other.visit_id = v_line.visit_id
      and other.state = 'INCLUDED'
      and other.id <> v_line.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED');
  end if;

  update public.commercial_billing_lines
  set state = v_state, updated_at = v_now
  where workspace_id = v_workspace and id = v_line_id;

  update public.commercial_billing_drafts
  set version = version + 1, updated_at = v_now
  where workspace_id = v_workspace and id = v_draft_id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft_id, v_now);

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'COMMERCIAL_BILLING_LINE_STATE_CHANGED', 'commercial_billing_line', v_line_id,
    jsonb_build_object('draftId', v_draft_id, 'state', v_state)
  );

  return jsonb_build_object(
    'ok', true,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft_id)
  );
end;
$$;

create or replace function public.servicedesk_finalize_commercial_billing_draft(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_draft_id uuid := nullif(p_input->>'draftId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_invoice public.invoices%rowtype;
  v_count integer;
begin
  if v_workspace is null or v_actor_user is null or v_draft_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_FINALIZE_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.workspace_feature_flags
    where workspace_id = v_workspace and feature_key = 'COMMERCIAL_OPERATIONS' and enabled
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_FEATURE_DISABLED');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_NOT_FOUND'); end if;

  if v_draft.state = 'FINALIZED' and v_draft.invoice_id is not null then
    select * into v_invoice from public.invoices
    where workspace_id = v_workspace and id = v_draft.invoice_id;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id),
      'invoice', jsonb_build_object(
        'id', v_invoice.id, 'workspaceId', v_invoice.workspace_id, 'status', v_invoice.status::text,
        'currency', v_invoice.currency, 'totalMinor', v_invoice.total_minor, 'allocatedMinor', v_invoice.allocated_minor,
        'refundedMinor', v_invoice.refunded_minor, 'balanceMinor', v_invoice.balance_minor
      )
    );
  end if;

  if v_draft.state <> 'DRAFT' then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_LOCKED'); end if;
  if v_draft.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VERSION_CONFLICT'); end if;
  if not exists (
    select 1
    from public.commercial_contract_versions cv
    join public.commercial_contracts cc
      on cc.workspace_id = cv.workspace_id and cc.id = cv.contract_id
    where cv.workspace_id = v_workspace
      and cv.id = v_draft.contract_version_id
      and cv.state = 'APPROVED'
      and cc.status = 'ACTIVE'
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_CONTRACT_NO_LONGER_ISSUABLE');
  end if;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft_id, v_now);
  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  select count(*) into v_count
  from public.commercial_billing_lines
  where workspace_id = v_workspace and draft_id = v_draft_id and state = 'INCLUDED';

  if v_count = 0 then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_EMPTY_DRAFT'); end if;
  if v_draft.net_total_minor <= 0 then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_NONPOSITIVE_TOTAL'); end if;

  insert into public.invoices(
    workspace_id, quote_id, visit_id, commercial_billing_draft_id,
    status, currency, total_minor, allocated_minor, refunded_minor, balance_minor,
    version, created_at, updated_at
  ) values (
    v_workspace, null, null, v_draft.id,
    'ISSUED', v_draft.currency, v_draft.net_total_minor, 0, 0, v_draft.net_total_minor,
    1, v_now, v_now
  )
  returning * into v_invoice;

  update public.commercial_billing_drafts
  set state = 'FINALIZED', invoice_id = v_invoice.id, version = version + 1, updated_at = v_now
  where workspace_id = v_workspace and id = v_draft.id;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'COMMERCIAL_BILLING_FINALIZED', 'commercial_billing_draft', v_draft.id,
    jsonb_build_object('invoiceId', v_invoice.id, 'totalMinor', v_invoice.total_minor, 'currency', v_invoice.currency)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id),
    'invoice', jsonb_build_object(
      'id', v_invoice.id, 'workspaceId', v_invoice.workspace_id, 'status', v_invoice.status::text,
      'currency', v_invoice.currency, 'totalMinor', v_invoice.total_minor, 'allocatedMinor', v_invoice.allocated_minor,
      'refundedMinor', v_invoice.refunded_minor, 'balanceMinor', v_invoice.balance_minor
    )
  );
end;
$$;

revoke all on function public.servicedesk_commercial_billing_draft_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.servicedesk_recalculate_commercial_billing_draft(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.servicedesk_create_commercial_billing_draft(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_set_commercial_billing_line_state(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_finalize_commercial_billing_draft(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_commercial_billing_draft_json(uuid, uuid) to service_role;
grant execute on function public.servicedesk_recalculate_commercial_billing_draft(uuid, uuid, timestamptz) to service_role;
grant execute on function public.servicedesk_create_commercial_billing_draft(jsonb) to service_role;
grant execute on function public.servicedesk_set_commercial_billing_line_state(jsonb) to service_role;
grant execute on function public.servicedesk_finalize_commercial_billing_draft(jsonb) to service_role;

comment on table public.commercial_billing_drafts is
  'Commercial consolidated billing work-in-progress. Finalization creates an authoritative invoices row but never applies payment.';
comment on table public.commercial_billing_lines is
  'Traceable commercial invoice-draft sources. V2.2A derives visit charges from explicit FIXED_PER_VISIT contract snapshots; adjustments are reserved for a later policy-bound command.';

            then (pricing.rate->>'amountMinor')::numeric > 0
          else false
        end
      )
    )
  order by v.starts_at, v.id
  limit 1;

  if v_bad_visit is not null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_RATE_UNRESOLVED', 'visitId', v_bad_visit);
  end if;

  select v.id into v_duplicate_visit
  from public.commercial_site_service_plans sp
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  join public.commercial_billing_lines l
    on l.workspace_id = v.workspace_id and l.visit_id = v.id and l.state = 'INCLUDED'
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end
  order by v.starts_at, v.id
  limit 1;

  if v_duplicate_visit is not null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED', 'visitId', v_duplicate_visit);
  end if;

  select count(*) into v_count
  from public.commercial_site_service_plans sp
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_NO_ELIGIBLE_VISITS');
  end if;

  insert into public.commercial_billing_drafts(
    workspace_id, organization_id, contract_id, contract_version_id,
    period_start, period_end, state, currency, created_by, created_at, updated_at
  ) values (
    v_workspace, v_contract.organization_id, v_contract.id, v_version.id,
    v_period_start, v_period_end, 'DRAFT', v_version.currency, v_actor_user, v_now, v_now
  )
  returning * into v_draft;

  insert into public.commercial_billing_lines(
    workspace_id, draft_id, source_type, visit_id, direction, amount_minor, currency,
    state, description_snapshot, created_at, updated_at
  )
  select
    v_workspace,
    v_draft.id,
    'VISIT',
    v.id,
    'CHARGE',
    (pricing.rate->>'amountMinor')::bigint,
    v_version.currency,
    'INCLUDED',
    jsonb_build_object(
      'contractSiteId', cs.id,
      'siteId', cs.site_id,
      'serviceId', cs.service_id,
      'visitStartsAt', v.starts_at,
      'billingModel', 'FIXED_PER_VISIT',
      'rateSource', case when cs.rate_override_snapshot is not null and cs.rate_override_snapshot ? 'billingModel' then 'SITE_OVERRIDE' else 'CONTRACT' end
    ),
    v_now,
    v_now
  from public.commercial_site_service_plans sp
  join public.commercial_contract_sites cs
    on cs.workspace_id = sp.workspace_id and cs.id = sp.contract_site_id
  join public.recurrence_occurrences ro
    on ro.workspace_id = sp.workspace_id and ro.rule_id = sp.recurrence_rule_id and ro.request_id is not null
  join public.visits v
    on v.workspace_id = ro.workspace_id and v.request_id = ro.request_id
  cross join lateral (
    select case
      when cs.rate_override_snapshot is not null and cs.rate_override_snapshot ? 'billingModel'
        then cs.rate_override_snapshot
      else v_version.rate_snapshot
    end as rate
  ) pricing
  where sp.workspace_id = v_workspace
    and sp.contract_version_id = v_contract_version_id
    and sp.status = 'ACTIVE'
    and cs.active
    and v.status = 'COMPLETED'
    and (v.starts_at at time zone sp.timezone)::date between v_period_start and v_period_end
  order by v.starts_at, v.id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft.id, v_now);

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'COMMERCIAL_BILLING_DRAFT_CREATED', 'commercial_billing_draft', v_draft.id,
    jsonb_build_object('contractVersionId', v_contract_version_id, 'periodStart', v_period_start, 'periodEnd', v_period_end, 'visitCount', v_count)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id)
  );
end;
$$;

create or replace function public.servicedesk_set_commercial_billing_line_state(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_draft_id uuid := nullif(p_input->>'draftId','')::uuid;
  v_line_id uuid := nullif(p_input->>'lineId','')::uuid;
  v_state text := p_input->>'state';
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_line public.commercial_billing_lines%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_draft_id is null or v_line_id is null
     or v_state not in ('INCLUDED','EXCLUDED') or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_LINE_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_NOT_FOUND'); end if;
  if v_draft.state <> 'DRAFT' then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_LOCKED'); end if;
  if v_draft.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VERSION_CONFLICT'); end if;

  select * into v_line
  from public.commercial_billing_lines
  where workspace_id = v_workspace and draft_id = v_draft_id and id = v_line_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_LINE_NOT_FOUND'); end if;

  if v_state = 'INCLUDED' and v_line.visit_id is not null and exists (
    select 1 from public.commercial_billing_lines other
    where other.workspace_id = v_workspace
      and other.visit_id = v_line.visit_id
      and other.state = 'INCLUDED'
      and other.id <> v_line.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED');
  end if;

  update public.commercial_billing_lines
  set state = v_state, updated_at = v_now
  where workspace_id = v_workspace and id = v_line_id;

  update public.commercial_billing_drafts
  set version = version + 1, updated_at = v_now
  where workspace_id = v_workspace and id = v_draft_id;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft_id, v_now);

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'COMMERCIAL_BILLING_LINE_STATE_CHANGED', 'commercial_billing_line', v_line_id,
    jsonb_build_object('draftId', v_draft_id, 'state', v_state)
  );

  return jsonb_build_object(
    'ok', true,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft_id)
  );
end;
$$;

create or replace function public.servicedesk_finalize_commercial_billing_draft(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_draft_id uuid := nullif(p_input->>'draftId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_draft public.commercial_billing_drafts%rowtype;
  v_invoice public.invoices%rowtype;
  v_count integer;
begin
  if v_workspace is null or v_actor_user is null or v_draft_id is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_FINALIZE_INPUT_INVALID');
  end if;

  if v_actor_role not in ('OWNER','DISPATCHER')
     or not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_NOT_FOUND'); end if;

  if v_draft.state = 'FINALIZED' and v_draft.invoice_id is not null then
    select * into v_invoice from public.invoices
    where workspace_id = v_workspace and id = v_draft.invoice_id;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id),
      'invoice', jsonb_build_object(
        'id', v_invoice.id, 'workspaceId', v_invoice.workspace_id, 'status', v_invoice.status::text,
        'currency', v_invoice.currency, 'totalMinor', v_invoice.total_minor, 'allocatedMinor', v_invoice.allocated_minor,
        'refundedMinor', v_invoice.refunded_minor, 'balanceMinor', v_invoice.balance_minor
      )
    );
  end if;

  if v_draft.state <> 'DRAFT' then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_DRAFT_LOCKED'); end if;
  if v_draft.version <> v_expected then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_VERSION_CONFLICT'); end if;

  perform public.servicedesk_recalculate_commercial_billing_draft(v_workspace, v_draft_id, v_now);
  select * into v_draft
  from public.commercial_billing_drafts
  where workspace_id = v_workspace and id = v_draft_id
  for update;

  select count(*) into v_count
  from public.commercial_billing_lines
  where workspace_id = v_workspace and draft_id = v_draft_id and state = 'INCLUDED';

  if v_count = 0 then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_EMPTY_DRAFT'); end if;
  if v_draft.net_total_minor <= 0 then return jsonb_build_object('ok', false, 'code', 'COMMERCIAL_BILLING_NONPOSITIVE_TOTAL'); end if;

  insert into public.invoices(
    workspace_id, quote_id, visit_id, commercial_billing_draft_id,
    status, currency, total_minor, allocated_minor, refunded_minor, balance_minor,
    version, created_at, updated_at
  ) values (
    v_workspace, null, null, v_draft.id,
    'ISSUED', v_draft.currency, v_draft.net_total_minor, 0, 0, v_draft.net_total_minor,
    1, v_now, v_now
  )
  returning * into v_invoice;

  update public.commercial_billing_drafts
  set state = 'FINALIZED', invoice_id = v_invoice.id, version = version + 1, updated_at = v_now
  where workspace_id = v_workspace and id = v_draft.id;

  insert into public.audit_events(
    workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, after_data
  ) values (
    v_workspace, v_actor_user, v_actor_role, 'COMMERCIAL_BILLING_FINALIZED', 'commercial_billing_draft', v_draft.id,
    jsonb_build_object('invoiceId', v_invoice.id, 'totalMinor', v_invoice.total_minor, 'currency', v_invoice.currency)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'draft', public.servicedesk_commercial_billing_draft_json(v_workspace, v_draft.id),
    'invoice', jsonb_build_object(
      'id', v_invoice.id, 'workspaceId', v_invoice.workspace_id, 'status', v_invoice.status::text,
      'currency', v_invoice.currency, 'totalMinor', v_invoice.total_minor, 'allocatedMinor', v_invoice.allocated_minor,
      'refundedMinor', v_invoice.refunded_minor, 'balanceMinor', v_invoice.balance_minor
    )
  );
end;
$$;

revoke all on function public.servicedesk_commercial_billing_draft_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.servicedesk_recalculate_commercial_billing_draft(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.servicedesk_create_commercial_billing_draft(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_set_commercial_billing_line_state(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_finalize_commercial_billing_draft(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_commercial_billing_draft_json(uuid, uuid) to service_role;
grant execute on function public.servicedesk_recalculate_commercial_billing_draft(uuid, uuid, timestamptz) to service_role;
grant execute on function public.servicedesk_create_commercial_billing_draft(jsonb) to service_role;
grant execute on function public.servicedesk_set_commercial_billing_line_state(jsonb) to service_role;
grant execute on function public.servicedesk_finalize_commercial_billing_draft(jsonb) to service_role;

comment on table public.commercial_billing_drafts is
  'Commercial consolidated billing work-in-progress. Finalization creates an authoritative invoices row but never applies payment.';
comment on table public.commercial_billing_lines is
  'Traceable commercial invoice-draft sources. V2.2A derives visit charges from explicit FIXED_PER_VISIT contract snapshots; adjustments are reserved for a later policy-bound command.';
