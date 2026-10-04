-- ServiceDesk AI V1 INT9 / E09: reporting, platform billing separation, server-side usage
-- Customer cleaning invoices/ledger remain separate from ServiceDesk platform subscription billing.

create table if not exists public.platform_subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan text not null check (plan in ('TRIAL','STARTER','GROWTH')),
  status text not null check (status in ('TRIALING','ACTIVE','PAST_DUE','CANCELLED')),
  provider_mode text not null check (provider_mode in ('SANDBOX','LIVE')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_subscription_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (length(trim(provider)) > 0),
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  event_kind text not null check (length(trim(event_kind)) > 0),
  plan text not null check (plan in ('TRIAL','STARTER','GROWTH')),
  status text not null check (status in ('TRIALING','ACTIVE','PAST_DUE','CANCELLED')),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency char(3),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (provider, provider_event_id),
  check ((amount_minor is null and currency is null) or (amount_minor is not null and currency is not null))
);

create table if not exists public.workspace_usage_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null check (metric in ('AI_ACTIONS','OUTBOUND_MESSAGES','TEAM_MEMBERS','CONNECTED_INTEGRATIONS')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, metric, period_start, period_end),
  check (period_end > period_start)
);

create table if not exists public.workspace_usage_limits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null check (metric in ('AI_ACTIONS','OUTBOUND_MESSAGES','TEAM_MEMBERS','CONNECTED_INTEGRATIONS')),
  limit_value bigint check (limit_value is null or limit_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, metric)
);

create index if not exists platform_subscription_ledger_workspace_idx
  on public.platform_subscription_ledger(workspace_id, occurred_at desc);
create index if not exists workspace_usage_counters_metric_idx
  on public.workspace_usage_counters(workspace_id, metric, period_start desc);

alter table public.platform_subscriptions enable row level security;
alter table public.platform_subscription_ledger enable row level security;
alter table public.workspace_usage_counters enable row level security;
alter table public.workspace_usage_limits enable row level security;

drop policy if exists platform_subscriptions_owner_select on public.platform_subscriptions;
create policy platform_subscriptions_owner_select on public.platform_subscriptions
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[]));

drop policy if exists platform_subscription_ledger_owner_select on public.platform_subscription_ledger;
create policy platform_subscription_ledger_owner_select on public.platform_subscription_ledger
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[]));

drop policy if exists workspace_usage_counters_owner_select on public.workspace_usage_counters;
create policy workspace_usage_counters_owner_select on public.workspace_usage_counters
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[]));

drop policy if exists workspace_usage_limits_owner_select on public.workspace_usage_limits;
create policy workspace_usage_limits_owner_select on public.workspace_usage_limits
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER']::public.membership_role[]));

create or replace function public.servicedesk_platform_subscription_json(p_sub public.platform_subscriptions)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_sub.workspace_id is null then null else jsonb_build_object(
    'workspaceId', p_sub.workspace_id,
    'plan', p_sub.plan,
    'status', p_sub.status,
    'providerMode', p_sub.provider_mode,
    'trialEndsAt', p_sub.trial_ends_at,
    'currentPeriodEndsAt', p_sub.current_period_ends_at,
    'version', p_sub.version,
    'updatedAt', p_sub.updated_at
  ) end;
$$;

create or replace function public.servicedesk_usage_period_start(p_now timestamptz)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select date_trunc('month', p_now);
$$;

create or replace function public.servicedesk_usage_period_end(p_now timestamptz)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select date_trunc('month', p_now) + interval '1 month';
$$;

