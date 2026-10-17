# R20 Independent Critic — persisted clock integrity and invoice collection usefulness

Date: 2026-10-17 UTC. Scope: **logical independent Critic lane inside a single engineering conversation**, not a separate active human or background agent. Baseline controller: `a758a87827b7be02e363d0e61eee1f8c9eb0014e`. Intended integration target: `feat/servicedesk-v4-reconciled-qa-shell-20261012`; do not promote an obsolete controller SHA.

## Reviewed, disjoint implementation lanes

- [Core R20A #601](https://github.com/SaamVR/ServiceDesk/pull/601), source `src/server/core/conversation-postgres.ts` and `tests/db/v4-r20-snapshot-zoned-calendar-evidence.test.ts`. Current reviewed candidate head `946fcf1c0928a530c2527ad36ef2926a4f5a96cf`. Strict civil-valid UTC/offset timestamp validation for saved request/visit/recurrence/audit records and saved conversation messages, including PostgreSQL microseconds and real leap days. Rejects Feb 30, Apr 31, local/offsetless source clocks, unsafe time fields and impossible timezone offsets. Preserves valid +06:00, +14:00, UTC and -12:00 values.
- [Product R20B #603](https://github.com/SaamVR/ServiceDesk/pull/603), source `src/features/operations/invoice-collection-queue.ts` and `tests/e2e/v4-r20-collectible-invoice-exact-minor-units.test.ts`. Current candidate head `3733740b562cbd4908af539cff9a79b1889ed377`. Rejects fractional/unsafe money as collectible. **Practical utility review also caught a complete saved-ledger mismatch:** an issued invoice with positive integer balance but incoherent total/allocation/refund was counted in the staff 'open' queue. Candidate now reuses `isVerifiedStaffCollectibleInvoice` when actual full invoice ledger fields exist, aligning displayed open count with payment action's verified ledger gate. Lightweight source projections with only status and balance retain the narrower queue-only behavior; they are not proof of actual payment readiness.

All changes are read-only projection/presentation. This is **not** an invoice payment, refund, provider send, charge, recurrence execution, authorization change, migration 0063, deployment or production main merge.

## Adversarial findings and RED→GREEN ledger

**Core first PR attempt FAILED** full-source Vitest [run #39018717705](https://github.com/SaamVR/ServiceDesk/actions/runs/39018717705): new test expected bad `2026-02-30T12:00:00Z` message source to fail, but distinct legacy `messageFromRpc` Date.parse guard still accepted it. Test report: 1 failed test / 3036 total at initial SHA `f3be6d26c501962a3b0b1623e930e3c53d527a18`. This is genuine adversarial feedback, not a flaky failure. Fix commit `946fcf1c0928a530c2527ad36ef2926a4f5a96cf` unifies persisted message clocks with strict shared validation. **Do not count corrected Core as PASS until exact-head full-source #39018930638 is green.**

**Product follow-up**: initial implementation only tightened integer precision. Critic found real full-ledger inconsistency in queue labels, not payment action: collected amount was already protected in `OperationalProductRoute.tsx` via full saved invoice readiness. Product now validates full ledger whenever full invoice evidence appears. Additional tests for full ledger reconciliation plus lightweight partial projection are authored on candidate `3733740b562cbd4908af539cff9a79b1889ed377`. **Do not count Product as PASS until exact-head #39019043612 is green.** Earlier Product source checks on superseded SHAs are not acceptance and may be cancelled by branch-scoped concurrency.

## Independent review and limitations

1. **Source-level relevance:** these bugs affect whether staff see fabricated scheduled times or an actionable-looking invoice. Fixing these negative cases reduces false confidence in a saved workspace snapshot.
2. **Not a substitute for authorization:** scoped RPC and authenticated session protections remain server/DB-owned; malformed projection tests use mock RPC, not two real signed-in owners. If a materialization/ledger is absent, its absence must remain visible.
3. **Current real merchant blocker:** connected Supabase read-only counts previously showed one workspace/one request and **zero** priced service/branch price books, quotes, visits, invoices, workflow executions and outbox events. [Merchant acceptance #487](https://github.com/SaamVR/ServiceDesk/issues/487) is BLOCKED. There is no evidence of real end-to-end quote→accept→visit→invoice payment utility.
4. **Review security boundary:** Core rejects offset values >14 hours and requires calendar dates. It does not prove provider callback timestamp authenticity; signature/tenant checks are separate. Product source-only queue projections lacking ledger cannot verify reconciliation, although complete invoices from business DTOs can.
5. **Failure accounting:** one observed failing Core test was corrected, not hidden. No claim of zero real errors or of provider acceptance. CI wall elapsed and billed runner minutes are distinct; no billed compute cost has been measured. Avoid repeated full-source runs on identical SHA.
6. **Integration rule:** accept only newest pinned head on each source lane with full `pnpm check:rc` + merge parity + Critic CI PASS. Integrator must merge once into a newly reconciled controller and require **both** canonical full-source/Chrome and independent PG17 PASS on the exact merged SHA. Ignore older cancelled controller runs.

## Verdict at authoring: HOLD pending exact-head source CI

Core and Product are **IMPLEMENTED on isolated branches**; only their final exact-HEAD checks can mark them source CONTRACT_TESTED. The independent Critic recommends composite source integration after both pass and after verifying zero overlap with concurrently active R19 paths. A successful composite source run still does not grant `OPERATIONS_VERIFIED` or `PROVIDER_VERIFIED`.

The isolated R17G recurrence command-receipt WIP remains excluded because its separate PR creation was tool-safety blocked. Do not smuggle that code into R20 through alternate APIs.

Next useful high-leverage work after source merge: obtain authorized UAT prerequisites for two real merchant owners, real priced service/rate card and connected quote/visit/invoice evidence; avoid further semantically overlapping mock-only hardening while acceptance #487 is unresolved.
