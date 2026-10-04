# V1 Integration Sprint 6 — Worker 2 / E07 Recurrence Provider Automation

Branch: `feat/servicedesk-v1-connectors-sprint6`
Exact base: `612cd9ec1b2bbb0f8fc1d139989390e06dd543cf`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- this packet

## First action
Your prior E06 Calendar implementation was accepted into the RC, but no `v1-int5-worker-2.md` receipt exists.
Write a concise E06 addendum/receipt before final return, but do not stop there.

## Mission
Build E07 provider automation around Core-owned recurrence while keeping ServiceDesk as recurrence truth.

### T1 — recurrence authority rule
Do NOT create Google recurring-event series.
ServiceDesk materializes each recurring visit.
Each materialized VisitDTO is projected individually through existing calendar.visit.upsert.

Document/test this invariant.

### T2 — recurring visit calendar intent
Add an authoritative-source resolver/helper for a materialized recurrence visit:
- recurrenceRuleId
- occurrence sequence
- VisitDTO
- workspace/crew binding
- idempotency

Output must reuse existing calendar visit projection/dispatcher.
No recurrence date calculation in Connector.

### T3 — visit reminder delivery intent
Add provider-neutral outbox topic support for `visit.reminder`.

Authoritative source supplies:
- visitId
- customer/conversation/contact
- channel
- body/template data
- scheduled reminder identity
- consent/quiet-hours/handover state

Connector must not calculate booking truth.

Add `VISIT_REMINDER` delivery purpose if needed.

Support WhatsApp/Email through existing dispatchers.

### T4 — reminder suppression
Preserve:
- opt-out;
- missing opt-in;
- quiet hours;
- human handover suppression for automated reminder;
- explicit STAFF replies remain separate CUSTOMER_REPLY behavior.

### T5 — recurrence cancellation/provider behavior
When Core cancels a materialized visit:
- existing calendar.visit.cancel path handles provider event.
Pausing/skipping a recurrence rule does NOT directly delete arbitrary calendar events unless Core emits an authoritative visit cancellation event.

### T6 — calendar external edits
Re-use existing operator-review path.
An external change to one occurrence must not change recurrence rule truth or future occurrences.

### T7 — recovery/idempotency
- same occurrence/outbox idempotency => same provider mapping;
- retryable provider failure remains E04 retry;
- config/OAuth failures terminal/config blocked;
- external mismatch operator review;
- no raw provider secrets/PII in failure evidence.

### T8 — harness/tests
Package-free harness for:
- recurrence occurrence projects one VisitDTO only;
- no Google RRULE/series creation;
- reminder WhatsApp/Email;
- suppression/handover/quiet-hours;
- skip/pause does not mutate provider unless Core emits visit event;
- idempotent retry;
- external edit review only.

Write:
- `docs/execution/receipts/v1-int5-worker-2.md` for completed E06 work.
- `docs/execution/receipts/v1-int6-worker-2.md` for this sprint.

If implementation becomes complete and only controlled Google proof remains:
`GOOGLE_CALENDAR_ACCESS_REQUIRED_FOR_PROVIDER_PROOF`

Return:
WORKER=2
SPRINT=V1-INT6
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
E06_RECEIPT_UPDATED=<YES|NO>
RECURRENCE_PROVIDER_BRIDGE=<PASS|FAIL>
REMINDER_BRIDGE=<PASS|FAIL>
LIVE_PROVIDER_GATE=<NOT_READY|GOOGLE_CALENDAR_ACCESS_REQUIRED>
BLOCKERS=<exact blockers>
READY_NEXT=E08 email/webhook operational closure
