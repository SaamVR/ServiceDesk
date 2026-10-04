-- Package-free E10B structure assertions for canonical DB review.
-- To run against a migrated ServiceDesk database.

select
  'servicedesk_create_customer' as capability,
  p.prosecdef = false as security_invoker,
  has_function_privilege('anon', p.oid, 'EXECUTE') = false as anon_denied,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') = false as authenticated_denied,
  has_function_privilege('service_role', p.oid, 'EXECUTE') = true as service_role_allowed
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_create_customer'
union all
select 'servicedesk_create_property', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_create_property'
union all
select 'servicedesk_create_request', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_create_request'
union all
select 'servicedesk_update_request', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_update_request'
union all
select 'servicedesk_persist_quote_snapshot', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_persist_quote_snapshot'
union all
select 'servicedesk_send_quote', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_send_quote'
union all
select 'servicedesk_accept_quote', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_accept_quote'
union all
select 'servicedesk_upsert_capacity_slot', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_upsert_capacity_slot'
union all
select 'servicedesk_hold_slot', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='servicedesk_hold_slot';
