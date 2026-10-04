-- Package-free E07 recurrence RPC structure checks.
-- This is a static harness for CI/runtime review; live staging proof is recorded in docs/execution/receipts/v1-int7-worker-1.md.

select proname, prosecdef
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where nspname = 'public'
  and proname in (
    'servicedesk_create_recurrence_rule',
    'servicedesk_apply_recurrence_rule_action',
    'servicedesk_materialize_due_recurrences',
    'servicedesk_read_workspace_snapshot'
  )
order by proname;

select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    table_name = 'recurrence_occurrences'
    or (table_name = 'recurrence_rules' and column_name in ('status','generated_occurrences','next_occurrence_on','version','updated_at','idempotency_key'))
  )
order by table_name, ordinal_position;