create or replace function public.servicedesk_usage_metric_json(
  p_workspace uuid,
  p_metric text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_used bigint default null
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_limit bigint;
  v_used bigint;
begin
  select limit_value into v_limit
  from public.workspace_usage_limits
  where workspace_id = p_workspace and metric = p_metric;

  if p_metric = 'TEAM_MEMBERS' and p_used is null then
    select count(*)::bigint into v_used
    from public.memberships
    where workspace_id = p_workspace and status = 'ACTIVE';
  elsif p_used is not null then
    v_used := p_used;
  else
    select coalesce(sum(used), 0)::bigint into v_used
    from public.workspace_usage_counters
    where workspace_id = p_workspace
      and metric = p_metric
      and period_start = p_period_start
      and period_end = p_period_end;
  end if;

  return jsonb_build_object(
    'metric', p_metric,
    'used', coalesce(v_used, 0),
    'limit', v_limit,
    'state', case
      when v_limit is null then 'UNLIMITED'
      when coalesce(v_used, 0) >= v_limit then 'LIMIT_REACHED'
      else 'WITHIN_LIMIT'
    end
  );
end;
$$;

create or replace function public.servicedesk_check_usage(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_metric text := p_input->>'metric';
  v_requested bigint := coalesce((p_input->>'requested')::bigint, 1);
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_period_start timestamptz := coalesce((p_input->>'periodStart')::timestamptz, public.servicedesk_usage_period_start(v_now));
  v_period_end timestamptz := coalesce((p_input->>'periodEnd')::timestamptz, public.servicedesk_usage_period_end(v_now));
  v_limit bigint;
  v_used bigint;
begin
  if v_workspace is null or v_metric is null or v_requested <= 0 or v_period_end <= v_period_start then
    return jsonb_build_object('ok', false, 'code', 'USAGE_INPUT_INVALID');
  end if;
  if v_metric not in ('AI_ACTIONS','OUTBOUND_MESSAGES','TEAM_MEMBERS','CONNECTED_INTEGRATIONS') then
    return jsonb_build_object('ok', false, 'code', 'USAGE_METRIC_INVALID');
  end if;

  select limit_value into v_limit
  from public.workspace_usage_limits
  where workspace_id = v_workspace and metric = v_metric;

  select coalesce(sum(used), 0)::bigint into v_used
  from public.workspace_usage_counters
  where workspace_id = v_workspace
    and metric = v_metric
    and period_start = v_period_start
    and period_end = v_period_end;

  if v_limit is not null and v_used + v_requested > v_limit then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'USAGE_LIMIT_REACHED', 'metric', v_metric, 'used', v_used, 'limit', v_limit);
  end if;

  return jsonb_build_object('ok', true, 'allowed', true, 'metric', v_metric, 'used', v_used, 'limit', v_limit, 'state', case when v_limit is null then 'UNLIMITED' else 'WITHIN_LIMIT' end);
end;
$$;

create or replace function public.servicedesk_consume_usage(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_metric text := p_input->>'metric';
  v_requested bigint := coalesce((p_input->>'requested')::bigint, 1);
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_period_start timestamptz := coalesce((p_input->>'periodStart')::timestamptz, public.servicedesk_usage_period_start(v_now));
  v_period_end timestamptz := coalesce((p_input->>'periodEnd')::timestamptz, public.servicedesk_usage_period_end(v_now));
  v_limit bigint;
  v_used bigint;
begin
  if v_workspace is null or v_metric is null or v_requested <= 0 or v_period_end <= v_period_start then
    return jsonb_build_object('ok', false, 'code', 'USAGE_INPUT_INVALID');
  end if;
  if v_metric not in ('AI_ACTIONS','OUTBOUND_MESSAGES','TEAM_MEMBERS','CONNECTED_INTEGRATIONS') then
    return jsonb_build_object('ok', false, 'code', 'USAGE_METRIC_INVALID');
  end if;

  insert into public.workspace_usage_counters(id, workspace_id, metric, period_start, period_end, used, updated_at)
  values (gen_random_uuid(), v_workspace, v_metric, v_period_start, v_period_end, 0, v_now)
  on conflict (workspace_id, metric, period_start, period_end) do nothing;

  select limit_value into v_limit
  from public.workspace_usage_limits
  where workspace_id = v_workspace and metric = v_metric
  for update;

  select used into v_used
  from public.workspace_usage_counters
  where workspace_id = v_workspace
    and metric = v_metric
    and period_start = v_period_start
    and period_end = v_period_end
  for update;

  if v_limit is not null and v_used + v_requested > v_limit then
    return jsonb_build_object('ok', false, 'code', 'USAGE_LIMIT_REACHED', 'metric', v_metric, 'used', v_used, 'limit', v_limit);
  end if;

  update public.workspace_usage_counters
  set used = used + v_requested,
      updated_at = v_now
  where workspace_id = v_workspace
    and metric = v_metric
    and period_start = v_period_start
    and period_end = v_period_end
  returning used into v_used;

  return jsonb_build_object('ok', true, 'metric', v_metric, 'used', v_used, 'limit', v_limit, 'state', case when v_limit is null then 'UNLIMITED' when v_used >= v_limit then 'LIMIT_REACHED' else 'WITHIN_LIMIT' end);
end;
$$;

create or replace function public.servicedesk_apply_verified_platform_subscription(p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_event->>'workspaceId')::uuid;
  v_provider text := nullif(trim(p_event->>'provider'), '');
  v_provider_event_id text := nullif(trim(p_event->>'providerEventId'), '');
  v_event_kind text := nullif(trim(p_event->>'eventKind'), '');
  v_plan text := p_event->>'plan';
  v_status text := p_event->>'status';
  v_provider_mode text := p_event->>'providerMode';
  v_amount bigint := nullif(p_event->>'amountMinor','')::bigint;
  v_currency char(3) := nullif(upper(p_event->>'currency'), '')::char(3);
  v_occurred timestamptz := (p_event->>'occurredAt')::timestamptz;
  v_trial_ends timestamptz := nullif(p_event->>'trialEndsAt','')::timestamptz;
  v_period_ends timestamptz := nullif(p_event->>'currentPeriodEndsAt','')::timestamptz;
  v_existing public.platform_subscription_ledger%rowtype;
  v_sub public.platform_subscriptions%rowtype;
begin
  if v_workspace is null or v_provider is null or v_provider_event_id is null or v_event_kind is null
     or v_plan is null or v_status is null or v_provider_mode is null or v_occurred is null then
    return jsonb_build_object('ok', false, 'code', 'PLATFORM_SUBSCRIPTION_EVENT_INVALID');
  end if;
  if v_plan not in ('TRIAL','STARTER','GROWTH') or v_status not in ('TRIALING','ACTIVE','PAST_DUE','CANCELLED') or v_provider_mode not in ('SANDBOX','LIVE') then
    return jsonb_build_object('ok', false, 'code', 'PLATFORM_SUBSCRIPTION_VALUE_INVALID');
  end if;
  if v_provider_mode = 'LIVE' and upper(v_provider) in ('STRIPE','PAYMENT') then
    return jsonb_build_object('ok', false, 'code', 'LIVE_PLATFORM_PAYMENT_BLOCKED');
  end if;
  if (v_amount is null) <> (v_currency is null) then
    return jsonb_build_object('ok', false, 'code', 'PLATFORM_AMOUNT_CURRENCY_MISMATCH');
  end if;

  select * into v_existing
  from public.platform_subscription_ledger
  where provider = v_provider and provider_event_id = v_provider_event_id
  limit 1;

  if found then
    select * into v_sub from public.platform_subscriptions where workspace_id = v_existing.workspace_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'subscription', public.servicedesk_platform_subscription_json(v_sub), 'ledgerId', v_existing.id);
  end if;

  insert into public.platform_subscriptions(
    workspace_id, plan, status, provider_mode, trial_ends_at, current_period_ends_at, version, updated_at
  ) values (
    v_workspace, v_plan, v_status, v_provider_mode, v_trial_ends, v_period_ends, 1, now()
  )
  on conflict (workspace_id) do update
  set plan = excluded.plan,
      status = excluded.status,
      provider_mode = excluded.provider_mode,
      trial_ends_at = excluded.trial_ends_at,
      current_period_ends_at = excluded.current_period_ends_at,
      version = public.platform_subscriptions.version + 1,
      updated_at = now()
  returning * into v_sub;

  insert into public.platform_subscription_ledger(
    id, workspace_id, provider, provider_event_id, event_kind, plan, status, amount_minor, currency, occurred_at, created_at
  ) values (
    gen_random_uuid(), v_workspace, v_provider, v_provider_event_id, v_event_kind, v_plan, v_status, v_amount, v_currency, v_occurred, now()
  ) returning * into v_existing;

  return jsonb_build_object('ok', true, 'duplicate', false, 'subscription', public.servicedesk_platform_subscription_json(v_sub), 'ledgerId', v_existing.id);
end;
$$;

create or replace function public.servicedesk_read_reporting_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_from timestamptz := nullif(p_input->>'from','')::timestamptz;
  v_to timestamptz := nullif(p_input->>'to','')::timestamptz;
  v_currency char(3);
  v_request_count bigint;
  v_booked_count bigint;
  v_collected bigint;
  v_outstanding bigint;
  v_service_minutes bigint;
  v_buffer_minutes bigint;
  v_open_attention bigint;
  v_unresolved_quality bigint;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'REPORTING_INPUT_INVALID');
  end if;
  if v_actor_role not in ('OWNER','DISPATCHER') or not exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role in ('OWNER','DISPATCHER')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_from is not null and v_to is not null and v_from > v_to then
    return jsonb_build_object('ok', false, 'code', 'REPORTING_RANGE_INVALID');
  end if;

  select currency into v_currency from public.workspaces where id = v_workspace;

  select count(*) into v_request_count
  from public.requests r
  where r.workspace_id = v_workspace
    and (v_from is null or r.created_at >= v_from)
    and (v_to is null or r.created_at < v_to);

  select count(*) into v_booked_count
  from public.requests r
  where r.workspace_id = v_workspace
    and r.status = 'BOOKED'
    and (v_from is null or r.created_at >= v_from)
    and (v_to is null or r.created_at < v_to);

  select coalesce(sum(le.amount_minor),0) into v_collected
  from public.ledger_entries le
  where le.workspace_id = v_workspace
    and le.resource_type = 'invoice'
    and le.direction = 'CREDIT'
    and (v_from is null or le.occurred_at >= v_from)
    and (v_to is null or le.occurred_at < v_to);

  select coalesce(sum(i.balance_minor),0) into v_outstanding
  from public.invoices i
  where i.workspace_id = v_workspace
    and i.status <> 'VOID';

  select
    coalesce(sum(coalesce(q.duration_minutes, greatest(0, floor(extract(epoch from (v.ends_at - v.starts_at)) / 60)::int))), 0),
    coalesce(sum(coalesce(q.buffer_minutes, 0)), 0)
  into v_service_minutes, v_buffer_minutes
  from public.visits v
  left join public.quotes q on q.workspace_id = v.workspace_id and q.id = v.quote_id
  where v.workspace_id = v_workspace
    and v.status in ('SCHEDULED','ASSIGNED','EN_ROUTE','IN_PROGRESS','NEEDS_REVIEW','COMPLETED')
    and (v_from is null or v.starts_at >= v_from)
    and (v_to is null or v.starts_at < v_to);

  select count(*) into v_open_attention
  from public.attention_items a
  where a.workspace_id = v_workspace and a.status = 'OPEN';

  select count(*) into v_unresolved_quality
  from public.quality_cases qc
  where qc.workspace_id = v_workspace and qc.state <> 'RESOLVED';

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'from', v_from,
      'to', v_to,
      'requestCount', coalesce(v_request_count,0),
      'bookedRequestCount', coalesce(v_booked_count,0),
      'conversionRateBps', case when coalesce(v_request_count,0) = 0 then null else floor((v_booked_count::numeric / v_request_count::numeric) * 10000)::int end,
      'collectedMinor', coalesce(v_collected,0),
      'outstandingMinor', coalesce(v_outstanding,0),
      'currency', v_currency,
      'scheduledServiceMinutes', coalesce(v_service_minutes,0),
      'scheduledBufferMinutes', coalesce(v_buffer_minutes,0),
      'openAttentionCount', coalesce(v_open_attention,0),
      'unresolvedQualityCount', coalesce(v_unresolved_quality,0),
      'generatedAt', now()
    )
  );
