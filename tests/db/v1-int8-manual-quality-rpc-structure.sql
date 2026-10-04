-- Package-free E08 structure harness.
-- Run against ServiceDesk staging after 0013.
select proname, prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'servicedesk_apply_manual_payment',
    'servicedesk_open_quality_case',
    'servicedesk_apply_quality_case_action',
    'servicedesk_read_workspace_snapshot'
  )
order by proname;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('manual_payment_records','quality_cases')
order by table_name;
