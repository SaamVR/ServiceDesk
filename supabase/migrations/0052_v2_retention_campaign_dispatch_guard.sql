-- ServiceDesk AI V2 Wave 2C.4: retention campaign governance and dispatch-time eligibility.
-- Campaigns are opt-in only. The worker must re-check this function after claim and immediately
-- before provider execution so a later unsubscribe/paused/suppressed state wins over queued work.

create table if not exists public.retention_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  channel text not null check (channel in ('EMAIL','WHATSAPP')),
  purpose text not null check (purpose in ('FOLLOW_UP','REVIEW_REQUEST','REFERRAL_NUDGE')),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','COMPLETED')),
  template_key text check (
    template_key is null
    or (length(trim(template_key)) between 1 and 120 and template_key !~ E'[\\r\\n]')
  ),
  subject text check (subject is null or length(subject) <= 200),
  body_text text not null check (length(trim(body_text)) between 1 and 4000),
  body_html text check (body_html is null or length(body_html) <= 12000),
  daily_cap integer not null default 100 check (daily_cap between 1 and 10000),
  per_customer_cap integer not null default 1 check (per_customer_cap between 1 and 100),
  quiet_hours_start time,
  quiet_hours_end time,
  created_by uuid references auth.users(id),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or (quiet_hours_start is not null and quiet_hours_end is not null)
  )
);

create table if not exists public.customer_retention_controls (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null,
  channel text not null check (channel in ('EMAIL','WHATSAPP')),
  status text not null check (status in ('ACTIVE','PAUSED','SUPPRESSED')),
  reason_code text check (
    reason_code is null
    or (length(trim(reason_code)) between 2 and 80 and reason_code ~ '^[A-Z0-9_:-]+$')
  ),
  until_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, customer_id, channel),
  foreign key (workspace_id, customer_id)
    references public.customers(workspace_id, id) on delete cascade,
  check (status <> 'PAUSED' or until_at is null or until_at > created_at)
);

create index if not exists retention_campaign_status_idx
  on public.retention_campaigns(workspace_id, status, channel, updated_at desc);
create index if not exists retention_control_status_idx
  on public.customer_retention_controls(workspace_id, status, channel, updated_at desc);

alter table public.retention_campaigns enable row level security;
alter table public.customer_retention_controls enable row level security;

revoke all on table public.retention_campaigns from public, anon, authenticated;
revoke all on table public.customer_retention_controls from public, anon, authenticated;
grant select on table public.retention_campaigns to authenticated;
grant select on table public.customer_retention_controls to authenticated;
grant select, insert, update, delete on table public.retention_campaigns to service_role;
grant select, insert, update, delete on table public.customer_retention_controls to service_role;

drop policy if exists retention_campaign_staff_select on public.retention_campaigns;
create policy retention_campaign_staff_select
on public.retention_campaigns
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

drop policy if exists retention_control_staff_select on public.customer_retention_controls;
create policy retention_control_staff_select
on public.customer_retention_controls
for select to authenticated
using (public.has_active_membership(workspace_id, array['OWNER','DISPATCHER']::public.membership_role[]));

