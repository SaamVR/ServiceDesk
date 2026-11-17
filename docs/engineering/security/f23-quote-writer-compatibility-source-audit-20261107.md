# F23 quote-writer compatibility and DBA aggregate preflight

**Status: SOURCE AUDIT ONLY — F23 RELEASE VETO ACTIVE — DO NOT INSTALL SQL OR ENABLE FLAGS.**

## Scope and evidence hierarchy

The only observed connected ServiceDesk Supabase state during this source audit is **INACTIVE**. Historical migration files and legacy TypeScript interfaces are source evidence, not proof of the currently installed database indexes, function definitions, active customer data, or active application write path. No connected project was restarted or queried for tenant rows.

### Concrete source findings

| Surface | Reviewed evidence | DBA implication |
| --- | --- | --- |
| Quote table source preimage | `supabase/migrations/0002_quotes.sql` defines all statuses `DRAFT/PENDING_APPROVAL/APPROVED/SENT/ACCEPTED/DECLINED/EXPIRED/SUPERSEDED` and `UNIQUE (workspace_id, request_id, version)`; the file contains no matching partial unique current-quote index | Version uniqueness does NOT prove at most one non-`SUPERSEDED` quote. Inspect deployed `pg_indexes` and `pg_constraint` |
| Historical legacy revision seam | `src/server/core/quotes.ts`, `createQuoteDraftWithRepository`: `await repository.supersedeQuote(previous.id)` THEN `await repository.saveQuote(versionedQuote)` | Two distinct awaited operations without an explicit transaction on the QuoteRepository interface. A fictional throw on the second step demonstrates the prior quote may already have been superseded. Actual gateway transaction behavior must be audited independently |
| Quote repository adapter | `src/server/core/quote-repository.ts` delegates `supersedeQuote` and `saveQuote` separately | Verify every concrete writer and whether a single database RPC/transaction wraps both calls; do not assume this interface guarantees atomicity |
| First-quote owner workflow | `src/server/ai/owner-inbox-first-quote.ts` reads current quote count, then invokes the existing calculator, and explicitly warns independent owner clicks may race | Requires authoritative quote reservation/creation SQL inspection; source readback alone cannot prove the first-quote invariant |
| Staff quote queue | `src/features/operations/quote-pipeline.ts` independently computes ambiguous-current-quote request counts | Existing UI has a fail-closed display strategy for ambiguity, but no database constraint follows from it |
| F23 release candidate | `docs/engineering/security/f23-atomic-hold-release-rpc-candidate.sql` locks selected quote/hold, then counts non-`SUPERSEDED` siblings | Existing quote `FOR UPDATE` does not serialize a new sibling quote ID. Real two-session disposable PG17 reproduces `RELEASED:2:0:0` |
| Historical payment RPC | `supabase/migrations/0010_e03_verified_payment_rpc.sql` locks selected quote THEN hold, books visits and invoices | F23 concurrency must be checked against complete deployed payment RPC and provider event policy, not just simulated lock acquisition |

### Concrete additional source-only regression witness

`tests/ai/f23-current-quote-schema-compatibility-veto.test.ts` includes a fictional repository gateway that supersedes an old quote, then throws on successor save. The expected old status remains `SUPERSEDED`, while successor is not saved. This tests the legacy interface's *lack of a guaranteed atomic rollback*. It is NOT proof of a connected production defect or payment.

The test also enforces that:
- The historical quote schema supplies version uniqueness, not an established single-current-quote invariant.
- The F23 SQL's unprotected sibling count remains classified as unsafe.
- Neither the partial unique index prototype nor the test witness is presented as an approved migration.
- The DBA aggregate query runs in an explicit `REPEATABLE READ READ ONLY` transaction, returns no identifiers and sets `safeToEnableF23=false`.

## Aggregate-only installed-schema preflight (DBA must authorize execution)

Source file: `scripts/release/v4-f23-current-quote-readonly-preflight.sql`.

The script reports only aggregate totals of quote statuses, number of request groups with two or more non-`SUPERSEDED` quotes, highest sibling count, total quote indexes and the number of *candidate* unique current-quote index definitions. It deliberately returns **no workspace/request/user/quote IDs, no prices and no payment/provider details**. Its index-candidate count is NOT an exhaustive uniqueness proof; manual `pg_get_indexdef` and writer audit are still required.

The script is run only on fictional localhost `sd_f23_disposable` inside CI, both **before** and **after** the review-only partial-unique-index experiment. A future connected run requires the owner/DBA's explicit permission, approved target and separate procedure. Never treat an aggregate `0` for duplicates as proof of safety under concurrent writes.

## Release-fix decision tree for the human DBA

1. **Actual current unique index already installed?** Compare installed definition/predicate/validity, real quote writers, staging status, applied migration ledger and historical triggers. If equivalent, investigate why F23 still needs source guards; test real transactions.
2. **No matching index?** Read the aggregate duplicate preflight on an authorized target. Decide whether `status <> 'SUPERSEDED'` aligns with every legitimate quote revision, rejection, cancellation, expiry and draft workflow; many historical statuses are included. A broad partial unique index can reject legal business history if the state machine is incompatible.
3. **Index compatible and zero dirty groups?** Design the *atomic* revision path: supersede predecessor and insert successor in **one** database transaction, with scoped version CAS/authorization. Test retries, conflicting owner clicks, payment/booking races, and rollback on insert failure. Test all independent quote writers, not just the legacy repository seam.
4. **Index incompatible or actual duplicate groups?** Do not apply the prototype or delete data. Design a different persisted current-quote invariant, data reconciliation plan, and safe quote-writer migration under explicit DBA/owner approval.
5. **Deployment method:** An ordinary `CREATE UNIQUE INDEX` blocks concurrent writes; `CREATE UNIQUE INDEX CONCURRENTLY` has operational caveats and cannot run inside a transaction block. Choose a separately approved migration path and rollback with DBAs. PostgreSQL references: https://www.postgresql.org/docs/17/indexes-partial.html and https://www.postgresql.org/docs/17/sql-createindex.html.

**External payment closure remains independent:** an index does not detect provider events still in transit, settle a refund, guarantee payment idempotency, or prove the complete `0010` payment RPC will not race.

## Unchanged approval boundaries

- F23 candidate `servicedesk_release_held_slot_atomic` is **UNAPPLIED and NOT SAFE TO ACTIVATE** with current source proof.
- Keep `SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED` and `SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED` both OFF.
- P02 requires real distinct signed-in owner JWT/browser/RLS evidence, and P03 requires real saved price/book/branch/currency evidence. Offline mock tests do not satisfy those acceptance gates.
- Vercel is selected as future host but no specific deployment permission is provided.
- No connected Supabase, tenant data, Auth, payment, provider, hosting or canonical-branch mutation authorized by this document.