end;
$$;

create or replace function public.servicedesk_read_platform_billing_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_now timestamptz := coalesce((p_input->>'now')::timestamptz, now());
  v_sub public.platform_subscriptions%rowtype;
  v_start timestamptz := public.servicedesk_usage_period_start(v_now);
  v_end timestamptz := public.servicedesk_usage_period_end(v_now);
  v_usage jsonb;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'BILLING_INPUT_INVALID');
  end if;
  if v_actor_role <> 'OWNER' or not exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role = 'OWNER'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.platform_subscriptions(workspace_id, plan, status, provider_mode, trial_ends_at, current_period_ends_at, version, updated_at)
  values (v_workspace, 'TRIAL', 'TRIALING', 'SANDBOX', v_now + interval '14 days', v_now + interval '14 days', 1, v_now)
  on conflict (workspace_id) do nothing;

  select * into v_sub from public.platform_subscriptions where workspace_id = v_workspace;

  v_usage := jsonb_build_array(
    public.servicedesk_usage_metric_json(v_workspace, 'AI_ACTIONS', v_start, v_end),
    public.servicedesk_usage_metric_json(v_workspace, 'OUTBOUND_MESSAGES', v_start, v_end),
    public.servicedesk_usage_metric_json(v_workspace, 'TEAM_MEMBERS', v_start, v_end),
    public.servicedesk_usage_metric_json(v_workspace, 'CONNECTED_INTEGRATIONS', v_start, v_end)
  );

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'subscription', public.servicedesk_platform_subscription_json(v_sub),
      'usage', v_usage
    )
  );
