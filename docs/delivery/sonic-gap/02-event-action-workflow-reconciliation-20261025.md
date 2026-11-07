# SONIC Gap Lane B — Event, action and durable workflow reconciliation

**Read-only sources:** original `docs/engineering/ai/sonic-ai-first-delivery-plan-20261018.md`; canonical `src/contracts/workflow-rules.ts`, `src/server/workflows/engine.ts`; frozen #841 F06 `src/server/ai/f06-typed-event-proposals.ts`, `f06-internal-action-previews.ts`; [automation expansion issue #173](https://github.com/SaamVR/ServiceDesk/issues/173), [crash/replay blocker #199](https://github.com/SaamVR/ServiceDesk/issues/199).

## Already built in canonical (G0 source only)

- Five contracted events: `REQUEST_CREATED`, `QUOTE_ACCEPTED`, `VISIT_COMPLETED`, `INVOICE_PAID`, `ATTENTION_OPENED`.
- Three contracted actions: `CREATE_ATTENTION`, `SEND_EMAIL_TEMPLATE`, `SEND_WHATSAPP_TEMPLATE`. **External delivery requires separate owner/provider approval**, so source schema support does not prove auto-send.
- Versioned published rule evaluation, PREVIEW/LIVE separation, bounded recursion, scoped filters, calculation/evaluation contract and 27 selectable owner-reviewed draft recipes (merged #168). [#173](https://github.com/SaamVR/ServiceDesk/issues/173) records four persisted event processing paths and an existing 72-task target, not 72 proven workflows.
- Outbox/provider policy code exists, but accepted-quote transition-to-event durability across process crashes remains a live reliability blocker (#199). Do NOT infer durable end-to-end automation from a working evaluator.

## Twelve planned new event types

| Event type | Gap status | Evidence / required next dependency |
|---|---|---|
| `MESSAGE_RECEIVED` | **MISSING as workflow event** | Server-authoritative inbound consented message journal, dedupe and branch scope |
| `QUOTE_SENT` | **MISSING as workflow event** | Saved send/outbox acceptance and message receipt, no claimed delivery |
| `QUOTE_EXPIRED` | **PARTIAL — F06 pure proposal** | [Draft #837](https://github.com/SaamVR/ServiceDesk/pull/837); saved quote expiry/version/renewal and time-zone + atomic event journal |
| `BOOKING_CONFIRMED` | **PARTIAL — F06 pure proposal** | Draft #837; committed booking confirmation event and idempotent replay |
| `CREW_ASSIGNED` | **MISSING as workflow event** | Transactional crew assignment/hold and schedule-change event |
| `VISIT_DELAYED` | **PARTIAL — F06 pure proposal** | Draft #837; delay journal not established by present operational DTO |
| `INCIDENT_REPORTED` | **MISSING as workflow event** | Scoped saved incident with privacy/QA authority |
| `QA_FAILED` | **MISSING as workflow event** | Reviewed checklist failure and rework owner decision journal |
| `INVOICE_ISSUED` | **MISSING as workflow event** | Authenticated saved issuance transition and billing-version source |
| `INVOICE_OVERDUE` | **PARTIAL — F06 pure proposal** | Draft #837; settled ledger, true due date, credit/refund adjustment and timezone |
| `PAYMENT_FAILED` | **MISSING as workflow event** | Authenticated sandbox/payment provider receipt, no unauthorized charges |
| `RECURRING_VISIT_DUE` | **MISSING as workflow event** | Saved recurrence scheduler/checkpoint and no duplicate visit jobs |

**Counts:** 0 of 12 **LIVE verified**; 4 of 12 have strict **proposal-only** source; 8 of 12 are **missing from workflow event contracts and from F06 proposals**. These are not necessarily absent as unrelated business events elsewhere; this classification is strictly about new workflow automation triggers.

## Eight planned new internal action primitives

| New action | Gap status | Release gate |
|---|---|---|
| `CREATE_TASK` | **PARTIAL — F06 preview only** | Owner/branch scoped task writer, atomic idempotency |
| `SET_INTERNAL_PRIORITY` | **MISSING as typed workflow action** | Authoritative task/attention priority update, write-time version |
| `REQUEST_OWNER_APPROVAL` | **PARTIAL — F06 preview only** | Saved approval request + immutable decision journal |
| `CREATE_DRAFT_REPLY` | **MISSING as typed workflow action** | Consented review-only draft saved with recipient identity, no send |
| `SUGGEST_SLOT` | **MISSING as typed workflow action** | Saved crew capacity and nonbinding slot proposal |
| `SCHEDULE_REMINDER` | **PARTIAL — F06 preview only** | Timezone/quiet-hour job, cancel and idempotent replay |
| `START_N8N_APPROVED_JOB` | **MISSING as typed workflow action** | Audited preapproved workflow allowlist, signed job receipt, no arbitrary execution |
| `EMIT_OWNER_DIGEST` | **PARTIAL — F06 preview only** | Saved scoped internal digest writer, no implicit customer/email send |

**Counts:** 0/8 newly **LIVE verified**, 4/8 strict **preview-only** implementations, 4/8 no matching F06 typed action. Underlying domain functions and N8N integrations may exist; this table does not erase them—it examines the original **workflow engine action contract**.

## 72-operation backlog reality

[Issue #173](https://github.com/SaamVR/ServiceDesk/issues/173) currently has **72 unchecked task entries**. The canonical 27 recipe catalog is a selectable draft-starter set, **not evidence of 27 of 72 automatically running jobs**. There may be overlapping business actions elsewhere in canonical, and the owner must review each targeted task against a saved event source and outcome before classifying it as truly absent or delivered. Never report `72 missing features` without that task-level mapping. Recommended implementation groupings:

1. Revenue-critical: inbound lead → qualify → priced quote → accept → transactional follow-up, with authoritative versioned rows.
2. Fulfilment-critical: crew capacity → confirmed assignment → visit → checklist/incident → rework/recurrence.
3. Finance-critical: invoice issued/overdue/payment failure → ledger evidence → human-safe escalation.
4. Communication and retention: latest consent/quiet hours → internal draft → owner approval → provider outbox, opt-out and delivery receipts.
5. Monitoring and business intelligence: internal tasks/digests, real retry/dead-letter accounting, actual cost ledger.

## Non-negotiable F06 conversion contract

- Production owns reviewed shared `WorkflowEventType` / `WorkflowActionType` and migrations; draft F06 strings **cannot** be sent to the published engine.
- For each new trigger: stable tenant/branch/source ID, committed source row+revision, event journal written atomically (or equivalently exhaustive recovery), bounded safe replay and idempotent action receipt.
- For each new action: audited scoped writer, owner authority, action idempotency, preview/live separation, retries/dead-letter, consent and quiet-hour policy for anything externally delivered.
- `QUOTE_ACCEPTED` durability gap [#199](https://github.com/SaamVR/ServiceDesk/issues/199) is a dependency even before enabling 12 more event families; do not hide it with additional preview-only actions.
- No Product/Production-approved schema or live contract means **DEFERRED** or **BLOCKED**, not `IMPLEMENTED`. Source-only feature freeze [#816](https://github.com/SaamVR/ServiceDesk/issues/816) remains in force through P12.
