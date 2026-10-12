# V4 internal QUOTE_ACCEPTED source recovery — staged release plan

Status: **source-only integration candidate; migration 0063 NOT applied; protected worker default-OFF and NOT scheduled**.
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
DB outages; the owner must accept this tradeoff before deploying migration 0063.

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
   Verify the already-applied 0062 branch-trigger repair remains in migration
   history, that 0063 is not yet installed, and that no concurrent branch
   introduced another 0063 or changed `quotes`, feature flags, or the
   accepted-quote RPC.
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
8. The protected server-only POST worker entry point is implemented in this
   stacked source candidate, but remains default-OFF; it has no configured
   cron, external scheduler, public GET action or owner/customer access.
   Authorize a separate scheduler only after staged lease, auth and crash tests.
   Merely deploying this code does not make background recovery run.
9. Turn on `SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED` only after owner-scoped
   feature-flag control is verified, a real approved staging rule is published,
   the above DB proofs pass, and rollback owner approves the change.

## Rollback / failure handling

- Immediately disable the server kill switch; do not merely hide the UI.
- Do not drop the trigger/table while unprocessed rows or locked workers exist.
  Drain or export audit metadata safely before separately approved cleanup.
- If migration 0063 causes acceptance failures, disable the worker and quote
  automation opt-ins; prepare a separately approved recovery in an explicit
  maintenance window, preserving event records for investigation.
- Recorded status means internal workflow bookkeeping, **not** provider delivery,
  real end-to-end acceptance, or transactional outbox operational success.
- Avoid reusing the provider `outbox_events` table for these internal topics;
  an external channel dispatcher might otherwise attempt unknown intents.

CI includes disposable PostgreSQL 17 migration, rollback, concurrency,
  opt-in isolation and lease/dead-letter regressions. Additional connected
  staging SQL was rehearsed in BEGIN/ROLLBACK using two fictional workspaces;
  0063 remains unapplied. Neither CI nor simulated JWT role tests establish
  two real authenticated owner/customer sessions, business-approved rates,
  scheduler activation, provider delivery, or production readiness.
## Optional private worker HTTP interface (stacked follow-up)

This stacked candidate adds POST `/api/internal/workflows/quote-source`.
This is **not** automatically scheduled and exposes no GET action.

Deployment is default-OFF and requires **all** of the following:
- The owner-authorized 0063 migration has been applied and verified in staging;
  both source claim and completion RPCs exist and deny anon/authenticated.
- The trusted backend mode is `SERVICE_ROLE`, with valid Supabase URL and
  server-only service-role key, never in the browser.
- `SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED=true` **and**
  `SERVICEDESK_QUOTE_SOURCE_WORKER_ENABLED=true` are set **after** the staging
  SQL, two-tenant RLS and forced-crash acceptance gates pass.
- `SERVICEDESK_QUOTE_SOURCE_WORKER_SECRET` is generated by the owner and
  stored privately in the managed scheduler and service environment (at
  least 40 characters; never commit, print or send it through this document).
- A separately approved scheduler performs authenticated POST with header
  `Authorization: Bearer <private-service-only-secret>`. No scheduler is
  created by this changeset.

Each POST processes **at most 10** database-leased internal source events
using a server-generated worker ID. Caller-supplied tenant IDs, quote IDs,
provider recipients, action payloads and batch sizes are ignored. The status
response exposes only aggregate counts and stable error codes; it does not
return PII, quote IDs, tenant IDs, or provider delivery claims.

For emergency stop, disable the worker switch first, and the global quote
automation switch if necessary. That does not delete accepted quotes or
already persisted source rows. Operator-approved retries can resume after
database and worker health are restored, subject to lease and retry caps.

Do not mistake source compilation and an unauthorized (404/401) smoke test
for a working scheduler. Both SQL migration and first authenticated staging
event receipts must be verified before any production enabling.