end;
$$;

create or replace function public.servicedesk_read_owner_settings_snapshot(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := (p_input->>'workspaceId')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_services jsonb;
  v_members jsonb;
  v_invitations jsonb;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'OWNER_SETTINGS_INPUT_INVALID');
  end if;
  if v_actor_role <> 'OWNER' or not exists (
    select 1 from public.memberships where workspace_id = v_workspace and user_id = v_actor_user and status = 'ACTIVE' and role = 'OWNER'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', sc.code, 'label', sc.name, 'enabled', sc.active) order by sc.code), '[]'::jsonb)
  into v_services
  from public.service_catalog sc
  where sc.workspace_id = v_workspace;

  select coalesce(jsonb_agg(jsonb_build_object('userId', m.user_id, 'role', m.role::text, 'active', m.status = 'ACTIVE') order by m.created_at), '[]'::jsonb)
  into v_members
  from public.memberships m
  where m.workspace_id = v_workspace;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'role', i.role::text,
    'state', case
      when i.revoked_at is not null then 'REVOKED'
      when i.accepted_at is not null then 'ACCEPTED'
      when i.expires_at < now() then 'REVOKED'
      else 'PENDING'
    end,
    'createdAt', i.created_at
  ) order by i.created_at), '[]'::jsonb)
  into v_invitations
  from public.invitations i
  where i.workspace_id = v_workspace;

  return jsonb_build_object(
    'ok', true,
    'snapshot', jsonb_build_object(
      'workspaceId', v_workspace,
      'services', v_services,
      'members', v_members,
      'invitations', v_invitations
    )
  );
end;
$$;

revoke execute on function public.servicedesk_check_usage(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_consume_usage(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_apply_verified_platform_subscription(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_read_reporting_snapshot(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_read_platform_billing_snapshot(jsonb) from public, anon, authenticated;
revoke execute on function public.servicedesk_read_owner_settings_snapshot(jsonb) from public, anon, authenticated;

grant execute on function public.servicedesk_check_usage(jsonb) to service_role;
grant execute on function public.servicedesk_consume_usage(jsonb) to service_role;
grant execute on function public.servicedesk_apply_verified_platform_subscription(jsonb) to service_role;
grant execute on function public.servicedesk_read_reporting_snapshot(jsonb) to service_role;
grant execute on function public.servicedesk_read_platform_billing_snapshot(jsonb) to service_role;
grant execute on function public.servicedesk_read_owner_settings_snapshot(jsonb) to service_role;