create or replace function public.servicedesk_check_retention_campaign_dispatch_eligibility(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_event_id uuid := nullif(p_input->>'eventId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_event public.outbox_events%rowtype;
  v_campaign public.retention_campaigns%rowtype;
  v_customer uuid;
  v_channel text;
  v_consent_status text;
  v_control public.customer_retention_controls%rowtype;
  v_verified_contacts integer := 0;
  v_timezone text;
  v_local_now timestamp;
  v_local_time time;
  v_local_day date;
  v_daily_sent integer := 0;
  v_customer_sent integer := 0;
  v_quiet boolean := false;
begin
  if v_workspace is null or v_event_id is null then
    return jsonb_build_object('ok', false, 'code', 'CAMPAIGN_ELIGIBILITY_INPUT_INVALID');
  end if;

  select * into v_event
  from public.outbox_events
  where workspace_id = v_workspace and id = v_event_id;

  if not found or v_event.topic <> 'retention.campaign' or v_event.status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'code', 'CAMPAIGN_OUTBOX_EVENT_INVALID');
  end if;

  begin
    v_customer := nullif(v_event.payload->>'customerId','')::uuid;
    v_channel := upper(trim(v_event.payload->>'channel'));
    select * into v_campaign
    from public.retention_campaigns
    where workspace_id = v_workspace
      and id = nullif(v_event.payload->>'campaignId','')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'CAMPAIGN_OUTBOX_PAYLOAD_INVALID');
  end;

  if v_customer is null or v_channel not in ('EMAIL','WHATSAPP') or not found then
    return jsonb_build_object('ok', false, 'code', 'CAMPAIGN_OUTBOX_PAYLOAD_INVALID');
  end if;

  if v_campaign.status <> 'ACTIVE' then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'CAMPAIGN_NOT_ACTIVE');
  end if;
  if v_campaign.channel <> v_channel then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'CAMPAIGN_CHANNEL_MISMATCH');
  end if;

  if not exists (
    select 1 from public.customers c
    where c.workspace_id = v_workspace
      and c.id = v_customer
      and c.archived_at is null
  ) then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'CAMPAIGN_CUSTOMER_UNAVAILABLE');
  end if;

  select cc.status into v_consent_status
  from public.communication_consents cc
  where cc.workspace_id = v_workspace
    and cc.customer_id = v_customer
    and cc.channel = v_channel
  order by cc.recorded_at desc, cc.created_at desc, cc.id desc
  limit 1;

  if v_consent_status is distinct from 'GRANTED' then
    return jsonb_build_object('ok', true, 'allowed', false, 'code',
      case when v_consent_status = 'REVOKED' then 'RECIPIENT_OPTED_OUT' else 'MISSING_OPT_IN' end
    );
  end if;

  select * into v_control
  from public.customer_retention_controls
  where workspace_id = v_workspace
    and customer_id = v_customer
    and channel = v_channel;

  if found and v_control.status = 'SUPPRESSED' then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'RETENTION_CONTACT_SUPPRESSED');
  end if;

  if found and v_control.status = 'PAUSED'
     and (v_control.until_at is null or v_control.until_at > v_now) then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'RETENTION_CONTACT_PAUSED');
  end if;

  select count(distinct c.id)
  into v_verified_contacts
  from public.customer_contacts c
  where c.workspace_id = v_workspace
    and c.customer_id = v_customer
    and c.verified_at is not null
    and (
      (v_channel = 'EMAIL' and c.kind = 'EMAIL')
      or (v_channel = 'WHATSAPP' and c.kind = 'PHONE')
    );

  if v_verified_contacts = 0 then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'VERIFIED_CONTACT_REQUIRED');
  end if;
  if v_verified_contacts > 1 then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'VERIFIED_CONTACT_AMBIGUOUS');
  end if;

  select timezone into v_timezone
  from public.workspaces
  where id = v_workspace;
  if v_timezone is null then
    return jsonb_build_object('ok', false, 'code', 'WORKSPACE_TIMEZONE_MISSING');
  end if;

  begin
    v_local_now := v_now at time zone v_timezone;
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'code', 'WORKSPACE_TIMEZONE_INVALID');
  end;
  v_local_time := v_local_now::time;
  v_local_day := v_local_now::date;

  if v_campaign.quiet_hours_start is not null then
    if v_campaign.quiet_hours_start = v_campaign.quiet_hours_end then
      v_quiet := true;
    elsif v_campaign.quiet_hours_start < v_campaign.quiet_hours_end then
      v_quiet := v_local_time >= v_campaign.quiet_hours_start
        and v_local_time < v_campaign.quiet_hours_end;
    else
      v_quiet := v_local_time >= v_campaign.quiet_hours_start
        or v_local_time < v_campaign.quiet_hours_end;
    end if;
  end if;

  if v_quiet then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'QUIET_HOURS');
  end if;

  select count(*) into v_daily_sent
  from public.outbox_events o
  where o.workspace_id = v_workspace
    and o.topic = 'retention.campaign'
    and o.status = 'SENT'
    and o.payload->>'campaignId' = v_campaign.id::text
    and (o.sent_at at time zone v_timezone)::date = v_local_day;

  if v_daily_sent >= v_campaign.daily_cap then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'CAMPAIGN_DAILY_CAP');
  end if;

  select count(*) into v_customer_sent
  from public.outbox_events o
  where o.workspace_id = v_workspace
    and o.topic = 'retention.campaign'
    and o.status = 'SENT'
    and o.payload->>'campaignId' = v_campaign.id::text
    and o.payload->>'customerId' = v_customer::text;

  if v_customer_sent >= v_campaign.per_customer_cap then
    return jsonb_build_object('ok', true, 'allowed', false, 'code', 'CAMPAIGN_CUSTOMER_CAP');
  end if;

  return jsonb_build_object(
    'ok', true,
    'allowed', true,
    'code', 'CAMPAIGN_ELIGIBLE',
    'campaignId', v_campaign.id,
    'customerId', v_customer,
    'channel', v_channel
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'CAMPAIGN_ELIGIBILITY_INPUT_INVALID');
end;
$$;



