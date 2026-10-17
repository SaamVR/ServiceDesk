-- R29 CORE-O: read-only exact quote-source business-chain acceptance diagnostic.
-- This emits only aggregate counts. No workspace, request, quote, invoice,
-- customer, user, provider or payment identifiers/amounts are returned.
-- Successful query proves saved relational links, not independent owner UAT.
BEGIN TRANSACTION READ ONLY;

WITH saved_quote_invoice AS (
  SELECT DISTINCT q.id AS quote_id, q.workspace_id, r.branch_id
  FROM public.requests r
  JOIN public.quotes q ON q.request_id = r.id
    AND q.workspace_id = r.workspace_id
  JOIN public.invoices i ON i.quote_id = q.id
    AND i.workspace_id = q.workspace_id
    AND i.total_minor = q.total_minor
    AND trim(i.currency) = trim(q.currency)
  WHERE r.branch_id IS NOT NULL
    AND q.status = 'ACCEPTED'
    AND q.accepted_at IS NOT NULL
    AND q.superseded_by IS NULL
    AND q.total_minor > 0
    AND trim(q.currency) = 'USD'
), matched_source_execution AS (
  SELECT DISTINCT sq.quote_id, sq.workspace_id, e.id AS execution_id, e.branch_id
  FROM saved_quote_invoice sq
  JOIN public.workflow_executions e
    ON e.workspace_id = sq.workspace_id
    AND e.branch_id = sq.branch_id
    AND e.mode = 'LIVE'
    AND e.event_type = 'QUOTE_ACCEPTED'
    AND e.matched = true
    AND e.recursion_depth = 0
    AND e.rule_version_id IS NOT NULL
    AND e.execution_key =
      'live:' || e.rule_version_id::text || ':' ||
      encode(extensions.digest(concat_ws('|',
        e.workspace_id::text, e.branch_id::text, 'QUOTE_ACCEPTED',
        sq.quote_id::text, '0', ''
      ), 'sha256'), 'hex')
  JOIN public.workflow_rule_versions v
    ON v.id = e.rule_version_id
    AND v.workspace_id = e.workspace_id
    AND v.branch_id = e.branch_id
    AND v.event_type = 'QUOTE_ACCEPTED'
), saved_attention_chain AS (
  SELECT DISTINCT m.quote_id, m.workspace_id, m.execution_id
  FROM matched_source_execution m
  JOIN public.workflow_action_executions a
    ON a.workspace_id = m.workspace_id
    AND a.branch_id = m.branch_id
    AND a.execution_id = m.execution_id
    AND a.action_type = 'CREATE_ATTENTION'
    AND a.state = 'SUCCEEDED'
  JOIN public.attention_items attention
    ON attention.workspace_id = a.workspace_id
    AND attention.resource_type = 'workflow_execution'
    AND attention.resource_id = m.execution_id
    AND attention.type = 'WORKFLOW_RULE'
), summary AS (
  SELECT
    (SELECT count(*)::integer FROM saved_quote_invoice) AS linked_invoice_quote_count,
    (SELECT count(*)::integer FROM matched_source_execution) AS matched_execution_count,
    (SELECT count(*)::integer FROM saved_attention_chain) AS linked_attention_count,
    (SELECT count(DISTINCT workspace_id)::integer
       FROM saved_attention_chain) AS workspaces_with_complete_saved_chain
)
SELECT jsonb_pretty(jsonb_build_object(
  'schema','servicedesk-v4-r29-exact-quote-source-readonly-v1',
  'evidence','SOURCE_RELATIONAL_READBACK_NOT_CUSTOMER_UAT',
  'linkedAcceptedQuoteInvoiceCount',s.linked_invoice_quote_count,
  'matchingImmutableQuoteSourceExecutionCount',s.matched_execution_count,
  'matchingSucceededAttentionChainCount',s.linked_attention_count,
  'workspaceCountWithAllLinkedRecords',s.workspaces_with_complete_saved_chain,
  'actualOwnerSessionAcceptance','NOT_PROVEN',
  'crossTenantSignedInIsolation','NOT_PROVEN',
  'providerDeliveryAndPaymentSettlement','NOT_PROVEN',
  'note','Exact source execution SHA binds workspace, branch, QUOTE_ACCEPTED, quote ID and recursion depth. Saved records are not proof of actor authorization, workflow causality before writes or real external delivery.'
)) AS redacted_exact_quote_chain
FROM summary s;

COMMIT;
