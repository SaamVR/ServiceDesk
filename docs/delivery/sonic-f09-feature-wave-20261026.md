# SONIC F09 — new automation feature wave and integration contract

**Owner-directed scope expansion:** 2026-10-26 “add features and automation from the development plan, fixes in Production lane.” Track in [#851](https://github.com/SaamVR/ServiceDesk/issues/851), original SONIC roadmap `docs/engineering/ai/sonic-ai-first-delivery-plan-20261018.md`, [72-task source inventory](https://github.com/SaamVR/ServiceDesk/issues/173), master [#808](https://github.com/SaamVR/ServiceDesk/issues/808).

**Authority distinction:** This grants isolated **Feature source work** notwithstanding the historical F08 “no nonessential features before P12” freeze, not authority for production or canonical merge. F08 source and its provenance remain frozen as a separate draft; Production owns P02–P12 security/release corrections.

## What F09 newly implements (and what it does not)

| Lane | New typed/source functionality | Operational gap |
|---|---|---|
| E08 | Eight additional event-family validators: MESSAGE_RECEIVED, QUOTE_SENT, CREW_ASSIGNED, INCIDENT_REPORTED, QA_FAILED, INVOICE_ISSUED, PAYMENT_FAILED, RECURRING_VISIT_DUE. Typed persisted-source projection, OWNER workspace/branch validation, expected version, strict states, trusted zone instants, deterministic source candidate hash | No shared `WorkflowEventType` contract addition, database-source journal, publisher or trigger transport; an event fingerprint is not idempotent execution proof |
| A04 | Four additional guarded internal action drafts: SET_INTERNAL_PRIORITY, CREATE_DRAFT_REPLY, SUGGEST_SLOT, START_N8N_APPROVED_JOB. Revalidates E08 event, exact source hash, constrained templates, priority and crew slot bounds, hardcoded known internal N8N job codes | No task/approval/draft writer, booking hold, N8N endpoint call, provider/customer send, job publication or spend |
| R04 | Deterministic internal owner-work proposals for four missing #173 categories: duplicate lead merge review (#4), unanswered lead SLA escalation (#10), quote-open follow-up (#18), crew check-in overdue escalation (#31) | No scheduled daemon, re-read and saved job transaction, escalation notifier, merge, callback, owner-rule publish or actual work completion |

**Source type coverage, not operational coverage:** Existing published runtime has five events and three actions; earlier F06 (draft #841) covers four other proposed events and four preview actions. F09 adds the remaining eight event proposal validators and four action draft kinds. This covers **12/12 original new event names and 8/8 new action names in proposed/reviewable source** across F06 and F09, but **0/12 and 0/8 are claimed published LIVE** from this feature batch. The original 72-workflow issue remains open; F09's four policy planners do not claim the business workflows are executing.

## Strong input and safety policy

- Accept strictly shaped plain values and known enum choices; malformed dates, injection fields, getters, untrusted actors and mismatched tenants/versions fail closed.
- Store no customer PII in proposal fingerprints or operational plans. Do not copy emails, phone numbers, raw message bodies, provider receipts or arbitrary N8N URLs into the review payload.
- Candidate stable fingerprints are **not** database uniqueness, consent, actual sent/delivered/paid, verified saved source or latest owner authorization; all are marked source-unverified.
- Preserve a deterministic result of `NOT_DUE` for valid saved projections not yet meeting time thresholds, to avoid spurious alerts and false notifications.
- Never merge duplicate leads, send customer follow-up, charge/refund, change crew assignment, create new automated external action or call N8N through a source-only pure function.
- An internal attention/task writer later needs authenticated stored source reread, owner/branch permission, saved version compare-and-swap, transactional unique idempotency ledger, retries/dead-letter and real owner review.

## Production integration plan (future, separately authorized)

1. Land the F09 reviewed source additively into canonical with a Production-approved PR decision after exact-head CI; reconcile future F06 integration without double-writing the existing shared contracts.
2. Introduce new `WorkflowEventType` types only after a migration-backed, tenant-scoped committed event source is available for each. Each event requires unique source ID/revision and immutable signed/audited journal, proper calendar/time-zone semantics, and authenticated provider callback for status assertions.
3. Attach internal action writers to current stable event hashes only after saved source + branch role reread. Require owner approval for external send, N8N job allowlist/credential and billing; no arbitrary execution.
4. Add a scheduled task scan/replay worker only after idempotent internal review-task uniqueness, event source repair, leasing, bounded retries and a real multi-tenant staging acceptance. A pure planner is neither a scheduler nor a queued job.
5. Preserve exact quote/invoice/crew financial outcomes from real SQL/provider receipts. Do not equate `QUOTE_SENT` with delivered, `PAYMENT_FAILED` with a customer charge, or `SUGGEST_SLOT` with a confirmed booking.

## Deliverables and verification

- Source: `src/server/ai/sonic-f09-event-families.ts`, `sonic-f09-internal-actions.ts`, `sonic-f09-operational-recipes.ts`
- Adversarial tests: `tests/ai/sonic-f09-event-families.test.ts`, `sonic-f09-internal-actions.test.ts`, `sonic-f09-operational-recipes.test.ts`
- Four genuinely disjoint lanes: event source+tests, actions+tests, operational recipes+tests, and governance/critic. Coordinator integrates additive files atop verified current canonical into a single DRAFT PR.
- Run exact-head full RC, merge-tree parity and Critic acceptance-integrity. **G0 source pass does not authorize G1–G4 operational/provider/release acceptance.** If tests fail, repair on owning feature branches and rerun all three gates at the final SHA.

This batch performs **zero** Supabase DDL or writes, customer communication, paid model/provider calls, N8N jobs, payments, canonical promotion, branch cleanup or device dependency deletions.
