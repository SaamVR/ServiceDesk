# ServiceDesk AI — V1 E10 Core DB Acceptance

Worker: 1  
Sprint: V1-INT10  
Branch: `feat/servicedesk-v1-core-sprint9`  
Final-candidate base: `7dbf49e4e714b5f149d9efc083b8739d44eb3935`  
Coordinator ref: `0b0bb8d11c050673bf3b292136fe4e61c13b6cab`  
Staging project: `cpmmgivhlkfbiwzhlcey`

## Evidence posture

This packet records database/runtime evidence only. It does **not** claim:

- `CANONICAL_TESTED`
- `PROVIDER_VERIFIED`
- `BROWSER_VERIFIED`

Canonical package install/typecheck/Vitest execution was unavailable in this tool surface, and coordinator policy forbids samai/samvr/local-device fallback.

## Migration parity

Result: `PASS`

Repository migration ordering through `0014a_conversation_reply_usage_gate.sql` is deterministic and matches the staging migration chain observed in `supabase_migrations.schema_migrations`.

| Repository source | Staging migration name | Capability | State |
|---|---|---|---|
| `0001_core.sql` | `sd_0001_core` | Tenant, CRM, request, conversation base | PRESENT |
| `0002_quotes.sql` | `sd_0002_quotes` | Quotes/rate cards/approval base | PRESENT |
| `0003_capacity_visits.sql` | `sd_0003_capacity_visits` | Capacity, holds, visits, recurrence base | PRESENT |
| `0004_ledger_outbox_attention.sql` | `sd_0004_ledger_outbox_attention` | Ledger/outbox/attention | PRESENT |
| `0005_invoices_payment_applications.sql` | `sd_0005_invoices_payment_applications` | Invoices/payment applications | PRESENT |
| `0006_outbox_worker_runtime.sql` | `sd_0006_outbox_worker_runtime` | Outbox runtime/retry | PRESENT |
| `0007_outbox_completion_rpc.sql` | `sd_0007_outbox_completion_rpc` | Outbox completion RPC | PRESENT |
| `0007a_supabase_security_hardening.sql` | `sd_0007a_supabase_security_hardening` | Security hardening | PRESENT |
| `0008_conversation_inbox_runtime.sql` | `sd_0008_conversation_inbox_runtime_int4b` | Inbox runtime | PRESENT |
| `0009_e05_postgres_rpc_closure.sql` | `sd_0009_e05_postgres_rpc_closure` | Conversation/inbox/reply/snapshot RPCs | PRESENT |
| `0010_e03_verified_payment_rpc.sql` | `sd_0010_e03_verified_payment_rpc_int6` | Verified payment RPC | PRESENT |
| `0011_visit_field_runtime.sql` | `sd_0011_visit_field_runtime_int6` | Visit transitions/evidence/checklist | PRESENT |
| `0012_recurrence_runtime.sql` | `sd_0012_recurrence_runtime_int7` | Recurrence runtime | PRESENT |
| `0012a_recurrence_search_path_hardening.sql` | `sd_0012a_recurrence_search_path_hardening_int7` | Recurrence helper hardening | PRESENT |
| `0013_manual_payment_quality_runtime.sql` | `sd_0013_manual_payment_quality_runtime` | Manual payment + quality | PRESENT |
| `0013a_quality_attention_fk_hardening.sql` | `sd_0013a_quality_attention_fk_hardening` | Quality/attention FK hardening | PRESENT |
| `0014_reporting_platform_usage.sql` | `sd_0014_reporting_platform_usage` | Reporting/platform/usage | PRESENT |
| `0014a_conversation_reply_usage_gate.sql` | `sd_0014a_conversation_reply_usage_gate` | Reply usage enforcement | PRESENT |

Staging business RPCs observed under `public.servicedesk_%` are covered by durable repository migrations. No staging-only ServiceDesk business RPC was accepted as release-ready.

## Integrated authoritative journey

Result: `PARTIAL`

A single isolated synthetic workspace was created and exercised against the accepted DB command/RPC boundaries. The fixture used:

- Move-out
- total `$340` / `34000` minor
- deposit `$85` / `8500` minor
- balance `$255` / `25500` minor
- duration `240` minutes
- buffer `30` minutes
- quote valid `48h`
- slot hold `15m`

### Passed through accepted RPC boundaries

