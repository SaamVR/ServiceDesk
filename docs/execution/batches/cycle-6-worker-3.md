# ServiceDesk AI — Cycle 6 Worker 3 / Product & UI — Backup: Cross-Record & Live-Provider Consistency

Planned branch: `feat/servicedesk-v1-product`
Activation rule: coordinator refreshes expected HEAD to Worker 3 Cycle 5 final before dispatch.

Read fast-start docs + this packet. One normal recovery probe only; use outage mode if canonical access remains blocked.

React/Next/browser work stays frozen during outage mode. This batch owns pure view-model logic and canonical tests.

## Completion quota
Complete at least FIVE substantive slices unless every remaining authorized slice is genuinely blocked. Use grouped commits + compact receipt.

## READY queue

### CYCLE-6-W3-T1 — CRM timestamp fail-safe
Files:
- `src/features/crm/view-models.ts`
- `tests/e2e/crm-view-model.test.ts`

Current date formatter can throw on malformed timestamps.

Harden:
- invalid visit.startAt / conversation.lastMessageAt never throw;
- show an explicit invalid/missing label;
- valid UTC formatting stays unchanged.

### CYCLE-6-W3-T2 — CRM net-collected truth
Current financialSummary uses allocatedMinor directly.

Change display to net collected:
`max(allocatedMinor - refundedMinor, 0)`.

Preserve balance display.
Add refund and over-refund regressions; never display negative collected money.

### CYCLE-6-W3-T3 — Request/quote cross-record integrity
Files:
- `src/features/request-intake/view-models.ts`
- `tests/e2e/request-summary-view-model.test.ts`

Fail closed when:
- request.workspaceId !== quote.workspaceId;
- quote.requestId !== request.id.

Expose a non-authoritative integrity warning / mismatch flag and force confirmationBlocked=true.
Do not fabricate quote totals or silently present mismatched records as one request.

Valid matching DTO behavior must remain unchanged.

### CYCLE-6-W3-T4 — Schedule live-calendar requirement
Files:
- `src/features/schedule/view-models.ts`
- `tests/e2e/schedule-view-model.test.ts`

Current calendarHealthy only checks CONNECTED.

Require for instant confirmation:
- matching GOOGLE_CALENDAR integration workspace == slot.workspaceId;
- status CONNECTED;
- mode LIVE;
- fresh slot;
- no unresolved conflict.

CONNECTED SANDBOX/FIXTURE/undefined mode must not permit instant confirm.

### CYCLE-6-W3-T5 — Resolved attention should not block schedule
Only unresolved attention should contribute conflict reasons.
Exclude `RESOLVED` attention items from blocking.
OPEN and ACKNOWLEDGED remain blocking until resolved.

Add regressions for resolved vs acknowledged attention.

### CYCLE-6-W3-T6 — CRM cross-record consistency flag
In CRM customer view, derive integrity warnings for mismatched:
- request/quote request id or workspace;
- request/visit request id or workspace;
- visit/invoice visit id when present;
- request/conversation request id when present.

Keep source marked DTO_SAMPLE.
Expose a fail-safe flag/warning; do not present mismatched records as production truth.

### CYCLE-6-W3-T7 — Combined Product outage harness
Add:
- `tests/e2e/runtime-outage-product-consistency-harness.ts`

Cover invalid timestamps, refund net collected, request/quote mismatch, live-calendar gating, resolved attention behavior, and CRM cross-record mismatch.

Run with global ts-node.

## FALLBACK
F1. Inbox regression: inbound messages must remain neutral regardless of an accidental outbound deliveryState field.
F2. Schedule regression: duplicate calendar integration rows fail closed unless exactly one matching LIVE+CONNECTED row is authoritative.
F3. Request-summary invalid requestedStartAt must render safely instead of throwing.

## Proof
Outage harness PASS => IMPLEMENTED only. Canonical Product/typecheck/lint/build/browser gate remains CONFIGURATION_BLOCKED until normal tooling returns.

## Receipt
`docs/execution/receipts/worker-3-cycle-6.md`
