-- ServiceDesk AI V2 Wave 2D.1: branch-scoped resources.
-- Depends on 0053_v2_multibranch_core.sql.
-- Provider bindings store opaque resource references only; no OAuth tokens, API keys or message credentials.

create table if not exists public.branch_service_zones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  branch_id uuid not null,
  code text not null check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  country_code char(2) not null,
  postal_prefixes text[] not null default '{}',
  active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, branch_id, code),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete cascade,
  check (cardinality(postal_prefixes) <= 200)
);

create table if not exists public.branch_provider_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  branch_id uuid not null,
  provider text not null check (provider in ('GOOGLE_CALENDAR','WHATSAPP','EMAIL','VOICE')),
  purpose text not null check (purpose in ('CALENDAR','SENDER','MAILBOX','NUMBER')),
  crew_id uuid,
  resource_ref text not null check (
    length(trim(resource_ref)) between 3 and 240
    and resource_ref !~* '^(https?://|data:)'
    and resource_ref !~ E'[\\r\\n]'
  ),
  active boolean not null default true,
  verified_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete cascade,
  foreign key (workspace_id, crew_id)
    references public.crews(workspace_id, id) on delete cascade,
  check (
    (provider = 'GOOGLE_CALENDAR' and purpose = 'CALENDAR')
    or (provider = 'WHATSAPP' and purpose = 'SENDER')
    or (provider = 'EMAIL' and purpose = 'MAILBOX')
    or (provider = 'VOICE' and purpose = 'NUMBER')
  )
);

create unique index if not exists branch_provider_global_binding_uq
  on public.branch_provider_bindings(workspace_id, branch_id, provider, purpose)
  where crew_id is null and active;

create unique index if not exists branch_provider_crew_binding_uq
  on public.branch_provider_bindings(workspace_id, branch_id, provider, purpose, crew_id)
  where crew_id is not null and active;

create table if not exists public.branch_price_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  branch_id uuid not null,
  rate_card_id uuid not null,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, branch_id)
    references public.workspace_branches(workspace_id, id) on delete cascade,
  foreign key (workspace_id, rate_card_id)
    references public.rate_cards(workspace_id, id) on delete restrict,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists branch_price_books_one_active_idx
  on public.branch_price_books(workspace_id, branch_id)
  where active;

create index if not exists branch_service_zones_active_idx
  on public.branch_service_zones(workspace_id, branch_id, active, code);
create index if not exists branch_provider_bindings_active_idx
  on public.branch_provider_bindings(workspace_id, branch_id, provider, active);

alter table public.branch_service_zones enable row level security;
alter table public.branch_provider_bindings enable row level security;
alter table public.branch_price_books enable row level security;

revoke all on table public.branch_service_zones from public, anon, authenticated;
revoke all on table public.branch_provider_bindings from public, anon, authenticated;
revoke all on table public.branch_price_books from public, anon, authenticated;

grant select on table public.branch_service_zones to authenticated;
grant select on table public.branch_price_books to authenticated;
grant select, insert, update, delete on table public.branch_service_zones to service_role;
grant select, insert, update, delete on table public.branch_provider_bindings to service_role;
grant select, insert, update, delete on table public.branch_price_books to service_role;

create policy branch_service_zones_staff_select on public.branch_service_zones
for select to authenticated
using (
  public.servicedesk_has_branch_access(
    workspace_id,
    branch_id,
    array['OWNER','DISPATCHER']::public.membership_role[]
  )
);

create policy branch_price_books_staff_select on public.branch_price_books
for select to authenticated
using (
  public.servicedesk_has_branch_access(
    workspace_id,
    branch_id,
    array['OWNER','DISPATCHER']::public.membership_role[]
  )
);

