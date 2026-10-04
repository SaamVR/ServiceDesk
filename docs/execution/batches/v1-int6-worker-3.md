# V1 Integration Sprint 6 — Worker 3 / E07 Recurrence Product Boundary

Branch: `feat/servicedesk-v1-product-sprint5`
Exact base: `612cd9ec1b2bbb0f8fc1d139989390e06dd543cf`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- this packet

## Mission
Make recurrence manageable in Product using the coordinator-frozen recurrence DTO/commands without generating schedule truth client-side.

Do not add a new page family unless required. Prefer existing customer preferences / staff jobs/settings surfaces.

### T1 — recurrence view model
Use `RecurrenceRuleDTO`.
Display:
- frequency;
- status ACTIVE/PAUSED/COMPLETED;
- starts/ends;
- max/generated occurrences;
- nextOccurrenceOn;
- timezone/localStartTime.

Never compute or invent next occurrence client-side.

### T2 — exact server boundaries
Dependency-injected adapters for:
- createRecurrenceRule(ctx,input,meta)
- applyRecurrenceRuleAction(ctx,id,action,meta)

Actions:
- PAUSE
- RESUME
- SKIP_NEXT

Pass expectedVersion/current command metadata as required by accepted Core result contract.
No repositories/providers.

### T3 — Product action availability
Staff recurrence controls may be presented only with injected authoritative server actions.
Customer controls remain disabled unless Core authorization explicitly accepts customer role later.
No optimistic rule mutation.

### T4 — existing surfaces
Integrate recurrence presentation into appropriate existing surfaces:
- portal/preferences or booking summary for customer read-only context;
- staff jobs/settings/request context for management.

Preserve route coverage.

### T5 — occurrence presentation
Materialized visits remain VisitDTOs.
Do not synthesize future VisitDTOs from recurrence rules in Product.
Upcoming occurrence cards must come from authoritative server snapshot when available.

### T6 — action states
Handle:
- rule not found
- version conflict
- unauthorized
- invalid recurrence configuration
- completed rule
- skip unavailable
- server failure

### T7 — crew evidence follow-through
Update Product field-evidence boundary to consume the coordinator-frozen persisted E06 evidence/checklist types when provided, but keep submit controls disabled until Core E06 command implementation is accepted.

Do not invent persistence.

### T8 — harness/tests
Prove:
- no client recurrence date generation;
- exact frozen recurrence action signatures;
- no optimistic PAUSE/RESUME/SKIP;
- authoritative nextOccurrenceOn only;
- no provider/Core repository imports;
- materialized visits stay separate from recurrence rule;
- route coverage preserved;
- E06 evidence boundary stays compatible.

Write:
`docs/execution/receipts/v1-int6-worker-3.md`

Return:
WORKER=3
SPRINT=V1-INT6
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
RECURRENCE_PRODUCT_BOUNDARY=<PASS|FAIL>
NO_CLIENT_SCHEDULE_TRUTH=<PASS|FAIL>
ROUTE_COVERAGE=<PASS|FAIL>
BLOCKERS=<exact blockers>
READY_NEXT=E08 invoice/quality operational Product wiring
