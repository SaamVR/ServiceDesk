-- Run after Supabase db reset in a local/test project.
-- This script intentionally rolls back all fixture data.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-owner@example.test','',now(),now()),
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-customer@example.test','',now(),now())
on conflict (id) do nothing;

insert into public.workspaces (id, slug, name)
values ('30000000-0000-4000-8000-000000000001','quote-tenant','Quote Tenant');

insert into public.memberships (workspace_id, user_id, role, status)
values ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000a1','OWNER','ACTIVE');

insert into public.customers (id, workspace_id, auth_user_id, display_name)
values ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000c1','Quote Customer');

insert into public.properties (id, workspace_id, customer_id, address_line1, city, postal_code)
values ('31100000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','1 Quote Street','London','Q1 1AA');

insert into public.service_catalog (id, workspace_id, code, name)
values ('31200000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','MOVE_OUT','Move-out cleaning');

insert into public.requests (id, workspace_id, customer_id, property_id, service_id, status, bedrooms, bathrooms)
values (
 '31300000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000001',
 '31100000-0000-4000-8000-000000000001',
 '31200000-0000-4000-8000-000000000001',
 'READY',
 3,
 2
);

insert into public.quotes (
 id, workspace_id, request_id, version, status, service_code, currency,
 subtotal_minor, tax_minor, total_minor, deposit_minor, balance_minor,
 duration_minutes, buffer_minutes, rate_version, valid_until, snapshot
)
values (
 '31400000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '31300000-0000-4000-8000-000000000001',
 1,
 'APPROVED',
 'MOVE_OUT',
 'USD',
 34000,
 0,
 34000,
 8500,
 25500,
 240,
 30,
 'synthetic-cleaning-v1',
 '2026-10-06T06:00:00Z',
 '{"totalMinor":34000,"depositMinor":8500,"balanceMinor":25500,"durationMinutes":240,"bufferMinutes":30}'::jsonb
);

insert into public.approvals (id, workspace_id, quote_id, quote_version, status, reason, decided_by, decided_at)
values (
 '31500000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '31400000-0000-4000-8000-000000000001',
 1,
 'APPROVED',
 'fixture auto approval',
 '00000000-0000-4000-8000-0000000000a1',
 now()
);

update public.quotes
set status = 'SUPERSEDED', superseded_by = '31400000-0000-4000-8000-000000000002'
where id = '31400000-0000-4000-8000-000000000001';

insert into public.quotes (
 id, workspace_id, request_id, version, status, service_code, currency,
 subtotal_minor, tax_minor, total_minor, deposit_minor, balance_minor,
 duration_minutes, buffer_minutes, rate_version, valid_until, snapshot
)
values (
 '31400000-0000-4000-8000-000000000002',
 '30000000-0000-4000-8000-000000000001',
 '31300000-0000-4000-8000-000000000001',
 2,
 'APPROVED',
 'MOVE_OUT',
 'USD',
 37000,
 0,
 37000,
 9250,
 27750,
 260,
 30,
 'synthetic-cleaning-v2',
 '2026-10-06T06:00:00Z',
 '{"totalMinor":37000,"depositMinor":9250,"balanceMinor":27750,"durationMinutes":260,"bufferMinutes":30}'::jsonb
);

do $$
declare old_total integer;
declare latest_version integer;
declare current_approval_count integer;
begin
  select total_minor into old_total
  from public.quotes
  where id = '31400000-0000-4000-8000-000000000001';
  if old_total <> 34000 then
    raise exception 'quote snapshot changed unexpectedly: expected 34000, got %', old_total;
  end if;

  select max(version) into latest_version
  from public.quotes
  where workspace_id = '30000000-0000-4000-8000-000000000001'
    and request_id = '31300000-0000-4000-8000-000000000001';
  if latest_version <> 2 then
    raise exception 'latest quote version mismatch: expected 2, got %', latest_version;
  end if;

  select count(*) into current_approval_count
  from public.approvals a
  join public.quotes q on q.workspace_id = a.workspace_id and q.id = a.quote_id
  where q.request_id = '31300000-0000-4000-8000-000000000001'
    and q.version = latest_version
    and a.quote_version = q.version
    and a.status = 'APPROVED';
  if current_approval_count <> 0 then
    raise exception 'stale approval unexpectedly authorizes latest quote';
  end if;
end $$;

rollback;