create or replace function public.servicedesk_upsert_branch_service_zone(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_zone uuid := nullif(p_input->>'zoneId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_code text := upper(trim(p_input->>'code'));
  v_name text := trim(p_input->>'name');
  v_country char(2) := upper(trim(p_input->>'countryCode'))::char(2);
  v_prefixes text[] := coalesce(
    array(select upper(trim(value)) from jsonb_array_elements_text(coalesce(p_input->'postalPrefixes','[]'::jsonb)) value where trim(value) <> ''),
    '{}'::text[]
  );
  v_active boolean := coalesce((p_input->>'active')::boolean, true);
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.branch_service_zones%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER' or v_branch is null
     or v_code is null or v_name is null or v_country is null
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_ZONE_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_has_branch_access(
    v_workspace, v_branch, v_actor, v_role, array['OWNER']::public.membership_role[]
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_zone is null then
    insert into public.branch_service_zones(
      workspace_id, branch_id, code, name, country_code, postal_prefixes, active, created_at, updated_at
    ) values (
      v_workspace, v_branch, v_code, v_name, v_country, v_prefixes, v_active, v_now, v_now
    )
    returning * into v_row;
  else
    update public.branch_service_zones
    set code = v_code,
        name = v_name,
        country_code = v_country,
        postal_prefixes = v_prefixes,
        active = v_active,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace
      and branch_id = v_branch
      and id = v_zone
      and version = v_expected
    returning * into v_row;

    if not found then
      return jsonb_build_object('ok', false, 'code',
        case when exists (
          select 1 from public.branch_service_zones
          where workspace_id = v_workspace and branch_id = v_branch and id = v_zone
        ) then 'VERSION_CONFLICT' else 'BRANCH_ZONE_NOT_FOUND' end
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'zoneId', v_row.id,
    'branchId', v_row.branch_id,
    'version', v_row.version,
    'active', v_row.active
  );
exception when unique_violation or check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_ZONE_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_upsert_branch_provider_binding(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_binding uuid := nullif(p_input->>'bindingId','')::uuid;
  v_expected bigint := nullif(p_input->>'expectedVersion','')::bigint;
  v_provider text := upper(trim(p_input->>'provider'));
  v_purpose text := upper(trim(p_input->>'purpose'));
  v_crew uuid := nullif(p_input->>'crewId','')::uuid;
  v_ref text := nullif(trim(p_input->>'resourceRef'),'');
  v_active boolean := coalesce((p_input->>'active')::boolean, true);
  v_verified timestamptz := nullif(p_input->>'verifiedAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.branch_provider_bindings%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_branch is null or v_ref is null
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_PROVIDER_BINDING_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_has_branch_access(
    v_workspace, v_branch, v_actor, v_role, array['OWNER']::public.membership_role[]
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_crew is not null and not exists (
    select 1 from public.crews c
    where c.workspace_id = v_workspace
      and c.id = v_crew
      and c.branch_id = v_branch
      and c.active
  ) then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_CREW_MISMATCH');
  end if;

  if v_binding is null then
    insert into public.branch_provider_bindings(
      workspace_id, branch_id, provider, purpose, crew_id, resource_ref,
      active, verified_at, created_at, updated_at
    ) values (
      v_workspace, v_branch, v_provider, v_purpose, v_crew, v_ref,
      v_active, v_verified, v_now, v_now
    )
    returning * into v_row;
  else
    update public.branch_provider_bindings
    set provider = v_provider,
        purpose = v_purpose,
        crew_id = v_crew,
        resource_ref = v_ref,
        active = v_active,
        verified_at = v_verified,
        version = version + 1,
        updated_at = v_now
    where workspace_id = v_workspace
      and branch_id = v_branch
      and id = v_binding
      and version = v_expected
    returning * into v_row;

    if not found then
      return jsonb_build_object('ok', false, 'code',
        case when exists (
          select 1 from public.branch_provider_bindings
          where workspace_id = v_workspace and branch_id = v_branch and id = v_binding
        ) then 'VERSION_CONFLICT' else 'BRANCH_PROVIDER_BINDING_NOT_FOUND' end
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'bindingId', v_row.id,
    'branchId', v_row.branch_id,
    'provider', v_row.provider,
    'purpose', v_row.purpose,
    'version', v_row.version,
    'active', v_row.active,
    'verified', v_row.verified_at is not null
  );
exception when unique_violation or check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_PROVIDER_BINDING_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_set_branch_price_book(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_rate_card uuid := nullif(p_input->>'rateCardId','')::uuid;
  v_starts timestamptz := nullif(p_input->>'startsAt','')::timestamptz;
  v_ends timestamptz := nullif(p_input->>'endsAt','')::timestamptz;
  v_now timestamptz := coalesce(nullif(p_input->>'now','')::timestamptz, now());
  v_row public.branch_price_books%rowtype;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_branch is null or v_rate_card is null
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_PRICE_BOOK_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_has_branch_access(
    v_workspace, v_branch, v_actor, v_role, array['OWNER']::public.membership_role[]
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from public.rate_cards rc
    where rc.workspace_id = v_workspace and rc.id = v_rate_card
  ) then
    return jsonb_build_object('ok', false, 'code', 'RATE_CARD_NOT_FOUND');
  end if;

  update public.branch_price_books
  set active = false,
      version = version + 1,
      updated_at = v_now
  where workspace_id = v_workspace
    and branch_id = v_branch
    and active;

  insert into public.branch_price_books(
    workspace_id, branch_id, rate_card_id, active, starts_at, ends_at,
    created_by, created_at, updated_at
  ) values (
    v_workspace, v_branch, v_rate_card, true, v_starts, v_ends,
    v_actor, v_now, v_now
  )
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'priceBookId', v_row.id,
    'branchId', v_row.branch_id,
    'rateCardId', v_row.rate_card_id,
    'version', v_row.version
  );
exception when unique_violation or check_violation or invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_PRICE_BOOK_INPUT_INVALID');
end;
$$;

create or replace function public.servicedesk_read_branch_resource_summary(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_branch uuid := nullif(p_input->>'branchId','')::uuid;
  v_branch_row public.workspace_branches%rowtype;
begin
  if v_workspace is null or v_actor is null or v_branch is null
     or v_role not in ('OWNER','DISPATCHER')
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_RESOURCE_READ_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_has_branch_access(
    v_workspace, v_branch, v_actor, v_role, array['OWNER','DISPATCHER']::public.membership_role[]
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_branch_row
  from public.workspace_branches
  where workspace_id = v_workspace and id = v_branch and active;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'ok', true,
    'branch', jsonb_build_object(
      'id', v_branch_row.id,
      'code', v_branch_row.code,
      'name', v_branch_row.name,
      'timezone', v_branch_row.timezone,
      'currency', v_branch_row.currency,
      'isDefault', v_branch_row.is_default
    ),
    'serviceZones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id,
        'code', z.code,
        'name', z.name,
        'countryCode', z.country_code,
        'postalPrefixes', z.postal_prefixes,
        'active', z.active,
        'version', z.version
      ) order by z.code)
      from public.branch_service_zones z
      where z.workspace_id = v_workspace and z.branch_id = v_branch
    ), '[]'::jsonb),
    'providerReadiness', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', p.provider,
        'purpose', p.purpose,
        'crewId', p.crew_id,
        'active', p.active,
        'verified', p.verified_at is not null,
        'version', p.version
      ) order by p.provider, p.purpose, p.crew_id nulls first)
      from public.branch_provider_bindings p
      where p.workspace_id = v_workspace and p.branch_id = v_branch
    ), '[]'::jsonb),
    'priceBook', (
      select jsonb_build_object(
        'id', pb.id,
        'rateCardId', pb.rate_card_id,
        'rateVersion', rc.version,
        'currency', rc.currency,
        'startsAt', pb.starts_at,
        'endsAt', pb.ends_at,
        'version', pb.version
      )
      from public.branch_price_books pb
      join public.rate_cards rc
        on rc.workspace_id = pb.workspace_id and rc.id = pb.rate_card_id
      where pb.workspace_id = v_workspace
        and pb.branch_id = v_branch
        and pb.active
        and (pb.starts_at is null or pb.starts_at <= now())
        and (pb.ends_at is null or pb.ends_at > now())
      order by pb.created_at desc
      limit 1
    )
  );
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_RESOURCE_READ_INPUT_INVALID');
end;
$$;

