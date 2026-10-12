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
      AS quote_recovery_claim_installed
)
SELECT jsonb_pretty(jsonb_build_object(
  'schema', 'servicedesk-v4-aggregate-operator-preflight-v1',
  'verificationMode', 'READ_ONLY_AGGREGATE_NOT_AUTHENTICATED_UAT',
  'activeWorkspaces', workspaces,
  'activeMembers', memberships,
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
FROM inventory CROSS JOIN flags;

COMMIT;
