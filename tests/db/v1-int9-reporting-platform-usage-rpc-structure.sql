-- Package-free INT9 structure harness for ServiceDesk E09.
-- Canonical package/type tests remain coordinator/runtime-owned.

select 'servicedesk_apply_verified_platform_subscription' as rpc,
       p.prosecdef = false as security_invoker,
       has_function_privilege('anon', p.oid, 'EXECUTE') = false as anon_denied,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') = false as authenticated_denied,
       has_function_privilege('service_role', p.oid, 'EXECUTE') = true as service_role_allowed
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_apply_verified_platform_subscription'
union all
select 'servicedesk_check_usage', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_check_usage'
union all
select 'servicedesk_consume_usage', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_consume_usage'
union all
select 'servicedesk_read_reporting_snapshot', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_read_reporting_snapshot'
union all
select 'servicedesk_read_platform_billing_snapshot', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_read_platform_billing_snapshot'
union all
select 'servicedesk_read_owner_settings_snapshot', p.prosecdef = false, has_function_privilege('anon', p.oid, 'EXECUTE') = false, has_function_privilege('authenticated', p.oid, 'EXECUTE') = false, has_function_privilege('service_role', p.oid, 'EXECUTE') = true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'servicedesk_read_owner_settings_snapshot';
