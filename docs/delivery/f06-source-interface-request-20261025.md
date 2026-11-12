# F06 source-only event/action interface request — 2026-10-25

**Control:** [#808](https://github.com/SaamVR/ServiceDesk/issues/808), [F06 #814](https://github.com/SaamVR/ServiceDesk/issues/814). **Owner of shared contracts, SQL and publish:** Production Readiness/Principal Integrator. **This is a request, not authorization or an implemented persistence contract.**

## Purpose and strict separation

The five shipped workflow events (`REQUEST_CREATED`, `QUOTE_ACCEPTED`, `VISIT_COMPLETED`, `INVOICE_PAID`, `ATTENTION_OPENED`) and three shipped workflow actions (`CREATE_ATTENTION`, `SEND_EMAIL_TEMPLATE`, `SEND_WHATSAPP_TEMPLATE`) remain unchanged. F06 adds *only* two pure feature adapters under `src/server/ai/f06-*.ts` and isolated tests, not shared `src/contracts/**`, core engine, migrations, execution queue, outbox, server actions, API routes or schedule providers. F06 strings MUST NOT be passed to the existing LIVE evaluator or serialized as already-supported persisted rule types.

Both adapters operate on **caller-supplied projections**, which could have been forged or truncated. Valid shape ≠ persisted fact or authorized business event. Every success returns `persistedSourceMustBeReauthenticated` / `serverAuthorityRequired` and `executed:false`, `published:false`, `customerMessageSent:false`, `moneyChanged:false`. The SHA-256 preview hashes are deduplication *hints*, not durable idempotency keys or provider receipts.

## Event schema request

| Proposed type | Minimal persisted evidence required before LIVE design | Refusal conditions |
|---|---|---|
| `QUOTE_EXPIRED` | Committed quote, explicit `SENT` status, exact saved `valid_until`, version and tenant/branch, authoritative query timestamp, no superseding accepted revision | Missing/suspect timestamp, `valid_until` not crossed, accepted/void status, changed version or quote |
| `BOOKING_CONFIRMED` | Committed confirmation transaction/journal and saved visit `CONFIRMED` with `confirmed_at`, scheduled start, version, request/customer scope | No confirmation journal, mismatch to current status, future/impossible confirmation, changed owner/branch |
| `VISIT_DELAYED` | **Not currently proven by operational visit DTO**: add/verify committed delay journal and `PERSISTED_DELAY_RECORDED` with recorded delay minutes + timestamp; inspect real arrival check-in | Heuristic predicted lateness, manually entered estimates, missing journal/arrival source, zero/negative/huge delay |
| `INVOICE_OVERDUE` | Saved issued/partial invoice with real `due_at`, positive nonsettled reconciled ledger balance, verified accounting/provider state, authoritative business timezone | Missing due date, paid/void status, zero/negative/unreconciled balance, stale provider settlement or disputed terms |

Pure adapter only checks typed *claims*; it does **not** certify journal presence, payment/consent truth, real as-of clock, business timezone, supersession, rebooking or invoice reconciliation. Production must either supply verifiable new source evidence or keep each type disabled; **never reinterpret a preview as an emitted event**.

## Internal action interface request

| Preview kind | Required operational writer/source (not implemented F06) | Gates before execution |
|---|---|---|
| `CREATE_TASK` | Workspace/branch scoped task table and atomic dedupe constraint | Owner capability, current event version, bounded title/template allowlist, exact event identity |
| `REQUEST_OWNER_APPROVAL` | Internal pending approval row and decision/audit journal | Correct owner identity/capability, review isolation, rate limit, duplicate and approval-replay prevention |
| `SCHEDULE_REMINDER` | Timezone-aware scheduler with persisted job ID, cancel/revoke support and no customer recipient | Owner timezone, quiet-hours/business policy, cancellation after source changes, expiry and deterministic queue idempotency |
| `EMIT_OWNER_DIGEST` | Internal-only owner dashboard digest state (not email/WhatsApp) | Scoping, redaction, persistence vs transport decision, explicit human review and no implicit provider send |

All four return static internal review *preview* fields only. `SCHEDULE_REMINDER` accepts an explicit zoned timestamp greater than observation time and within seven days, but **does not schedule a job**. `EMIT_OWNER_DIGEST` produces no emailed/queued digest. No code path writes a task, approval, reminder or digest.

## Proposed Production-owned authority/idempotency contract

1. Resolve signed-in actor on server, verify active `workspace_branches` tenant/branch ownership and capability **at read and again atomically at write**. Reject stale or missing actor, non-owner, mismatched branch and cross-tenant inputs. Do not trust caller-supplied actor or `sourceEvidence` strings.
2. Load exact committed source row + journal with row/version/confirmation/settlement evidence and business-local clock. Validate quoted schema and source completeness. Fail closed when the currently loaded operational snapshot is capped or malformed.
3. Introduce new typed events/actions via reviewed, versioned shared contracts and SQL validators *only after Product/Production signoff*. Schema migrations need separate explicit user approval.
4. Use atomic unique key with workspace, branch, source entity and **actual event/journal ID**, source revision, workflow version, action index, and action purpose. Replays cannot create a second task/reminder/approval/digest. Preview hash is **never sufficient** for LIVE deduplication.
5. Commit new internal rows with transaction and outbox only when authorized, never from AI suggestion directly. Enforce revision comparison and retry behavior under concurrent change. Audit every accepted/rejected action; provider callbacks and customer sends are distinct separately approved workflows.
6. Run cross-tenant negative tests, stale revision races, replay/duplicate suppression, timezone/DST examples, opt-outs where applicable, idempotent rollback/cancellation, and multi-tenant staging receipts before any publish.

**Release criteria for the F06 source-only PR:** the four typed event and four internal preview schemas compile, focused negative tests and full exact-head source checks pass, critic reviews caveats, PR stays **DRAFT**, and this interface request is linked from #814 and #808. Passing source tests neither proves end-to-end automation nor authorizes the Production track to run new SQL/providers.

**Expected Product/Production follow-up:** acknowledge schema/interface choices, identify confirmed saved delay/booking journals and invoice due/ledger columns, obtain separate migrations/writer/publish approval, and provide exact tenant scoped test receipts before enabling new LIVE event types.
