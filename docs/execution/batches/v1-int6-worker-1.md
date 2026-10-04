# V1 Integration Sprint 6 — Worker 1 / E03 Durable Payment + E06 Core Field Runtime

Branch: `feat/servicedesk-v1-core-sprint5`
Exact base: `612cd9ec1b2bbb0f8fc1d139989390e06dd543cf`
ServiceDesk Supabase staging: `cpmmgivhlkfbiwzhlcey`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- docs/execution/supabase-staging-proof-20261004.md
- this packet

## Mission
First make E03 reproducible in Git, then close E06 Core visit transitions + field evidence/checklist persistence.

Do not touch unrelated Supabase projects.

### T1 — Capture and harden the existing staging payment RPC
The function `public.servicedesk_apply_verified_payment(jsonb)` exists in staging but is not in repository migrations.

Add:
`supabase/migrations/0010_e03_verified_payment_rpc.sql`

Requirements:
- repository migration must fully define the function;
- use `SECURITY INVOKER`, not SECURITY DEFINER, unless a concrete reason proves otherwise;
- revoke public/anon/authenticated execute; grant service_role only;
- preserve $340/$85/$255 fixture semantics;
- duplicate event/transaction => zero second business mutation;
- review path is deduplicated;
- hold expiry/amount/currency/workspace mismatches never confirm booking;
- use authoritative slot timezone instead of hard-coded UTC;
- enqueue `calendar.visit.upsert` when deposit creates the authoritative visit;
- return full camelCase invoice and visit objects compatible with `payment-application-postgres.ts`, not IDs only.

### T2 — Fix payment RPC adapter mapping
Harden `src/server/core/payment-application-postgres.ts`.
- map DB/source statuses to facade DTO statuses truthfully;
- DB SCHEDULED maps to VisitDTO CONFIRMED;
- DB NEEDS_REVIEW maps to PENDING_REVIEW;
- never cast incompatible DB enum text directly;
- support exact nested RPC result objects;
- fail closed on malformed RPC state/data.

### T3 — Real E03 staging proof
Apply 0010 to ServiceDesk staging.
Run:
- deposit APPLIED;
- same event DUPLICATE;
- same transaction DUPLICATE;
- expired hold PAYMENT_REVIEW;
- amount/currency/cross-workspace mismatch review;
- balance payment closes invoice;
- PLATFORM_SUBSCRIPTION does not mutate customer invoice;
- deliberate failure proves atomic rollback;
- calendar.visit.upsert outbox created once;
- proof cleanup.

Run security advisor and verify payment RPC execute privileges.

### T4 — E06 field runtime migration
Add `0011_visit_field_runtime.sql`.

Create:
- visit_evidence
- visit_checklist_items

Use coordinator-frozen DTO/command contracts from current base.

Persist only media/object references, never raw image bytes.
Composite workspace/visit FKs.
Unique checklist key per visit.
RLS reads scoped; authoritative writes trusted server only.

### T5 — transitionVisit
Implement exact frozen facade method.

Authority:
- OWNER/DISPATCHER may ASSIGN, COMPLETE, CANCEL as allowed by state;
- crew member assigned to visit may EN_ROUTE, START, SUBMIT_REVIEW;
- customer/visitor denied;
- expectedVersion required;
- stale version => VERSION_CONFLICT.

State map:
DB SCHEDULED <-> facade CONFIRMED
ASSIGNED
EN_ROUTE
IN_PROGRESS
NEEDS_REVIEW <-> PENDING_REVIEW
COMPLETED
CANCELLED

Crew path:
ASSIGNED -> EN_ROUTE -> IN_PROGRESS -> NEEDS_REVIEW.

Dispatcher completes only from NEEDS_REVIEW.
Cancellation cannot reopen terminal state.

### T6 — persisted evidence + checklist
Implement:
- addVisitEvidence
- setVisitChecklistItem

Photo kinds require mediaReference.
Note kinds require text.
CREW must belong to visit crew; OWNER/DISPATCHER may add/correct.
Incident note raises deduplicated field attention.
SUBMIT_REVIEW must require BEFORE_PHOTO and AFTER_PHOTO.

### T7 — E06 atomic RPC adapters
Because Supabase JS has no interactive transaction callback, use trusted atomic Postgres RPCs for transition/evidence/checklist commands.

On authoritative visit assignment/creation/cancel state requiring calendar projection:
- enqueue calendar.visit.upsert or calendar.visit.cancel transactionally.
- Connector remains non-authoritative.

### T8 — Staging proof
Use only `cpmmgivhlkfbiwzhlcey`.

Prove:
- assigned crew authority;
- wrong crew rejected;
- stale version rejected;
- ASSIGNED→EN_ROUTE→IN_PROGRESS;
- review blocked without required evidence;
- before/after evidence then SUBMIT_REVIEW succeeds;
- dispatcher COMPLETE succeeds only after review;
- cancellation rules;
- checklist upsert/idempotency;
- evidence stores reference only;
- calendar outbox produced once;
- rollback on forced failure;
- cross-workspace isolation;
- proof cleanup.

### T9 — tests + receipt
Package-free harness + canonical tests authored.
Update/create:
`docs/execution/receipts/v1-int6-worker-1.md`

Return:
WORKER=1
SPRINT=V1-INT6
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|OPERATIONS_VERIFIED|BLOCKED>
CANONICAL_GATE=<state>
E03_DURABLE_SOURCE=<PASS|FAIL>
E03_DB_PROOF=<PASS|FAIL>
E06_DB_PROOF=<PASS|FAIL>
PROOF_FIXTURES_CLEANED=<YES|NO>
BLOCKERS=<exact blockers>
READY_NEXT=E07 recurrence core
