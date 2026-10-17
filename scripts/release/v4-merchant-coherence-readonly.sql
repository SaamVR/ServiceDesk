-- ServiceDesk V4 R16: read-only, redacted *same-workspace* prerequisite coherence.
-- Does not return workspace IDs, user IDs, pricing amounts, tokens, PII or
-- customer records. Does NOT verify browser sessions, quote acceptance
-- causality, payment/provider actions, or that either owner consented to QA.
-- Execute only with an explicitly authorized read-only staging connection.
BEGIN TRANSACTION READ ONLY;

WITH scope AS (
  SELECT
    w.id,
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.workspace_id = w.id
        AND m.role = 'OWNER' AND m.status = 'ACTIVE'
    ) AS active_owner,
    EXISTS (
      SELECT 1 FROM public.workspace_branches b
      WHERE b.workspace_id = w.id
        AND b.active = true AND b.currency = 'USD'
    ) AS active_usd_branch,
    (
      SELECT count(DISTINCT sc.code)
      FROM public.service_catalog sc
      WHERE sc.workspace_id = w.id AND sc.active = true
        AND sc.code IN ('STANDARD','DEEP','MOVE_OUT')
    ) = 3 AS complete_active_service_trio,
    EXISTS (
      SELECT 1
      FROM public.branch_price_books pb
      JOIN public.workspace_branches b
        ON b.workspace_id = pb.workspace_id
       AND b.id = pb.branch_id
      JOIN public.rate_cards rc
        ON rc.workspace_id = pb.workspace_id
       AND rc.id = pb.rate_card_id
      WHERE pb.workspace_id = w.id
        AND pb.active = true
        AND b.active = true AND b.currency = 'USD'
        AND rc.active = true AND rc.currency = 'USD'
        -- Linkage and currency are only a candidate, not a proof that every
        -- saved rate is present or that the price period is unambiguous.
    ) AS linked_usd_price_book_candidate,
    EXISTS (SELECT 1 FROM public.requests r
            WHERE r.workspace_id = w.id) AS has_saved_request,
    EXISTS (SELECT 1 FROM public.quotes q
            WHERE q.workspace_id = w.id) AS has_saved_quote,
    EXISTS (SELECT 1 FROM public.workflow_executions e
            WHERE e.workspace_id = w.id) AS has_workflow_execution,
    EXISTS (SELECT 1 FROM public.attention_items a
            WHERE a.workspace_id = w.id) AS has_attention,
    EXISTS (SELECT 1 FROM public.invoices i
            WHERE i.workspace_id = w.id) AS has_saved_invoice
  FROM public.workspaces w
), owners AS (
  SELECT count(DISTINCT user_id)::integer AS distinct_active_owner_identities,
         count(DISTINCT workspace_id)::integer AS owner_workspace_count
  FROM public.memberships
  WHERE role = 'OWNER' AND status = 'ACTIVE'
), summary AS (
  SELECT
    count(*)::integer AS workspaces,
    count(*) FILTER (WHERE active_owner AND active_usd_branch)::integer
      AS owner_usd_workspace_count,
    count(*) FILTER (
      WHERE active_owner AND active_usd_branch
        AND complete_active_service_trio
        AND linked_usd_price_book_candidate
    )::integer AS same_workspace_pricing_candidate_count,
    count(*) FILTER (
      WHERE active_owner AND active_usd_branch
        AND complete_active_service_trio
        AND linked_usd_price_book_candidate
        AND has_saved_request AND has_saved_quote
        AND has_workflow_execution AND has_attention AND has_saved_invoice
    )::integer AS same_workspace_record_chain_candidate_count
  FROM scope
)
SELECT jsonb_pretty(jsonb_build_object(
  'schema','servicedesk-v4-r16-merchant-coherence-readonly-v1',
  'verificationMode','READ_ONLY_SAME_WORKSPACE_AGGREGATES_NOT_UAT',
  'workspaceCount', summary.workspaces,
  'distinctActiveOwnerIdentities', owners.distinct_active_owner_identities,
  'ownerWorkspaceCount', owners.owner_workspace_count,
  'ownerWithUsdBranchWorkspaceCount', summary.owner_usd_workspace_count,
  'sameWorkspacePricingCandidateCount',
    summary.same_workspace_pricing_candidate_count,
  'sameWorkspaceRecordChainCandidateCount',
    summary.same_workspace_record_chain_candidate_count,
  'twoOwnerPrerequisite', CASE
    WHEN owners.distinct_active_owner_identities >= 2
      AND owners.owner_workspace_count >= 2
      THEN 'RECORDS_PRESENT_REQUIRE_INDEPENDENT_AUTH_CHECK'
    ELSE 'BLOCKED_TWO_INDEPENDENT_ACTIVE_OWNERS_REQUIRED'
    END,
  'pricedQuotePrerequisite', CASE
    WHEN summary.same_workspace_pricing_candidate_count > 0
      THEN 'RECORDS_PRESENT_REQUIRE_RATE_AND_SESSION_VALIDATION'
    ELSE 'BLOCKED_NO_SAME_WORKSPACE_SERVICE_AND_PRICE_BOOK'
    END,
  'realAcceptedQuoteAttentionInvoiceUat',
    'NOT_PROVEN_BY_AGGREGATES_OR_INDEPENDENT_RECORD_PRESENCE',
  'crossTenantRlsUat','NOT_PROVEN_BY_AGGREGATES',
  'providerAndPaymentUat','NOT_PROVEN_BY_AGGREGATES',
  'note','Aggregate same-workspace candidate counts are not persisted causal-chain receipts; source state, authentic sign-in, status/version links and negative tenant writes must be verified separately.'
)) AS redacted_workspace_coherence
FROM summary CROSS JOIN owners;

COMMIT;
