# ServiceDesk AI — Supabase Staging Proof

Date: 2026-10-04
Project: `ServiceDesk`
Supabase project ref: `cpmmgivhlkfbiwzhlcey`
Region: `us-east-1`
Postgres: `17.11`
Status: `ACTIVE_HEALTHY`

## Scope

This project is the dedicated ServiceDesk staging database.
Do not reuse or mutate unrelated Supabase projects.

Stripe remains SANDBOX/DEMO only.

## Applied migrations

Applied successfully:
- `sd_0001_core`
- `sd_0002_quotes`
- `sd_0003_capacity_visits`
- `sd_0004_ledger_outbox_attention`
- `sd_0005_invoices_payment_applications`
- `sd_0006_outbox_worker_runtime`
- `sd_0007_outbox_completion_rpc`
- `sd_0007a_supabase_security_hardening`

Repository RC containing current staging migration fixes:
`rc/servicedesk-v1-unverified-20261004`
HEAD observed after hardening:
`3103c00796fc4e193266e0261d134a510ecf5215`

## Migration issue found by real Postgres

Initial `0006_outbox_worker_runtime.sql` failed atomically on Postgres 17 because the migration added enum value `SUPPRESSED` and referenced that new value in an index predicate inside the same transaction.

Postgres error:
`55P04 unsafe use of new value "SUPPRESSED" of enum type outbox_status`

Repair:
- `0006` now adds/commits the enum before any dependent literal use.
- `outbox_terminal_idx` moved to `0007`.

Repaired migrations applied successfully.

## Security hardening

First Supabase advisor pass found:
- `anon` execute inherited/explicit on RLS helper functions;
- `rls_auto_enable()` callable by public/anon/authenticated;
- invoice/payment read policies lacked explicit `TO authenticated`.

Applied `0007a_supabase_security_hardening.sql`:
- revoked anon execute on `has_active_membership`;
- revoked anon execute on `is_customer_for_workspace`;
- revoked public/anon/authenticated execute on `rls_auto_enable()` when present;
- recreated invoice/payment read policies with `TO authenticated`.

Remaining security advisor findings:
- invitations has RLS enabled with no policy — intentional deny-all until invitation flows are implemented;
- citext extension is installed in public — non-blocking staging warning;
- authenticated may execute two SECURITY DEFINER RLS helper functions — currently intentional because RLS policies depend on them. Consider moving helpers to a non-exposed private schema before release.

## E03 staging schema proof

Used rollback/cleanup-safe proof data based on the frozen V1 fixture:
- quote total: 34000 minor = $340;
- deposit: 8500 = $85;
- balance: 25500 = $255;
- service duration: 240 minutes;
- buffer: 30 minutes;
- hold: 15 minutes.

Observed:
- invoice total = 34000;
- allocated = 8500;
- balance = 25500;
- duplicate provider-event insert did not create a second application;
- duplicate provider transaction+purpose insert did not create a second application;
- authoritative payment application count remained 1;
- ledger count remained 1;
- outbox count remained 1;
- invalid invoice accounting equation was rejected by DB constraint;
- cross-workspace payment target reference was rejected by composite FK.

Staging proof data was deleted after verification.

### E03 remaining blocker

Core currently defines `PaymentApplicationRepository.transaction(...)` and `PaymentApplicationUnitOfWork`, but there is no concrete Postgres/Supabase implementation.

Therefore:
- schema/idempotency/integrity controls are staging-verified;
- the actual Core `applyVerifiedPayment` transaction is not yet database-wired;
- do not claim full `OPERATIONS_VERIFIED` for E03.

Next Core work must implement the concrete Postgres transaction adapter and execute real transaction rollback/idempotency proof against this staging project.

## E04 staging proof

Real database proof executed against the migrated outbox tables/RPCs.

Observed:
- Worker A claimed ready row;
- Worker B could not acquire it before lease expiry;
- Worker B reclaimed it after lease expiry;
- stale Worker A did not win completion;
- current Worker B completed the row;
- final state = `SENT`;
- attempt count = 2;
- lock owner/timestamp cleared;
- provider reference persisted;
- terminal row reclaim count = 0.

Coordinator DB repairs already in RC:
- claim RPC uses `SECURITY INVOKER`;
- claim RPC execute restricted to `service_role`;
- completion RPC is lease-owner atomic;
- trusted Postgres RPC gateway exists in `src/server/jobs/outbox-postgres-gateway.ts`.

Staging proof data was deleted after verification.

### E04 evidence ruling

Database lease/reclaim/stale-owner semantics are staging-verified.
Canonical application typecheck/Vitest and a real runtime invocation through the Supabase JS/RPC client remain pending because package access in GPT Runtime is still blocked.

Do not upgrade the whole E04 capability beyond the currently justified evidence label until those canonical application checks run.
