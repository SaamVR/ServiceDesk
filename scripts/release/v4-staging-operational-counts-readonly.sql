-- ServiceDesk V4 aggregate staging intake and workflow readiness, READ ONLY.
-- Operator-only: execute against an independently authorized staging database.
-- The result deliberately contains NO workspace IDs, customer names, email,
-- phone, pricing amounts, event payloads or credentials. These are database-
-- wide aggregate counts, NOT a tenant-authorized owner session or completed UAT.
BEGIN TRANSACTION READ ONLY;

WITH inventory AS (
  SELECT
    (SELECT count(*) FROM public.workspaces) AS workspaces,
    (SELECT count(*) FROM public.memberships) AS memberships,
    (SELECT count(*) FROM public.workspace_branches WHERE active) AS active_branches,
    (SELECT count(*) FROM public.service_catalog WHERE active) AS active_services,
    (SELECT count(*) FROM public.branch_price_books WHERE active) AS active_price_books,
    (SELECT count(*) FROM public.requests) AS saved_requests,
    (SELECT count(*) FROM public.quotes WHERE status::text = 'ACCEPTED') AS accepted_quotes,
    (SELECT count(*) FROM public.visits) AS recorded_visits,
    (SELECT count(*) FROM public.invoices) AS recorded_invoices,
    (SELECT count(*) FROM public.workflow_rule_versions WHERE state::text = 'PUBLISHED')
      AS published_workflow_versions,
    (SELECT count(*) FROM public.workflow_executions WHERE mode::text = 'LIVE')
      AS recorded_live_executions,
    (SELECT count(*) FROM public.workflow_action_executions
       WHERE action_type::text = 'CREATE_ATTENTION' AND state::text = 'SUCCEEDED')
      AS succeeded_internal_actions,
    (SELECT count(*) FROM public.workspace_feature_flags
       WHERE feature_key='AUTO_INTERNAL_QUOTE_ACCEPTED' AND enabled = true)
      AS opted_in_workspaces
), flags AS (
  SELECT
    to_regprocedure('public.servicedesk_setup_owner_cleaning_pricing(jsonb)') IS NOT NULL
      AS owner_pricing_rpc_installed,
    to_regclass('public.workflow_source_events') IS NOT NULL
      AS quote_recovery_journal_installed,
    to_regprocedure('public.servicedesk_claim_quote_source_events(text,integer)') IS NOT NULL
      AS quote_recovery_claim_installed,
    to_regprocedure('public.servicedesk_revise_owner_cleaning_pricing(jsonb)') IS NOT NULL
      AS owner_pricing_revision_rpc_installed,
    to_regprocedure('public.servicedesk_default_branch(uuid)') IS NOT NULL
      AS default_branch_rpc_present
), security_metadata AS (
  -- Metadata only; no quote, customer, membership ID, billing or session rows.
  SELECT
    COALESCE((SELECT c.relrowsecurity FROM pg_catalog.pg_class c
      WHERE c.oid=to_regclass('public.workflow_source_events')),false)
      AS quote_journal_rls_enabled,
    COALESCE((SELECT count(*) FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid=to_regclass('public.quotes')
        AND t.tgname='servicedesk_quote_accept_source_event'
        AND NOT t.tgisinternal),0) = 1
      AS quote_journal_trigger_present,
    CASE WHEN to_regprocedure('public.servicedesk_claim_quote_source_events(text,integer)') IS NULL
      THEN false
      ELSE NOT COALESCE(has_function_privilege('anon',
        to_regprocedure('public.servicedesk_claim_quote_source_events(text,integer)'),
        'EXECUTE'),true)
    END AS anonymous_journal_claim_denied,
    CASE WHEN to_regprocedure('public.servicedesk_complete_quote_source_event(uuid,text,text,text)') IS NULL
      THEN false
      ELSE NOT COALESCE(has_function_privilege('authenticated',
        to_regprocedure('public.servicedesk_complete_quote_source_event(uuid,text,text,text)'),
        'EXECUTE'),true)
    END AS authenticated_journal_complete_denied
)
SELECT jsonb_pretty(jsonb_build_object(
  'schema', 'servicedesk-v4-aggregate-operator-preflight-v1',
  'verificationMode', 'READ_ONLY_AGGREGATE_NOT_AUTHENTICATED_UAT',
  'workspaceRecords', workspaces,
  'membershipRecords', memberships,
  'activeBranches', active_branches,
  'activeCatalogServices', active_services,
  'activeBranchPriceBooks', active_price_books,
  'savedRequests', saved_requests,
  'acceptedQuotes', accepted_quotes,
  'recordedVisits', recorded_visits,
  'recordedInvoices', recorded_invoices,
  'publishedWorkflowVersions', published_workflow_versions,
  'recordedLiveExecutions', recorded_live_executions,
  'succeededInternalActions', succeeded_internal_actions,
  'optedInWorkspaces', opted_in_workspaces,
  'ownerPricingRpcInstalled', owner_pricing_rpc_installed,
  'quoteRecoveryJournalInstalled', quote_recovery_journal_installed,
  'quoteRecoveryClaimInstalled', quote_recovery_claim_installed,
  'ownerPricingRevisionRpcInstalled', owner_pricing_revision_rpc_installed,
  'defaultBranchRpcPresentNotMembershipVerified', default_branch_rpc_present,
  'quoteJournalRlsEnabled', quote_journal_rls_enabled,
  'quoteJournalTriggerPresent', quote_journal_trigger_present,
  'anonymousJournalClaimDenied', anonymous_journal_claim_denied,
  'authenticatedJournalCompleteDenied', authenticated_journal_complete_denied,
  'quoteJournalSourceGate', case
    when quote_recovery_journal_installed and quote_recovery_claim_installed
      and quote_journal_rls_enabled and quote_journal_trigger_present
      and anonymous_journal_claim_denied and authenticated_journal_complete_denied
      then 'SCHEMA_METADATA_PRESENT_STAGING_AUTHORIZATION_UNVERIFIED'
    else 'BLOCKED_SOURCE_JOURNAL_SCHEMA_OR_GRANTS' end,
  'ownerPricingRevisionGate', case
    when owner_pricing_revision_rpc_installed
      then 'RPC_PRESENT_OWNER_AUTHORIZATION_UNVERIFIED'
    else 'BLOCKED_REVISION_RPC_MISSING' end,
  'defaultBranchMembershipUat', 'NOT_PROVEN_BY_RPC_EXISTENCE',
  'acceptedQuoteJournalReplayUat', 'NOT_PROVEN_BY_SCHEMA_METADATA',
  'catalogPrerequisite', case
    when active_services > 0 then 'RECORDS_PRESENT_REQUIRES_OWNER_VALIDATION'
    else 'BLOCKED_NO_ACTIVE_SERVICES' end,
  'pricingPrerequisite', case
    when active_price_books > 0 then 'RECORDS_PRESENT_REQUIRES_OWNER_VALIDATION'
    else 'BLOCKED_NO_ACTIVE_BRANCH_PRICE_BOOKS' end,
  'workflowPrerequisite', case
    when published_workflow_versions > 0 then 'RECORDS_PRESENT_REQUIRES_OWNER_VALIDATION'
    else 'BLOCKED_NO_PUBLISHED_WORKFLOW' end,
  'ownerRequestQuoteUat', 'NOT_PROVEN_BY_AGGREGATE_COUNTS',
  'crossTenantRlsUat', 'NOT_PROVEN_BY_AGGREGATE_COUNTS',
  'providerDeliveryUat', 'NOT_PROVEN_BY_AGGREGATE_COUNTS',
  'note', 'Totals aggregate across database workspaces and cannot certify any individual business, branch, customer journey or provider delivery.'
)) AS redacted_aggregate_evidence
FROM inventory CROSS JOIN flags CROSS JOIN security_metadata;

COMMIT;
