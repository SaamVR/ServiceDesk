# ServiceDesk AI — V1-INT10 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT10  
Branch: `feat/servicedesk-v1-core-sprint9`  
Coordinator ref: `0b0bb8d11c050673bf3b292136fe4e61c13b6cab`  
Required final-candidate base: `7dbf49e4e714b5f149d9efc083b8739d44eb3935`  
ServiceDesk staging project: `cpmmgivhlkfbiwzhlcey`

## FIRST ACTION

```text
Observed branch: feat/servicedesk-v1-core-sprint9
Observed HEAD: 7dbf49e4e714b5f149d9efc083b8739d44eb3935
Required base: 7dbf49e4e714b5f149d9efc083b8739d44eb3935
HEAD_EXACT_MATCH=YES
```

## Files added

- `docs/execution/v1-e10-core-db-acceptance.md`
- `tests/db/v1-int10-core-acceptance-structure.sql`
- `docs/execution/receipts/v1-int10-worker-1.md`

## Migration parity

`MIGRATION_PARITY=PASS`

Observed staging migrations through `sd_0014a_conversation_reply_usage_gate`; all have durable repository source through `supabase/migrations/0014a_conversation_reply_usage_gate.sql`.

## Integrated journey

`INTEGRATED_DB_JOURNEY=PARTIAL`

The accepted E03–E09 authoritative DB command boundaries were exercised successfully. Initial E01/E02 setup still required controlled fixture inserts because the final candidate does not expose trusted DB command boundaries for:

- customer/property/request creation
- quote calculation/sending/acceptance
- capacity slot generation
- slot hold creation

## DB proofs completed

### Payment/platform

`PASS`

- deposit applied once
- duplicate provider event idempotent
- duplicate provider transaction idempotent
- review path triggered for invalid repeated hold state
- exact deposit allocation
- exact payment ledger count
- exact calendar outbox count
- platform event idempotent
- V1 Stripe/payment LIVE platform event rejected
- platform ledger does not mutate customer invoice/ledger/payment application

### Inbox/reply/usage/outbox

`PASS`

- inbound receipt applied
- handover applied using authoritative current conversation version
- no configured usage limit returned `UNLIMITED`
- configured outbound message limit consumed once
- within-limit reply created one message and one outbox
- over-limit reply returned `USAGE_LIMIT_REACHED` before message/outbox mutation
- dedicated outbox row claim blocked second worker while lease active
- reclaim after expiry succeeded
- stale worker could not complete
- correct worker completed
- terminal event did not re-enter claim flow

### Visit/evidence/quality/manual payment

`PASS`

- visit assignment via staff
- wrong crew denied
- assigned crew EN_ROUTE
- stale transition denied
- START succeeded
- SUBMIT_REVIEW blocked before required evidence
- BEFORE_PHOTO and AFTER_PHOTO persisted
- SUBMIT_REVIEW succeeded
- quality case opened with linked attention
- quality stale action denied
- quality resolved and linked attention closed
- review-request outbox exactly once
- manual balance payment closed invoice to PAID
- duplicate manual payment did not double-credit
- visit completion succeeded
- terminal visit could not be reopened

### Recurrence

`PASS`

- create idempotency
- pause/resume
- skip-next exactly once
- materialization dedupe across repeated materializer calls
- no visit created directly by recurrence materializer
- Jan 31 -> leap February clamp behavior proved
- leap February -> March monthly behavior proved

### Reporting/billing/settings

`PASS`

- owner report succeeded
- cross-workspace report rejected
- crew report denied
- owner platform billing snapshot succeeded
- dispatcher platform billing denied
- owner settings snapshot succeeded
- dispatcher owner settings denied
- invitation token/hash did not leak

## RLS matrix

`RLS_MATRIX=FAIL`

Actual table-level RLS spot checks:

- owner A saw Workspace A request rows
- owner A saw zero Workspace B request rows
- crew saw zero private conversation rows
- crew saw zero platform subscription rows
- customer direct table RLS returned zero own invoice/conversation rows

This is fail-closed, not data leakage, but it does not satisfy the requested customer visibility criterion.

## Security advisor

`SECURITY_ADVISOR=FINDINGS`

Classified findings:

- `public.invitations` RLS enabled/no policy — `INTENTIONAL_DENY_ALL`
- `citext` in public — `KNOWN_ACCEPTED_WARNING`
- `has_active_membership` SECURITY DEFINER callable by authenticated — `KNOWN_ACCEPTED_WARNING`
- `is_customer_for_workspace` SECURITY DEFINER callable by authenticated — `KNOWN_ACCEPTED_WARNING`
- Supabase Auth leaked-password protection disabled — `NEW_RELEASE_BLOCKER`

## Cleanup

`PROOF_FIXTURES_CLEANED=YES`

Exact cleanup verification:

```text
remaining_workspaces=0
remaining_auth_users=0
```

## Final status

```text
WORKER=1
SPRINT=V1-INT10
STATE=BLOCKED
CANONICAL_GATE=CONFIGURATION_BLOCKED
MIGRATION_PARITY=PASS
INTEGRATED_DB_JOURNEY=PARTIAL
RLS_MATRIX=FAIL
CONCURRENCY_MATRIX=PASS
SECURITY_ADVISOR=FINDINGS
PROOF_FIXTURES_CLEANED=YES
READY_NEXT=final coordinator integration/release packet
```

Release blockers:

1. Missing final trusted DB command boundaries for early E01/E02 journey setup: customer/property/request, quote, capacity slot, and slot hold.
2. Customer table-level RLS visibility is not acceptance-complete; direct customer RLS returned zero own invoice/conversation rows.
3. Supabase Auth leaked-password protection is disabled.
4. Canonical package install/typecheck/Vitest were not executable in this tool surface and local fallback is forbidden.
