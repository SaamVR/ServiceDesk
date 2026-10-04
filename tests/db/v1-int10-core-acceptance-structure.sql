-- ServiceDesk AI V1-INT10 package-free acceptance structure checks
-- Intended to run against ServiceDesk staging after migrations through 0014a.

with required_functions(name) as (
  values
    ('servicedesk_apply_verified_payment'),
    ('servicedesk_apply_inbound_message'),
    ('servicedesk_set_conversation_handover'),
    ('servicedesk_enqueue_conversation_reply'),
    ('claim_ready_outbox_events'),
    ('complete_outbox_event'),
    ('servicedesk_transition_visit'),
    ('servicedesk_add_visit_evidence'),
    ('servicedesk_set_visit_checklist_item'),
    ('servicedesk_create_recurrence_rule'),
    ('servicedesk_apply_recurrence_rule_action'),
    ('servicedesk_materialize_due_recurrences'),
    ('servicedesk_apply_manual_payment'),
    ('servicedesk_open_quality_case'),
    ('servicedesk_apply_quality_case_action'),
    ('servicedesk_apply_verified_platform_subscription'),
    ('servicedesk_check_usage'),
    ('servicedesk_consume_usage'),
    ('servicedesk_read_reporting_snapshot'),
    ('servicedesk_read_platform_billing_snapshot'),
    ('servicedesk_read_owner_settings_snapshot')
), actual_functions as (
  select p.proname as name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select name, case when exists(select 1 from actual_functions a where a.name = required_functions.name) then 'PRESENT' else 'MISSING' end as state
from required_functions
order by name;

with required_tables(name) as (
  values
    ('provider_inbound_receipts'),
    ('visit_evidence'),
    ('visit_checklist_items'),
    ('recurrence_occurrences'),
    ('manual_payment_records'),
    ('quality_cases'),
    ('platform_subscriptions'),
    ('platform_subscription_ledger'),
    ('workspace_usage_counters'),
    ('workspace_usage_limits')
), actual_tables as (
  select table_name as name
  from information_schema.tables
  where table_schema = 'public'
)
select name, case when exists(select 1 from actual_tables a where a.name = required_tables.name) then 'PRESENT' else 'MISSING' end as state
from required_tables
order by name;