-- branch_provider_bindings intentionally has no authenticated SELECT grant/policy:
-- staff receive only redacted readiness through servicedesk_read_branch_resource_summary.


create or replace function public.servicedesk_read_branch_comparison_report(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := nullif(p_input->>'workspaceId','')::uuid;
  v_actor uuid := nullif(p_input->>'actorUserId','')::uuid;
  v_role text := p_input->>'actorRole';
  v_from_date date := nullif(p_input->>'fromDate','')::date;
  v_to_date date := nullif(p_input->>'toDate','')::date;
begin
  if v_workspace is null or v_actor is null or v_role <> 'OWNER'
     or v_from_date is null or v_to_date is null or v_to_date < v_from_date
     or (v_to_date - v_from_date) > 366
  then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_REPORT_INPUT_INVALID');
  end if;

  if not public.servicedesk_actor_is_workspace_owner(v_workspace, v_actor, v_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return jsonb_build_object(
    'ok', true,
    'fromDate', v_from_date,
    'toDate', v_to_date,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branchId', b.id,
        'code', b.code,
        'name', b.name,
        'timezone', b.timezone,
        'currency', b.currency,
        'requestCount', (
          select count(*)
          from public.requests r
          where r.workspace_id = b.workspace_id
            and r.branch_id = b.id
            and r.created_at >= (v_from_date::timestamp at time zone b.timezone)
            and r.created_at < ((v_to_date + 1)::timestamp at time zone b.timezone)
        ),
        'scheduledVisitCount', (
          select count(*)
          from public.visits v
          where v.workspace_id = b.workspace_id
            and v.branch_id = b.id
            and v.starts_at >= (v_from_date::timestamp at time zone b.timezone)
            and v.starts_at < ((v_to_date + 1)::timestamp at time zone b.timezone)
            and v.status <> 'CANCELLED'
        ),
        'paidInvoiceCount', (
          select count(*)
          from public.invoices i
          left join public.visits v
            on v.workspace_id = i.workspace_id and v.id = i.visit_id
          left join public.quotes q
            on q.workspace_id = i.workspace_id and q.id = i.quote_id
          left join public.requests r
            on r.workspace_id = q.workspace_id and r.id = q.request_id
          where i.workspace_id = b.workspace_id
            and coalesce(v.branch_id, r.branch_id) = b.id
            and i.status = 'PAID'
            and i.updated_at >= (v_from_date::timestamp at time zone b.timezone)
            and i.updated_at < ((v_to_date + 1)::timestamp at time zone b.timezone)
        ),
        'collectedMinor', (
          select coalesce(sum(greatest(i.allocated_minor - i.refunded_minor, 0)), 0)
          from public.invoices i
          left join public.visits v
            on v.workspace_id = i.workspace_id and v.id = i.visit_id
          left join public.quotes q
            on q.workspace_id = i.workspace_id and q.id = i.quote_id
          left join public.requests r
            on r.workspace_id = q.workspace_id and r.id = q.request_id
          where i.workspace_id = b.workspace_id
            and coalesce(v.branch_id, r.branch_id) = b.id
            and i.currency = b.currency
            and i.status = 'PAID'
            and i.updated_at >= (v_from_date::timestamp at time zone b.timezone)
            and i.updated_at < ((v_to_date + 1)::timestamp at time zone b.timezone)
        ),
        'currencyMismatchCount', (
          select count(*)
          from public.invoices i
          left join public.visits v
            on v.workspace_id = i.workspace_id and v.id = i.visit_id
          left join public.quotes q
            on q.workspace_id = i.workspace_id and q.id = i.quote_id
          left join public.requests r
            on r.workspace_id = q.workspace_id and r.id = q.request_id
          where i.workspace_id = b.workspace_id
            and coalesce(v.branch_id, r.branch_id) = b.id
            and i.currency <> b.currency
            and i.status = 'PAID'
            and i.updated_at >= (v_from_date::timestamp at time zone b.timezone)
            and i.updated_at < ((v_to_date + 1)::timestamp at time zone b.timezone)
        )
      ) order by b.code)
      from public.workspace_branches b
      where b.workspace_id = v_workspace and b.active
    ), '[]'::jsonb),
    'disclosure',
      'Each branch is measured in its own timezone and native currency. Cross-currency totals are not converted or combined without an explicit FX source.'
  );
exception when invalid_text_representation or datetime_field_overflow or invalid_parameter_value then
  return jsonb_build_object('ok', false, 'code', 'BRANCH_REPORT_INPUT_INVALID');
end;
$$;

revoke all on function public.servicedesk_upsert_branch_service_zone(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_upsert_branch_provider_binding(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_set_branch_price_book(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_read_branch_resource_summary(jsonb) from public, anon, authenticated;
revoke all on function public.servicedesk_read_branch_comparison_report(jsonb) from public, anon, authenticated;
grant execute on function public.servicedesk_upsert_branch_service_zone(jsonb) to service_role;
grant execute on function public.servicedesk_upsert_branch_provider_binding(jsonb) to service_role;
grant execute on function public.servicedesk_set_branch_price_book(jsonb) to service_role;
grant execute on function public.servicedesk_read_branch_resource_summary(jsonb) to service_role;
grant execute on function public.servicedesk_read_branch_comparison_report(jsonb) to service_role;

comment on table public.branch_provider_bindings is
  'Branch-scoped external resource bindings. resource_ref is an opaque reference only; provider credentials remain outside PostgreSQL.';
