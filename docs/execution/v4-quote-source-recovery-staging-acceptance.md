# V4 internal QUOTE_ACCEPTED source recovery — staged release plan

Status: **source-only candidate, migration NOT applied, worker NOT scheduled**.
Issue: #199. Intended SQL: `supabase/migrations/0063_v4_quote_accept_internal_source_journal.sql`.

## Why this exists

The confirmed customer quote transition is persisted by `servicedesk_accept_quote(jsonb)`.
The existing post-accept callback then best-effort creates internal attention. If the
app exits between the two steps, the quote stays ACCEPTED without a workflow receipt.
This is NOT equivalent to a durable automation system.

Migration 0063 adds a dedicated `workflow_source_events` ledger. Its trigger
inserts only when an **already opted-in workspace** transitions a quote to ACCEPTED.
Insertion is in the same SQL transaction as the quote status update. The event
contains only IDs and execution metadata, not customer addresses, contact details
or messages. Existing `outbox_events` remains reserved for outbound provider intents.

**Explicit tradeoff:** if ledger insertion fails, SQL aborts the quote transition
rather than pretending both succeeded. This can reduce quote availability during
DB outages; the owner must accept this tradeoff before deploying 0062.

## Current verified Supabase baseline (2026-10-12)

Connected project `cpmmgivhlkfbiwzhlcey` has
`public.quotes(workspace_id,id)` unique, existing `workspace_feature_flags`
with `(workspace_id,feature_key)` primary key, and
`servicedesk_accept_quote(jsonb)` as a SECURITY INVOKER function.
The owner first-run pricing RPC `servicedesk_setup_owner_cleaning_pricing(jsonb)`
is installed, SECURITY INVOKER, with EXECUTE limited to trusted roles.
Database has no service catalog, active branch price books or published
workflow versions. No real customer flow acceptance has been recorded.

## Release stages (require explicit database migration approval)

1. Confirm isolated **staging** project ID and exact migration checksum.
   Check no parallel branch has introduced another 0062 migration or changed
   `quotes`, feature flags or the accepted-quote RPC.
2. Read-only preflight:

   ```sql
   SELECT to_regclass('public.workflow_source_events') AS existing_ledger,
          to_regprocedure('public.servicedesk_accept_quote(jsonb)') AS quote_rpc,
          to_regclass('public.workspace_feature_flags') AS feature_flags;
   SELECT c.relname, c.relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN ('quotes','workspace_feature_flags');
   ```

3. Apply reviewed SQL 0063 in staging via the normal migrations ledger, **not**
   arbitrary snippets or `service_role` SQL from a browser.
4. Read-only security gates:

   ```sql
   SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
    WHERE c.oid='public.workflow_source_events'::regclass;
   SELECT count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename='workflow_source_events'; -- must be 0 (client fail-closed)
   SELECT has_function_privilege('anon',
     'public.servicedesk_claim_quote_source_events(text,integer)','EXECUTE') AS anon_claim,
     has_function_privilege('authenticated',
     'public.servicedesk_complete_quote_source_event(uuid,text,text,text)','EXECUTE') AS user_complete;
   -- both must be false
   ```

5. Run isolated **authorized** owner/customer acceptance (two unrelated tenants),
   using business-approved TEST rates, not fabricated production or live customer
   histories. With A opted in and B off, A's accepted-quote transition records
   exactly one ledger entry; B records none. Retries and replay must not duplicate
   source rows or internal attention. Verify RLS denial with real anon,
   customer and foreign owner sessions.
6. Force a controlled worker interruption after claim and before completion.
   After the 90s lease, an authorized replay must resume with existing dedup,
   bounded retry/backoff and dead-letter after eight attempts. Simulate last-attempt
   lease expiry and verify a terminal DEAD_LETTER row.
7. Validate external email/WhatsApp never leaves `APPROVAL_REQUIRED` from this
   path. No Stripe charge or model inference is authorized by this migration.
8. Connect a server-private scheduler to
   `runInternalQuoteSourceRecoveryBatch` **only in a separate reviewed PR** with
   service-role isolation and least privilege. The helper currently has NO route,
   cron, timer, webhook or public entry point; deploying this source alone
   does not make a background worker run.
9. Turn on `SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED` only after owner-scoped
   feature-flag control is verified, a real approved staging rule is published,
   the above DB proofs pass, and rollback owner approves the change.

## Rollback / failure handling

- Immediately disable the server kill switch; do not merely hide the UI.
- Do not drop the trigger/table while unprocessed rows or locked workers exist.
  Drain or export audit metadata safely before separately approved cleanup.
- If 0062 causes acceptance failures, revert the release in an explicit
  maintenance window, preserving event records for investigation.
- Recorded status means internal workflow bookkeeping, **not** provider delivery,
  real end-to-end acceptance, or transactional outbox operational success.
- Avoid reusing the provider `outbox_events` table for these internal topics;
  an external channel dispatcher might otherwise attempt unknown intents.

CI covers source/type/lint and mocked replay contracts; real Postgres
migration execution, SQL rollback, two-tenant session RLS and production
readiness remain independently required.
