-- ServiceDesk V4 operator schema verification, READ-ONLY.
-- Run only using an explicitly authorized, correctly identified staging
-- connection. For psql: psql -X -v ON_ERROR_STOP=1 -f this-file.sql
-- No inserts, DDL, customer identifiers, emails, provider operations or
-- owner-signup actions. Never treat this query as authenticated UAT.
BEGIN TRANSACTION READ ONLY;

WITH bindings AS (
  SELECT COUNT(*)::integer AS bound_triggers
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'servicedesk_apply_branch_defaults_and_consistency'
    AND NOT t.tgisinternal
    AND t.tgname IN (
      'properties_branch_guard', 'requests_branch_guard',
      'conversations_branch_guard', 'crews_branch_guard',
      'capacity_slots_branch_guard', 'visits_branch_guard',
      'recurrence_rules_branch_guard'
    )
), branch AS (
  SELECT
    NOT p.prosecdef AS security_invoker,
    POSITION('if tg_table_name = ''requests'' then'
      IN LOWER(pg_get_functiondef(p.oid))) > 0 AS requests_guard,
    POSITION('elsif tg_table_name = ''conversations'' then'
      IN LOWER(pg_get_functiondef(p.oid))) > 0 AS conversations_guard,
    POSITION('if tg_table_name = ''requests'' and new.property_id'
      IN LOWER(pg_get_functiondef(p.oid))) > 0 AS historic_unsafe_guard
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'servicedesk_apply_branch_defaults_and_consistency'
), pricing AS (
  SELECT NOT p.prosecdef AS security_invoker
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'servicedesk_setup_owner_cleaning_pricing'
    AND p.oid = to_regprocedure('public.servicedesk_setup_owner_cleaning_pricing(jsonb)')
), source AS (
  SELECT c.relrowsecurity AS rls_enabled
  FROM pg_class c
  WHERE c.oid = to_regclass('public.workflow_source_events')
), proof AS (
  SELECT
    (SELECT COALESCE(bool_and(
      security_invoker AND requests_guard AND conversations_guard
      AND NOT historic_unsafe_guard
    ),false) FROM branch)
      AND (SELECT bound_triggers = 7 FROM bindings)
      AS branch_guard_applied,
    (SELECT COALESCE(bool_and(security_invoker),false) FROM pricing)
      AS owner_pricing_rpc_installed,
    to_regclass('public.workflow_source_events') IS NOT NULL
      AS internal_journal_installed,
    (SELECT COALESCE(bool_and(rls_enabled),false) FROM source)
      AS journal_rls_enabled,
    to_regprocedure('public.servicedesk_claim_quote_source_events(text,integer)')
      IS NOT NULL AS replay_claim_rpc_installed,
    to_regprocedure('public.servicedesk_complete_quote_source_event(uuid,text,text,text)')
      IS NOT NULL AS replay_complete_rpc_installed
)
SELECT jsonb_pretty(jsonb_build_object(
  'schema', 'servicedesk-v4-operator-schema-proof-v1',
  'verificationMode', 'READ_ONLY_CONNECTED_DATABASE',
  'branchGuard0062Applied', branch_guard_applied,
  'branchTriggerBindings', (SELECT bound_triggers FROM bindings),
  'ownerPricingRpcInstalled', owner_pricing_rpc_installed,
  'quoteSourceJournalInstalled', internal_journal_installed,
  'quoteJournalRlsEnabled', journal_rls_enabled,
  'replayClaimRpcInstalled', replay_claim_rpc_installed,
  'replayCompleteRpcInstalled', replay_complete_rpc_installed,
  'coreSchemaState', CASE
    WHEN branch_guard_applied AND owner_pricing_rpc_installed
      THEN 'CORE_SCHEMA_VERIFIED'
    ELSE 'CORE_SCHEMA_BLOCKED' END,
  'quoteRecoverySchemaState', CASE
    WHEN internal_journal_installed AND journal_rls_enabled
      AND replay_claim_rpc_installed AND replay_complete_rpc_installed
      THEN 'RECOVERY_SCHEMA_INSTALLED'
    ELSE 'RECOVERY_MIGRATION_NOT_VERIFIED' END,
  'customerWorkflowAcceptance', 'NOT_TESTED_BY_THIS_QUERY',
  'providerDeliveryAcceptance', 'NOT_TESTED_BY_THIS_QUERY'
)) AS redacted_schema_evidence
FROM proof;

COMMIT;