- verified sandbox deposit
- invoice allocation and balance
- ledger credit
- calendar outbox projection
- provider-event duplicate idempotency
- provider-transaction duplicate idempotency
- payment-review path for invalid repeated hold/payment state
- platform billing event separation
- inbound WhatsApp-style receipt
- conversation handover
- reply with usage consumption
- over-limit reply blocked before message/outbox mutation
- outbox lease claim/reclaim/stale-owner completion control
- visit assignment and crew transitions
- wrong-crew denial
- stale version denial
- before/after evidence gate
- submit review
- quality case open/start/resolve/review request
- manual balance payment
- duplicate manual payment idempotency
- visit completion and terminal reopen denial
- recurrence idempotency, pause/resume, skip, materialization dedupe, month-end/leap behavior
- reporting snapshot
- platform billing snapshot
- owner settings snapshot with no invitation token/hash leakage

### Partial reason

Initial setup still lacks final trusted DB command boundaries for:

- customer/property/request creation
- quote calculation/sending/acceptance
- capacity slot generation
- slot hold creation

Those early records were inserted as controlled synthetic fixtures so the accepted E03–E09 command boundaries could be proved. This gap is a release blocker for claiming a fully executable end-to-end authoritative journey.

## RLS matrix

Result: `FAIL`

Observed table-level RLS spot checks:

- Workspace A OWNER sees Workspace A request rows.
- Workspace A OWNER sees zero Workspace B request rows.
- Workspace A OWNER sees platform subscription for A.
- CREW sees zero private conversation rows.
- CREW sees zero platform subscription rows.
- Customer direct table RLS returned zero own invoice/conversation rows.

The customer result is fail-closed, not data leakage, but it does not satisfy the requested “customer sees only their authorized customer/business records” acceptance criterion. Customer-facing table/RPC visibility needs an explicit acceptance design before release.

## Concurrency/idempotency matrix

Result: `PASS`

Covered:

- duplicate provider event returns duplicate without second application
- duplicate provider transaction returns duplicate without second application
- deposit applied once
- exact invoice allocation after deposit
- exact payment ledger count
- exact calendar outbox count
- invalid repeated/expired hold payment routed to review
- platform subscription event does not mutate customer invoice, customer ledger, or verified payment applications
- duplicate manual payment does not double-credit ledger or invoice
- one outbox worker claims a dedicated pending row
- second worker blocked while lease active
- second worker reclaims after expiry
- stale worker cannot complete
- correct owner completes
- terminal event not reclaimed
- visit expectedVersion enforced
- wrong crew denied
- stale visit transition denied
- submit review blocked without required evidence
- submit review succeeds after before/after evidence
- terminal visit cannot be reopened
- recurrence duplicate/idempotency enforced
- skip-next persisted exactly one skipped occurrence
- materializer duplicate call did not create duplicate occurrence/request
- no recurrence-created visit truth
- usage limit blocks reply before business mutation

## Reporting/settings/quality

Result: `PASS`

Covered:

- reporting uses persisted workspace-scoped records
- cross-workspace report request rejected
- platform ledger excluded from cleaning revenue/customer ledger
- owner settings snapshot uses real service catalog, memberships, invitations
- invitation `token_hash` is not returned
- quality resolution closes linked attention
- review request outbox is emitted exactly once

## Security advisor classification

Result: `FINDINGS`

| Finding | Classification | Notes |
|---|---|---|
| `public.invitations` RLS enabled, no policy | `INTENTIONAL_DENY_ALL` | Invitations are readable via trusted owner settings snapshot only; direct table reads remain deny-all. |
| `citext` extension in public | `KNOWN_ACCEPTED_WARNING` | Existing staging warning; should be moved before production hardening. |
| `has_active_membership` callable by authenticated as SECURITY DEFINER | `KNOWN_ACCEPTED_WARNING` | Existing RLS helper exposure; candidate for private schema hardening. |
| `is_customer_for_workspace` callable by authenticated as SECURITY DEFINER | `KNOWN_ACCEPTED_WARNING` | Existing RLS helper exposure; candidate for private schema hardening. |
| Supabase Auth leaked password protection disabled | `NEW_RELEASE_BLOCKER` | Auth configuration hardening is required before production release. |

## Cleanup

Result: `YES`

Exact cleanup check returned:

```text
remaining_workspaces=0
remaining_auth_users=0
```

Only durable migration state remains.

## Unresolved release blockers

1. Full integrated journey is `PARTIAL` because early E01/E02 command boundaries are not exposed as final trusted DB RPCs for customer/property/request, quote, capacity, and slot-hold creation.
2. RLS matrix is `FAIL` because customer direct table/RPC visibility of own authorized business records is not acceptance-complete; current behavior is fail-closed for customer invoice/conversation rows.
3. Supabase Auth leaked-password protection is disabled.
4. Canonical package install/typecheck/Vitest execution did not run in this tool surface; coordinator policy forbids local-device fallback.
