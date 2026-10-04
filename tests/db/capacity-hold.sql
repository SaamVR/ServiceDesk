-- Run after Supabase db reset in a local/test project.
-- This script proves the database target rejects two active holds for one slot.
-- It intentionally rolls back all fixture data.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','capacity-owner@example.test','',now(),now())
on conflict (id) do nothing;

insert into public.workspaces (id, slug, name)
values ('40000000-0000-4000-8000-000000000001','capacity-tenant','Capacity Tenant');

insert into public.memberships (workspace_id, user_id, role, status)
values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000b1','OWNER','ACTIVE');

insert into public.customers (id, workspace_id, display_name)
values ('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Capacity Customer');

insert into public.properties (id, workspace_id, customer_id, address_line1, city, postal_code)
values ('41100000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','1 Capacity Street','London','C1 1AA');

insert into public.service_catalog (id, workspace_id, code, name)
values ('41200000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','MOVE_OUT','Move-out cleaning');

insert into public.requests (id, workspace_id, customer_id, property_id, service_id, status, bedrooms, bathrooms)
values (
 '41300000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 '41000000-0000-4000-8000-000000000001',
 '41100000-0000-4000-8000-000000000001',
 '41200000-0000-4000-8000-000000000001',
 'READY',
 3,
 2
);

insert into public.quotes (
 id, workspace_id, request_id, version, status, service_code, currency,
 subtotal_minor, tax_minor, total_minor, deposit_minor, balance_minor,
 duration_minutes, buffer_minutes, rate_version, valid_until, snapshot
)
values
 (
  '41400000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '41300000-0000-4000-8000-000000000001',
  1,
  'ACCEPTED',
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
  '{"totalMinor":34000}'::jsonb
 ),
 (
  '41400000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001',
  '41300000-0000-4000-8000-000000000001',
  2,
  'ACCEPTED',
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
  '{"totalMinor":34000}'::jsonb
 );

insert into public.crews (id, workspace_id, name)
values ('42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Crew One');

insert into public.capacity_slots (id, workspace_id, crew_id, starts_at, ends_at, capacity_minutes, timezone)
values (
 '42100000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 '42000000-0000-4000-8000-000000000001',
 '2026-10-05T09:00:00Z',
 '2026-10-05T13:30:00Z',
 270,
 'Europe/London'
);

insert into public.slot_holds (id, workspace_id, slot_id, quote_id, status, expires_at, idempotency_key)
values (
 '42200000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 '42100000-0000-4000-8000-000000000001',
 '41400000-0000-4000-8000-000000000001',
 'HELD',
 '2026-10-04T06:15:00Z',
 'hold-one'
);

do $$
declare duplicate_blocked boolean := false;
declare active_holds integer;
begin
  begin
    insert into public.slot_holds (id, workspace_id, slot_id, quote_id, status, expires_at, idempotency_key)
    values (
     '42200000-0000-4000-8000-000000000002',
     '40000000-0000-4000-8000-000000000001',
     '42100000-0000-4000-8000-000000000001',
     '41400000-0000-4000-8000-000000000002',
     'HELD',
     '2026-10-04T06:15:00Z',
     'hold-two-race'
    );
  exception when unique_violation then
    duplicate_blocked := true;
  end;

  if duplicate_blocked is false then
    raise exception 'last-slot race was not blocked by active-hold uniqueness';
  end if;

  update public.slot_holds
  set status = 'EXPIRED'
  where id = '42200000-0000-4000-8000-000000000001';

  insert into public.slot_holds (id, workspace_id, slot_id, quote_id, status, expires_at, idempotency_key)
  values (
   '42200000-0000-4000-8000-000000000003',
   '40000000-0000-4000-8000-000000000001',
   '42100000-0000-4000-8000-000000000001',
   '41400000-0000-4000-8000-000000000002',
   'HELD',
   '2026-10-04T06:20:00Z',
   'hold-three-after-expiry'
  );

  select count(*) into active_holds
  from public.slot_holds
  where workspace_id = '40000000-0000-4000-8000-000000000001'
    and slot_id = '42100000-0000-4000-8000-000000000001'
    and status = 'HELD';

  if active_holds <> 1 then
    raise exception 'expected exactly one active hold after expiry release, got %', active_holds;
  end if;
end $$;

rollback;
