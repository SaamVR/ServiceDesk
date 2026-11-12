# F23 current-quote phantom — DBA release veto and reviewed options (2026-11-07)

**Status: REVIEW ONLY · SQL NOT INSTALLED · F23 RELEASE DISABLED · NO PRODUCTION APPROVAL.**

## Verified failure in disposable native PostgreSQL 17

Original candidate source: `docs/engineering/security/f23-atomic-hold-release-rpc-candidate.sql`.

- It locks the **selected** ACCEPTED quote `FOR UPDATE`, then the selected HELD slot `FOR UPDATE`.
- It locks the owning `requests` row only `FOR SHARE`.
- It checks `count(*)` of non-`SUPERSEDED` quotes for that request, but no database uniqueness invariant is established for **another quote ID** inserted afterward.
- `FOR SHARE` on the request is compatible with the foreign-key `FOR KEY SHARE` access of a sibling quote INSERT. The original quote row's `FOR UPDATE` lock does not cover other IDs.
- The isolated witness `scripts/release/v4-f23-pg17-sibling-quote-phantom-witness.sh` adds an explicit quote→request foreign key to the fictional fixture. Session A releases the hold inside an uncommitted transaction; independent session B inserts a second ACCEPTED quote for the same request before A commits. The observed final state is `RELEASED:2:0:0` (released hold, two non-superseded quotes, no payment applications or visits). Receipt: `F23_KNOWN_UNSAFE_SIBLING_QUOTE_PHANTOM_REPRODUCED_RELEASE_VETO`.

**Interpretation:** A demonstrated candidate-level concurrency vulnerability in the fictional schema. This is not evidence of a production incident, nor proof that the installed database has or lacks an equivalent uniqueness constraint. No release gate may be cleared from the witness.

## Candidate mitigation A — database-enforced partial uniqueness (preferred to evaluate)

The prototype test runs the following DDL **only inside disposable PG17**:

```sql
CREATE UNIQUE INDEX sd_f23_review_only_one_current_quote
  ON public.quotes(workspace_id, request_id)
  WHERE status <> 'SUPERSEDED';
```

This imposes **at most one** non-superseded quote per tenant/request across independent writers, even if the writer does not share an advisory lock. The isolated mitigation suite `scripts/release/v4-f23-pg17-unique-current-quote-remedy-prototype.sh` verifies rejection of concurrent sibling INSERT (SQLSTATE `23505`) and compatibility with transactional **SUPERSEDE old quote, then INSERT successor** ordering. It does *not* prove that all existing quote authoring workflows are compatible.

### Independent DBA/owner approval prerequisites (unmet)

1. Inspect **actual installed schema**, applied migrations, quote status enum, FK behavior, indexes/constraints, RLS and installed payment RPC. Never infer deployed schema from the fictional PG17 fixture.
2. Audit *every* quote writer (draft/revision/rejection/expiration/supersession, provider webhook, admin edits) to establish whether there may legitimately be more than one non-`SUPERSEDED` quote per request. If so, the proposed predicate is **incompatible** and must be redesigned; do not silently coerce statuses or backfill.
3. Run a read-only preflight for existing duplicates grouped by `(workspace_id, request_id)` with `status <> 'SUPERSEDED'`; determine a separately authorized business reconciliation for any duplicates. Do not delete or rewrite existing customer quotes under this proposal.
4. Choose a migration/rollback approach: online `CREATE UNIQUE INDEX CONCURRENTLY` is not allowed within a transaction block and must use an explicitly reviewed deployment path; a regular `CREATE UNIQUE INDEX` can block quote writes. Avoid unapproved downtime. Do not apply either form from this development PR.
5. Re-run the **actual complete original payment RPC**, original hold/quote writers, new F23 RPC and quote replacement under disposable/staging transaction races, using verified exact deployed schema preimages.
6. Resolve provider events received *after* release, outside-DB pending payment evidence, refunds/reconciliation and capacity release customer communications. The uniqueness index cannot solve money-side idempotency or late-event acceptance.
7. Preserve `SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED=false` and `SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED=false` until an independent human DBA and owner approve exact SQL, stage, migration ledger, rollback and real P02/P03 receipts.

## Alternative B — per-request mutual exclusion (insufficient alone)

A request-row `FOR UPDATE` lock or transaction advisory lock can serialize against cooperative quote writers, but its safety depends on *all* relevant insert/update writers following the exact protocol and correct lock order. It does not establish the invariant independently of writers, and an insertion after release can still violate a business rule unless quote creation itself enforces it.

## No-go / success taxonomy

- `F23_KNOWN_UNSAFE_SIBLING_QUOTE_PHANTOM_REPRODUCED_RELEASE_VETO` = **vulnerability demonstrated; release veto remains active**.
- `PG17_F23_REVIEW_ONLY_...` = **disposable hypothetical mitigation test**; never production approval.
- `P02` real two-owner JWT/browser/RLS and `P03` saved branch pricing/quotes remain **separate operational blockers**.
- This document authorizes **no** connected Supabase, Vercel, Render, payment/provider or canonical-branch mutation.

**Next approved task:** DBA reviews deployed quote schemas and all quote writer protocols, decides whether the partial unique index is compatible, and scopes a separate staged migration only after explicit owner approval. Until then the F23 candidate stays unapplied and disabled.
