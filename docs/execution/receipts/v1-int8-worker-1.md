# ServiceDesk AI — V1-INT8 Worker 1 Receipt

Worker: 1  
Sprint: V1-INT8  
Branch: `feat/servicedesk-v1-core-sprint7`  
Coordinator ref: `c1f45b5d7ce21b0ce0eef006dcf9ac19feaf1e8c`  
Required base: `a8711c1bffda3cd52cf9938f87ce8546ba7bef1d`  
ServiceDesk staging project: `cpmmgivhlkfbiwzhlcey`

## HEAD verification

FIRST ACTION result:

```text
Branch: feat/servicedesk-v1-core-sprint7
Observed HEAD: a8711c1bffda3cd52cf9938f87ce8546ba7bef1d
Required base: a8711c1bffda3cd52cf9938f87ce8546ba7bef1d
HEAD_EXACT_MATCH=YES
```

## Source changes

Added:

- `supabase/migrations/0013_manual_payment_quality_runtime.sql`
- `supabase/migrations/0013a_quality_attention_fk_hardening.sql`
- `src/server/core/manual-quality-postgres.ts`
- `tests/db/v1-int8-manual-quality-rpc-structure.sql`

Updated:

- `src/server/core/conversation-postgres.ts`

## Manual payment implementation

Durable source now defines:

- `manual_payment_records`
- `servicedesk_apply_manual_payment(jsonb)`

RPC posture:

```text
SECURITY_INVOKER=YES
ANON_EXECUTE=false
AUTHENTICATED_EXECUTE=false
SERVICE_ROLE_EXECUTE=true
```

Manual payment behavior proved on staging:

- OWNER/DISPATCHER authority required.
- Invoice workspace enforced.
- Positive amount required.
- Amount cannot exceed current authoritative balance.
- Exact currency required.
- Method constrained to CASH / BANK_TRANSFER / OTHER.
- Reference and idempotency required.
- Duplicate idempotency returns prior authoritative invoice without a second audit/ledger/outbox mutation.
- Audit persists actor/method/reference.
- Ledger CREDIT written transactionally.
- Invoice allocation/balance/version/status update is transactional.
- `invoice.manual_payment_recorded` outbox is enqueued exactly once.
- No provider/Stripe authority or provider call is used.

## Quality core implementation

Durable source now defines:

- `quality_cases`
- `servicedesk_open_quality_case(jsonb)` internal trusted opening path
- `servicedesk_apply_quality_case_action(jsonb)`

Quality behavior proved on staging:

- Opening creates a linked QUALITY attention item transactionally.
- Duplicate open idempotency returns prior quality case.
- START_REVIEW moves OPEN -> IN_REVIEW.
- ASSIGN validates active OWNER/DISPATCHER owner and preserves owner on linked attention.
- Stale expectedVersion returns `VERSION_CONFLICT`.
- RESOLVE requires resolution note.
- RESOLVE closes linked open QUALITY attention and marks review request `ELIGIBLE`.
- REQUEST_REVIEW only works after RESOLVED + ELIGIBLE and enqueues one `quality.review_request` outbox.
- No direct Email/WhatsApp provider call is made.

## Snapshot / attention mapping

`servicedesk_read_workspace_snapshot(jsonb)` and the concrete Supabase adapter now include:

- real `invoices`
- real `qualityCases`
- real `attentionItems`, preserving `ownerUserId` and `dueAt`
- existing recurrence/evidence/checklist/conversation/message arrays

## ServiceDesk staging proof

Applied to ServiceDesk staging only:

```text
PROJECT=cpmmgivhlkfbiwzhlcey
MIGRATION=sd_0013_manual_payment_quality_runtime
FOLLOW_UP=sd_0013a_quality_attention_fk_hardening
```

Proof result:

```text
MANUAL_PAYMENT_DB_PROOF=PASS
QUALITY_DB_PROOF=PASS
remaining_fixture_workspaces=0
remaining_fixture_auth_users=0
PROOF_FIXTURES_CLEANED=YES
```

Proof covered:

- partial manual payment
- final manual payment
- duplicate idempotency
- no double ledger/audit/outbox
- amount greater than balance rejected
- currency mismatch rejected
- unauthorized rejected
- VOID/PAID rejected
- forced outbox failure rolled back invoice/audit/ledger
- actor/method/reference audit persisted
- quality creation
- linked attention
- duplicate quality open idempotency
- assign/start review/version conflict
- resolve requires resolution note
- resolve closes linked attention
- review request only after resolved/eligible
- one review outbox
- cross-workspace isolation
- snapshot returns invoices/quality/attention with owner/due
- fixture cleanup

## Security advisor

Current advisor findings after INT8:

- `public.invitations` has RLS enabled with no policy — pre-existing intentional deny-all.
- `citext` extension is installed in public — pre-existing staging warning.
- `public.has_active_membership(...)` and `public.is_customer_for_workspace(...)` are signed-in executable SECURITY DEFINER helpers — pre-existing RLS helper findings.

No new INT8 RPC public/anon/authenticated execution exposure was observed.

## Runtime / canonical gate

Package install/typecheck/Vitest canonical execution was not run in this tool surface. Coordinator policy forbids samai/samvr/local-device fallback, so this remains a configuration/runtime gate rather than a PASS.

## Final status

```text
WORKER=1
SPRINT=V1-INT8
STATE=OPERATIONS_VERIFIED
CANONICAL_GATE=CONFIGURATION_BLOCKED
MANUAL_PAYMENT_DB_PROOF=PASS
QUALITY_DB_PROOF=PASS
PROOF_FIXTURES_CLEANED=YES
READY_NEXT=E09 reporting/admin/settings/platform billing core
```
