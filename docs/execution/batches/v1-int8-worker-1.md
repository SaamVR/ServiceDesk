# V1 Integration Sprint 8 — Worker 1 / E08 Invoice + Manual Payment + Quality Core

Branch: `feat/servicedesk-v1-core-sprint7`
Exact base: `a8711c1bffda3cd52cf9938f87ce8546ba7bef1d`
ServiceDesk Supabase staging: `cpmmgivhlkfbiwzhlcey`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- docs/execution/supabase-staging-proof-20261004.md
- this packet

Use coordinator-frozen E08 contracts:
- `QualityCaseDTO`
- `ManualPaymentInput`
- `QualityCaseAction`
- `QualityCaseActionInput`
- `applyManualPayment`
- `applyQualityCaseAction`
- expanded `WorkspaceSnapshot`

## Mission
Close E08 authoritative invoice/manual-payment/quality persistence. Financial truth remains ledger/invoice truth; Product/provider text never owns balances.

Use only ServiceDesk staging.

### T1 — E08 runtime migration
Add:
`supabase/migrations/0013_manual_payment_quality_runtime.sql`

Create `manual_payment_records` with:
- id/workspace_id/invoice_id
- ledger_entry_id
- actor_user_id
- amount_minor/currency
- method CASH|BANK_TRANSFER|OTHER
- reference
- occurred_at
- idempotency_key
- created_at
- unique(workspace_id,id)
- unique(workspace_id,idempotency_key)
- composite workspace invoice/ledger FKs.

Create `quality_cases` matching `QualityCaseDTO`:
- workspace/visit
- OPEN|IN_REVIEW|RESOLVED
- feedback_score optional 1..5
- summary
- owner_user_id
- due_at
- resolution_note
- review_request_state NOT_ELIGIBLE|ELIGIBLE|REQUESTED
- version
- timestamps
- unique(workspace,id)
- indexed state/owner/due
- visit composite FK.

RLS reads:
- OWNER/DISPATCHER quality/manual-payment read;
- CUSTOMER may read own invoice but not manual-payment audit internals or staff quality cases in V1;
- CREW quality read only if explicitly needed for assigned visit, otherwise deny.
Trusted server writes only.

Remove/replace any legacy authenticated direct ledger/attention mutation policies that bypass authoritative command RPCs if they remain from early migrations.

### T2 — attention domain alignment
Update Core attention domain/repository types to preserve already-persisted:
- ownerUserId
- dueAt

Do not drop these fields when snapshotting/round-tripping.

Quality case creation/action may link/resolve attention items atomically.

### T3 — atomic manual payment RPC
Implement trusted:
`servicedesk_apply_manual_payment(jsonb)`

Authorization:
OWNER or DISPATCHER only, actor user required.

Validate:
- invoice same workspace;
- invoice not VOID/PAID;
- amount positive integer;
- amount <= authoritative balance;
- currency exact match;
- method valid;
- reference nonblank/bounded;
- occurredAt valid;
- idempotencyKey required.

Atomic transaction:
- idempotency duplicate returns prior authoritative invoice;
- insert manual_payment_records audit row;
- append exactly one CREDIT ledger entry on INVOICE;
- increase allocated_minor;
- decrease balance_minor;
- status PARTIALLY_PAID if balance remains, PAID if zero;
- bump invoice version;
- enqueue exactly one `invoice.manual_payment_recorded` outbox event containing identifiers only.

No provider/payment adapter call.
No Stripe truth.

### T4 — manual payment Postgres adapter
Implement frozen `applyManualPayment` in Core/server entrypoints through typed Supabase RPC adapter.

Map invoice DTO truthfully and fail closed on malformed RPC output.

### T5 — quality case creation path
Add an internal trusted command/RPC for authoritative quality-case opening, suggested:
`servicedesk_open_quality_case(jsonb)`

It is not a new public facade method.

Use for server/job/feedback integration later.

Input:
workspace/visit/summary/feedbackScore?/owner?/dueAt?/idempotencyKey.

Rules:
- visit same workspace;
- duplicate idempotency returns prior case;
- one unresolved duplicate issue for same visit/idempotency only;
- create/open linked QUALITY attention item;
- feedback score <=2 may default reviewRequestState NOT_ELIGIBLE;
- never create provider review request here.

### T6 — quality lifecycle RPC
Implement frozen `applyQualityCaseAction` via atomic trusted RPC.

OWNER/DISPATCHER only; expectedVersion required.

START_REVIEW:
OPEN -> IN_REVIEW.

ASSIGN:
set authorized active staff owner;
state may remain OPEN/IN_REVIEW;
version bump.

RESOLVE:
OPEN or IN_REVIEW -> RESOLVED;
resolutionNote required;
resolve linked open QUALITY attention;
set reviewRequestState ELIGIBLE unless policy says NOT_ELIGIBLE.

REQUEST_REVIEW:
RESOLVED + ELIGIBLE only;
set REQUESTED;
enqueue exactly one `quality.review_request` outbox event;
no direct Email/WhatsApp call.

Terminal/stale transitions fail closed.

### T7 — snapshot
Update concrete `readWorkspaceSnapshot` RPC/adapter so:
- invoices map from real invoice rows;
- qualityCases map from real quality_cases;
- attentionItems preserve owner/due;
- recurrence/evidence/checklist arrays remain intact;
- no regression to E05/E07 authorization.

### T8 — real staging proof
Apply 0013 to only `cpmmgivhlkfbiwzhlcey`.

Prove:
- manual partial payment;
- second manual payment closes invoice;
- duplicate idempotency no second ledger/audit/outbox;
- amount > balance rejected;
- currency mismatch rejected;
- unauthorized rejected;
- VOID/PAID rejected;
- forced outbox/ledger failure rolls back invoice/audit;
- audit actor/method/reference persisted;
- open quality case + attention;
- duplicate open idempotency;
- assign/start review/version conflict;
- resolve requires resolution note;
- resolve closes linked attention;
- request review only after resolved/eligible;
- quality review outbox once;
- cross-workspace isolation;
- snapshot returns invoices/quality/attention correctly;
- proof cleanup.

Run security advisor and RPC privilege checks.

### T9 — tests/receipt/save
Package-free harness + canonical tests authored.

Receipt:
`docs/execution/receipts/v1-int8-worker-1.md`

MANDATORY remote save gate:
- branch HEAD advances;
- receipt exists remotely.

Return:
WORKER=1
SPRINT=V1-INT8
FINAL_SHA=<sha>
REMOTE_HEAD_ADVANCED=YES
RECEIPT_REMOTE=YES
STATE=<IMPLEMENTED|CONTRACT_TESTED|OPERATIONS_VERIFIED|BLOCKED>
CANONICAL_GATE=<state>
MANUAL_PAYMENT_DB_PROOF=<PASS|FAIL>
QUALITY_DB_PROOF=<PASS|FAIL>
PROOF_FIXTURES_CLEANED=<YES|NO>
BLOCKERS=<exact blockers>
READY_NEXT=E09 reporting/admin/settings/platform billing core