create or replace function public.servicedesk_upsert_retention_campaign(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_campaign_id uuid := nullif(p_input->>'campaignId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_name text := trim(p_input->>'name');
  v_channel text := upper(trim(p_input->>'channel'));
  v_purpose text := upper(trim(p_input->>'purpose'));
  v_status text := upper(trim(p_input->>'status'));
  v_template text := nullif(trim(p_input->>'templateKey'),'');
  v_subject text := nullif(p_input->>'subject','');
  v_text text := trim(p_input->>'bodyText');
  v_html text := nullif(p_input->>'bodyHtml','');
  v_daily integer := coalesce(nullif(p_input->>'dailyCap','')::integer, 100);
  v_per_customer integer := coalesce(nullif(p_input->>'perCustomerCap','')::integer, 1);
  v_quiet_start time := nullif(p_input->>'quietHoursStart','')::time;
  v_quiet_end time := nullif(p_input->>'quietHoursEnd','')::time;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.retention_campaigns%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER'
     or v_name is null or v_channel not in ('EMAIL','WHATSAPP')
     or v_purpose not in ('FOLLOW_UP','REVIEW_REQUEST','REFERRAL_NUDGE')
     or v_status not in ('DRAFT','ACTIVE','PAUSED','COMPLETED')
     or v_text is null
  then
    return jsonb_build_object('ok', false, 'code', 'RETENTION_CAMPAIGN_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_channel = 'EMAIL' and (v_subject is null or v_html is null) then
    return jsonb_build_object('ok', false, 'code', 'RETENTION_CAMPAIGN_EMAIL_CONTENT_REQUIRED');
  end if;

  if v_campaign_id is null then
    insert into public.retention_campaigns(
      workspace_id, name, channel, purpose, status, template_key, subject, body_text, body_html,
      daily_cap, per_customer_cap, quiet_hours_start, quiet_hours_end, created_by, created_at, updated_at
    ) values (
      v_workspace, v_name, v_channel, v_purpose, v_status, v_template, v_subject, v_text, v_html,
      v_daily, v_per_customer, v_quiet_start, v_quiet_end, v_actor_user, v_now, v_now
    )
    returning * into v_row;
  else
    update public.retention_campaigns
    set name = v_name,
        channel = v_channel,
        purpose = v_purpose,
        status = v_status,
        template_key = v_template,
        subject = v_subject,
        body_text = v_text,
        body_html = v_html,
        daily_cap = v_daily,
        per_customer_cap = v_per_customer,
        quiet_hours_start = v_quiet_start,
        quiet_hours_end = v_quiet_end,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace
      and id = v_campaign_id
      and version = v_expected
    returning * into v_row;

    if not found then
      if exists (select 1 from public.retention_campaigns where workspace_id = v_workspace and id = v_campaign_id) then
        return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
      end if;
      return jsonb_build_object('ok', false, 'code', 'RETENTION_CAMPAIGN_NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'campaignId', v_row.id,
    'status', v_row.status,
    'version', v_row.version
  );
exception when check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'RETENTION_CAMPAIGN_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_set_customer_retention_control(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_customer uuid := nullif(p_input->>'customerId','')::uuid;
  v_channel text := upper(trim(p_input->>'channel'));
  v_status text := upper(trim(p_input->>'status'));
  v_reason text := nullif(upper(trim(p_input->>'reasonCode')),'');
  v_until timestamptz := nullif(p_input->>'untilAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.customer_retention_controls%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role not in ('OWNER','DISPATCHER')
     or v_customer is null or v_channel not in ('EMAIL','WHATSAPP')
     or v_status not in ('ACTIVE','PAUSED','SUPPRESSED')
  then
    return jsonb_build_object('ok', false, 'code', 'RETENTION_CONTROL_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, v_actor_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.customers
    where workspace_id = v_workspace and id = v_customer and archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  insert into public.customer_retention_controls(
    workspace_id, customer_id, channel, status, reason_code, until_at,
    version, updated_by, created_at, updated_at
  ) values (
    v_workspace, v_customer, v_channel, v_status, v_reason, v_until,
    1, v_actor_user, v_now, v_now
  )
  on conflict (workspace_id, customer_id, channel) do update
  set status = excluded.status,
      reason_code = excluded.reason_code,
      until_at = excluded.until_at,
      version = public.customer_retention_controls.version + 1,
      updated_by = v_actor_user,
      updated_at = v_now
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'customerId', v_row.customer_id,
    'channel', v_row.channel,
    'status', v_row.status,
    'version', v_row.version
  );
exception when check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'RETENTION_CONTROL_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_queue_retention_campaign_message(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor_user uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_actor_role text := p_input->>'actorRole';
  v_campaign uuid := nullif(p_input->>'campaignId','')::uuid;
  v_customer uuid := nullif(p_input->>'customerId','')::uuid;
  v_idempotency text := nullif(trim(p_input->>'idempotencyKey'),'');
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_channel text;
  v_event public.outbox_events%rowtype;
begin
  if v_workspace is null or v_actor_user is null or v_actor_role <> 'OWNER'
     or v_campaign is null or v_customer is null or v_idempotency is null
  then
    return jsonb_build_object('ok', false, 'code', 'RETENTION_QUEUE_INPUT_INVALID');
  end if;

  if not public.servicedesk_require_staff(v_workspace, v_actor_user, 'OWNER') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select channel into v_channel
  from public.retention_campaigns
  where workspace_id = v_workspace and id = v_campaign and status = 'ACTIVE';

  if not found then
    return jsonb_build_object('ok', false, 'code', 'CAMPAIGN_NOT_ACTIVE');
  end if;

  if not exists (
    select 1 from public.customers
    where workspace_id = v_workspace and id = v_customer and archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_NOT_FOUND');
  end if;

  select * into v_event
  from public.outbox_events
  where workspace_id = v_workspace and idempotency_key = v_idempotency;

  if found then
    if v_event.topic <> 'retention.campaign'
       or v_event.payload->>'campaignId' <> v_campaign::text
       or v_event.payload->>'customerId' <> v_customer::text
    then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'outboxEventId', v_event.id);
  end if;

  insert into public.outbox_events(
    workspace_id, topic, payload, status, attempts, idempotency_key, created_at, updated_at
  ) values (
    v_workspace,
    'retention.campaign',
    jsonb_build_object(
      'campaignId', v_campaign,
      'customerId', v_customer,
      'channel', v_channel
    ),
    'PENDING',
    0,
    v_idempotency,
    v_now,
    v_now
  )
  returning * into v_event;

  return jsonb_build_object('ok', true, 'duplicate', false, 'outboxEventId', v_event.id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'RETENTION_QUEUE_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_resolve_retention_campaign_intent(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_event_id uuid := nullif(p_input->>'eventId','')::uuid;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_eligibility jsonb;
  v_event public.outbox_events%rowtype;
  v_campaign public.retention_campaigns%rowtype;
  v_customer uuid;
  v_recipient text;
  v_contact_count bigint;
begin
  v_eligibility := public.servicedesk_check_retention_campaign_dispatch_eligibility(
    jsonb_build_object('workspaceId', v_workspace, 'eventId', v_event_id, 'now', v_now)
  );

  if coalesce((v_eligibility->>'ok')::boolean, false) is false then
    return v_eligibility;
  end if;
  if coalesce((v_eligibility->>'allowed')::boolean, false) is false then
    return v_eligibility;
  end if;

  select * into v_event
  from public.outbox_events
  where workspace_id = v_workspace and id = v_event_id and topic = 'retention.campaign';

  v_customer := nullif(v_event.payload->>'customerId','')::uuid;

  select * into v_campaign
  from public.retention_campaigns
  where workspace_id = v_workspace
    and id = nullif(v_event.payload->>'campaignId','')::uuid;

  select count(*), min(c.value)
  into v_contact_count, v_recipient
  from public.customer_contacts c
  where c.workspace_id = v_workspace
    and c.customer_id = v_customer
    and c.verified_at is not null
    and (
      (v_campaign.channel = 'EMAIL' and c.kind = 'EMAIL')
      or (v_campaign.channel = 'WHATSAPP' and c.kind = 'PHONE')
    );

  if v_contact_count <> 1 or v_recipient is null then
    return jsonb_build_object('ok', true, 'allowed', false, 'code',
      case when v_contact_count > 1 then 'VERIFIED_CONTACT_AMBIGUOUS' else 'VERIFIED_CONTACT_REQUIRED' end
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'allowed', true,
    'eventId', v_event.id,
    'workspaceId', v_workspace,
    'campaignId', v_campaign.id,
    'customerId', v_customer,
    'channel', v_campaign.channel,
    'campaignPurpose', v_campaign.purpose,
    'recipientRef', v_recipient,
    'templateKey', v_campaign.template_key,
    'subject', v_campaign.subject,
    'text', v_campaign.body_text,
    'html', v_campaign.body_html,
    'idempotencyKey', v_event.idempotency_key
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'RETENTION_INTENT_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_upsert_retention_campaign(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_set_customer_retention_control(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_queue_retention_campaign_message(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_resolve_retention_campaign_intent(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_upsert_retention_campaign(jsonb) to service_role;
grant execute on function public.servicedesk_set_customer_retention_control(jsonb) to service_role;
grant execute on function public.servicedesk_queue_retention_campaign_message(jsonb) to service_role;
grant execute on function public.servicedesk_resolve_retention_campaign_intent(jsonb) to service_role;

comment on function public.servicedesk_queue_retention_campaign_message(jsonb) is
  'Owner-only queue command. Stores campaign/customer/channel identifiers only; recipient address and message body are resolved authoritatively at dispatch time.';
comment on function public.servicedesk_resolve_retention_campaign_intent(jsonb) is
  'Service-role authoritative campaign intent resolution. Re-runs dispatch eligibility and resolves exactly one verified channel contact immediately before provider dispatch.';

revoke all on function public.servicedesk_check_retention_campaign_dispatch_eligibility(jsonb)
from public, anon, authenticated;
grant execute on function public.servicedesk_check_retention_campaign_dispatch_eligibility(jsonb)
to service_role;

comment on function public.servicedesk_check_retention_campaign_dispatch_eligibility(jsonb) is
  'Dispatch-time guard for retention campaign outbox events. Rechecks current campaign state, latest channel consent, contact suppression/pause, verified contact, quiet hours and caps immediately before provider execution.';
