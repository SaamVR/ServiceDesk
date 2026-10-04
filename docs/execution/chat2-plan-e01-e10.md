# ServiceDesk AI — Chat 2 Connectors/AI E01–E10 Plan

Date: 2026-10-04  
Lane: Chat 2 — Connectors / AI  
Branch: `feat/servicedesk-v1-connectors`  
Observed connector HEAD: `51fd14c10d488932a54d9524f1b57f89359ec809`  
Observed integration HEAD: `78000504f2749e9ecca0c720ed5b41fbf4bd1832`  
Observed core HEAD: `c0b6c2c7d92250398e637c30edfe12e93efc0b1a`  
Observed product HEAD: `9cec82448952e1aa8fe1d5a83655693ed4114df9`  
Frozen contract document: `docs/contracts-v1.md` blob `69de81895edbbc1ed99286f37b7bf1219d854dbd`  
Throughput packet: `docs/execution/throughput-recovery-20261004.md` blob `4af56d6476812725e224fe342335853a1235f482`

This plan is source-derived from the observed branch, `AGENTS.md`, the approved V1 Product Specification / Implementation Plan, current provider/AI source, current tests, Chat 2 Run 10 handoff, current core facade, and the Product/UI shared-interface request. It preserves newer work and does not reopen already implemented transports merely because historical run plans mention them.

## Current source audit — already present, do not reimplement

At connector HEAD `51fd14c10d488932a54d9524f1b57f89359ec809` the lane already contains:

- WhatsApp Cloud transport, configured adapter, outbound policy/dispatcher, template registry, inbound normalization/persistence, media retrieval, status transition/batching/failure/recovery, and durable inbound handler.
- Google Calendar OAuth exchange/callback validation, REST CRUD/freebusy, configured adapter, event-list sync, sync state machine, reconciliation, stale-token rebuild planning, availability/DST handling, and external-conflict handling.
- Stripe-style checkout, signed webhook validation, lifecycle/application-state matrix, review bridge/queue, recovery, proof helpers.
- Transactional email adapter/transport/templates, callback policy/lifecycle and callback handler.
- Signed webhook executor, delivery receipt/recovery, n8n execution/receipt/recovery/linkage and example workflow.
- AI model transport, extraction, provider readiness, output/citation guards, guarded orchestration, tool orchestration, owner context/action audit/model recovery.
- Cross-provider regression/redaction/closure helpers.

The next batches therefore prioritize executable verification and composition with durable stores/core boundaries.

## Current counterpart contracts and gaps

Current core facade on core HEAD exports:

`ServiceDeskFacade.createRequest(ctx,input,meta)`  
`ServiceDeskFacade.updateRequest(ctx,id,patch,meta)`  
`ServiceDeskFacade.calculateQuote(ctx,id)`  
`ServiceDeskFacade.sendQuote(ctx,id,meta)`  
`ServiceDeskFacade.findSlots(ctx,input)`  
`ServiceDeskFacade.holdSlot(ctx,slotId,quoteId,meta)`  
`ServiceDeskFacade.applyVerifiedPayment(event)`  
`ServiceDeskFacade.transitionVisit(ctx,id,action,meta)`  
`ServiceDeskFacade.readWorkspaceSnapshot(ctx,query)`

Current Product/UI request document asks Chat 1 for `MessageDTO`, `PropertyDTO`, `RecurringSeriesDTO`, `CommunicationPreferenceDTO`, `QualityCaseDTO`, `FieldEvidenceDTO` and read helpers such as `readInboxSnapshot`. These requests are not approved contracts on the connector branch and must not be invented by Chat 2.

## Defined dependency IDs

- `DEP-C1-INT-BASELINE`: Chat 1 publishes an executable tested integration checkpoint containing the reviewed connector range and current core contracts. Currently unmet.
- `DEP-C1-MESSAGE-STORE`: Chat 1 publishes/accepts durable conversation/message delivery persistence and a server-side command/read boundary for provider status updates. Currently unmet; Product/UI also requests `MessageDTO`.
- `DEP-C1-CALENDAR-STORE`: Chat 1 publishes/accepts persistence adapters for integration connection/token refs, visit↔calendar event mapping, external busy cache and sync state. Currently unmet.
- `DEP-C1-PAYMENT-REVIEW-STORE`: Chat 1 provides a durable implementation of the connector-owned `PaymentReviewStore.enqueuePaymentReview(item)` boundary. Currently unmet.
- `DEP-C1-EMAIL-STORE`: Chat 1 publishes/accepts durable outbound email receipt and recipient suppression persistence. Currently unmet.
- `DEP-C1-AI-CONVERSATION`: Chat 1 publishes/accepts durable conversation/message store + handover state compatible with `AiConversationStore.appendHumanMessage(...)`. Currently unmet.
- `DEP-C1-RECOVERY-STORE`: Chat 1 durable jobs/leases/recovery persistence can store connector `ProviderRecoveryQueueRecord` outcomes and resume after restart. Currently unmet.
- `DEP-EXT-PROVIDER-PROOF`: controlled credentials, consent, sandbox/live provider resources and callback evidence are available. Currently unmet.

Only E01 is immediately READY. E02 is frozen in detail but becomes READY only after E01 establishes a coherent executable connector checkpoint. E03–E10 are sequencing candidates with explicit prerequisites.

---

## E01 — FROZEN — executable connector verification and coherent integration range

**Observed base:** connector `51fd14c10d488932a54d9524f1b57f89359ec809`; integration `78000504f2749e9ecca0c720ed5b41fbf4bd1832`.  
**Business capability outcome:** Chat 1 receives a pinned connector range whose provider/AI entrypoints compile and whose focused suites actually execute, or a precise environment blocker with no further unchecked feature expansion.

### Slices

**E01-T1 — READY — Establish executable test gate**
- Files read: `package.json`, `src/server/integrations/index.ts`, `src/server/ai/index.ts`.
- Current entrypoint symbols consumed: integration barrel exports and AI barrel exports as observed at the base SHA.
- Source edits: none unless an executable diagnostic names a lane-owned failure.
- Commands TO RUN:
  - `pnpm install --frozen-lockfile`
  - `pnpm typecheck`
  - `pnpm vitest run tests/providers`
  - `pnpm vitest run tests/ai`
- Pass criterion: commands complete with exit code 0; newly authored tests are not called CONTRACT_TESTED unless they execute.

**E01-T2 — READY — Repair connector/AI export and compile drift**
- Exact existing files eligible for edit: `src/server/integrations/index.ts`, `src/server/ai/index.ts`, and the exact connector/AI file named by TypeScript/Vitest diagnostics.
- Existing source already audited: no historical transport rebuild is allowed.
- Output signature: both barrels must import from a consumer without missing/duplicate export compile errors.
- Test: rerun `pnpm typecheck`; pass = zero TypeScript errors from Chat 2-owned paths.

**E01-T3 — READY — Repair behavior failures in the focused suites**
- Exact tests are the existing `tests/providers/**` and `tests/ai/**` files; modify only failing tests/source when the failure demonstrates implementation drift, not to weaken assertions.
- Key current smoke surface: `tests/providers/provider-boundaries.test.ts` imports `FixtureCalendarAdapter`, `FixtureStripePaymentAdapter`, `FixtureWhatsAppAdapter`, signature helpers and `OutboxJob` from the integration barrel.
- Inputs: current fixture/provider matrices already in repo.
- Expected behavior: tenant/provider scoping, signatures, dedupe, recovery and AI guardrails remain non-regressive.
- Command: rerun only failing file(s), then one `pnpm vitest run tests/providers` and one `pnpm vitest run tests/ai`.
- Pass criterion: 0 failed tests.

**E01-T4 — READY — Pin coherent connector checkpoint**
- Files: `docs/execution/chat2-ledger.md` only.
- Output: exact start/final SHA, executed commands/results, integration destination, and unresolved environment/configuration gates.
- Optional broader command after focused green: `pnpm test` once.
- Acceptance: Chat 1 can review a fixed SHA/range; no moving target and no false provider proof.

**Dependency:** executable Node/pnpm workspace. This is an environment dependency, not a reason to expand features unchecked.  
**Independent fallback:** if the runtime cannot execute the commands, record exact command/error in the ledger, perform only static barrel/import ownership audit, and stop E01 as BLOCKED rather than creating more provider features.  
**Integration destination:** `feat/servicedesk-v1-integrate`.  
**Executable wiring acceptance:** Chat 1 can merge the pinned range and rerun typecheck + provider/AI suites without Chat 2-owned compile/test regressions.

---

## E02 — FROZEN — durable WhatsApp inbound persistence → idempotent processor handoff

**Observed base:** same planning base; execute only after `E01-T4`.  
**Business capability outcome:** a verified inbound webhook can be durably stored and handed to a processor without losing an event on retry or processing a provider duplicate twice.

### Current symbols consumed

- `handleDurableWhatsAppInboundWebhook(input: DurableWhatsAppInboundWebhookInput): Promise<ProviderHandlerResult>`
- `persistDurableWhatsAppInboundBatch(input: PersistDurableWhatsAppInboundBatchInput): Promise<Result<DurableWhatsAppInboundBatchSummary>>`
- `buildDurableWhatsAppInboxRecord(message, rawProviderEventRef): DurableWhatsAppInboxRecord`
- `normalizeWhatsAppInboundMessage(message): NormalizedWhatsAppInboundEvent`
- durable identity: `NormalizedWhatsAppInboundEvent.receiptKey`

### Slices

**E02-T1 — BLOCKED on E01-T4 — Add explicit idempotent processor port**
- Proposed new file: `src/server/integrations/whatsapp/inbound-processor.ts`.
- Responsibility: connector-owned processing handoff only; no direct database/business mutation.
- Output signatures:
  - `DurableWhatsAppInboundProcessor.process(event: DurableWhatsAppInboxRecord): Promise<"PROCESSED" | "DUPLICATE">`
  - `processDurableWhatsAppInboundBatch(events, processor): Promise<Result<{received:number;processed:number;duplicate:number;unsupported:number}>>`
- The processor must dedupe by `receiptKey`; duplicate webhook delivery is safe to retry.

**E02-T2 — BLOCKED on E01-T4 — Compose persistence and processor handoff**
- Existing files: `src/server/api-handlers/provider-whatsapp-durable.ts`, `src/server/integrations/whatsapp/inbox-persistence.ts`.
- Modify `DurableWhatsAppInboundWebhookInput` to accept the processor port.
- Required ordering: signature → parse → normalize/persist → processor handoff → ACK.
- Failure rule: processor failure returns retryable 503; a later provider retry must be safe because processor dedupes by `receiptKey`.
- Unsupported content remains explicit; never fabricate message text.

**E02-T3 — BLOCKED on E01-T4 — Mixed-batch duplicate/retry tests**
- Existing tests: `tests/providers/whatsapp-durable-inbound-handler.test.ts`, `whatsapp-inbound-batch.test.ts`, `whatsapp-inbound-normalization.test.ts`.
- Proposed new test file only if current test structure becomes unwieldy: `tests/providers/whatsapp-inbound-processor.test.ts`.
- Inputs:
  - mixed batch with valid text, media reference, unsupported type;
  - duplicate provider message;
  - processor throws after persistence, then same provider callback retries.
- Expected: each unique `receiptKey` reaches processor exactly once logically; duplicate is acknowledged idempotently; retry recovers failed processing; unsupported remains marked unsupported.
- Command: `pnpm vitest run tests/providers/whatsapp-durable-inbound-handler.test.ts tests/providers/whatsapp-inbound-batch.test.ts tests/providers/whatsapp-inbound-normalization.test.ts tests/providers/whatsapp-inbound-processor.test.ts` (omit new file if not created).
- Pass criterion: all selected tests pass.

**E02-T4 — BLOCKED on E01-T4 — Pin E02 range for controller**
- File: `docs/execution/chat2-ledger.md`.
- Record exact source SHA and processor contract for Chat 1.
- No Chat 1/core files edited.

**Dependency:** `E01-T4`.  
**Independent fallback:** repair an E01-discovered WhatsApp import/test failure only; do not start E03.  
**Integration destination:** `feat/servicedesk-v1-integrate`.  
**Executable wiring acceptance:** integrated handler persists and hands off a mixed webhook batch with retry-safe duplicate behavior under the focused tests.

---

## E03 — CANDIDATE — outbound WhatsApp dispatcher + durable delivery status command

**Prerequisites:** `E02-T4`, `DEP-C1-MESSAGE-STORE`.

**Business capability outcome:** queued WhatsApp work is rechecked at send time and provider acceptance/delivered/read/failed states are persisted distinctly without bypassing takeover/consent/template rules.

### Current symbols consumed
- `dispatchWhatsAppOutboxJob(input: DispatchWhatsAppOutboxJobInput): Promise<Result<WhatsAppOutboundDispatchResult>>`
- `sendConfiguredWhatsAppCloudMessage(...): Promise<Result<ProviderSendResult>>`
- `applyWhatsAppStatusBatch(input: ApplyWhatsAppStatusBatchInput): Promise<WhatsAppStatusBatchSummary>`
- `handleWhatsAppStatusWebhook(input: WhatsAppStatusWebhookInput): Promise<ProviderHandlerResult>`

### Slices
- **E03-T1 — BLOCKED:** adapt the approved Chat 1 message/outbox persistence to existing `WhatsAppOutboundDispatchStore`; files `whatsapp/outbound-dispatcher.ts`, provider handler glue.
- **E03-T2 — BLOCKED:** compose status callbacks into the approved durable message delivery command/read boundary; files `whatsapp/status-batch.ts`, `provider-whatsapp.ts`; preserve `PROVIDER_ACCEPTED | DELIVERED | READ | FAILED` distinction.
- **E03-T3 — BLOCKED:** race tests: opt-out or handover changes after queueing but before send; stale conversation version; missing/unapproved template outside service window.
- **E03-T4 — BLOCKED:** status regression tests: delivered/read never regress to sent/failed from stale callback; duplicates ACK without a second business mutation.

**Tests TO RUN:** `pnpm vitest run tests/providers/whatsapp-outbound-dispatcher.test.ts tests/providers/whatsapp-outbound-policy.test.ts tests/providers/whatsapp-status-handler.test.ts tests/providers/whatsapp-status-batch.test.ts tests/providers/whatsapp-status-transition.test.ts`.  
**Pass criterion:** all selected tests green and durable store spy proves one logical state mutation per unique callback.  
**Fallback:** if `DEP-C1-MESSAGE-STORE` is unresolved, close only a documented WhatsApp compatibility/import gap from E01/E02.  
**Integration destination/acceptance:** controller merges pinned range; integrated server message snapshot reports queued/accepted/delivered/read separately and takeover prevents dispatch.

---

## E04 — CANDIDATE — Google Calendar token/store composition and stale-sync recovery

**Prerequisites:** `DEP-C1-INT-BASELINE`, `DEP-C1-CALENDAR-STORE`.

**Business capability outcome:** a crew calendar connection can refresh credentials, create/update/cancel exactly one mapped event per visit, and rebuild external busy state safely after stale/expired sync.

### Current symbols consumed
- `ConfiguredGoogleCalendarAdapter`
- `refreshGoogleCalendarAccessToken(...)`
- `exchangeGoogleCalendarAuthorizationCode(...)`, `exchangeGoogleCalendarRefreshToken(...)`
- `listGoogleCalendarEventsPage(...)`
- `runGoogleCalendarSync(...)`
- `planCalendarReconciliation(...)`
- `planGoogleCalendarSyncTokenRecovery(...)`

### Slices
- **E04-T1 — BLOCKED:** proposed new `src/server/integrations/google-calendar/token-store.ts` port for loading/persisting workspace+crew token refs without exposing secrets; consume approved Chat 1 persistence adapter.
- **E04-T2 — BLOCKED:** refactor configured adapter composition so refresh loads current token state and persists refreshed expiry/scopes before provider call; do not treat redacted token refs as raw access tokens.
- **E04-T3 — BLOCKED:** compose visit↔provider event mapping store with `createOrUpdate`/`cancel` so retry after ambiguous response does not create duplicate events.
- **E04-T4 — BLOCKED:** connect `listGoogleCalendarEventsPage` + `runGoogleCalendarSync` + rebuild/reconciliation to approved external-busy/sync-state store.

**Tests TO RUN:** `pnpm vitest run tests/providers/calendar-configured-adapter.test.ts tests/providers/calendar-oauth-exchange.test.ts tests/providers/calendar-rest-client.test.ts tests/providers/calendar-rest-sync-list.test.ts tests/providers/calendar-sync-state-machine.test.ts tests/providers/calendar-sync-token-rebuild.test.ts tests/providers/calendar-reconciliation.test.ts`.  
**Pass criterion:** refresh/reconnect errors actionable; repeated dispatch maps one visit to one event; expired token yields rebuild of external cache only; no booking truth mutation.  
**Fallback:** compatibility tests around current adapter/sync types while waiting for the store contract.  
**Integration destination/acceptance:** integrated calendar adapter uses controller-approved persistence and passes focused calendar suite.

---

## E05 — CANDIDATE — authoritative checkout + verified webhook-to-core bridge

**Prerequisites:** `DEP-C1-INT-BASELINE`, `DEP-C1-PAYMENT-REVIEW-STORE`.

**Business capability outcome:** server-derived checkout and verified provider callbacks reach `ServiceDeskFacade.applyVerifiedPayment(event)`; duplicate/mismatch/late events cannot falsely confirm a booking.

### Current symbols consumed
- `createStripeCheckoutSession(config,input,http): Promise<Result<CheckoutSession>>`
- `handleStripePaymentWebhook(input): Promise<ProviderHandlerResult>`
- `decidePaymentApplicationState(current,incoming): PaymentApplicationDecision`
- `routePaymentWebhookToReview(input): Promise<Result<PaymentReviewRouteReceipt>>`
- core target: `ServiceDeskFacade.applyVerifiedPayment(event: VerifiedPaymentEvent)`

### Slices
- **E05-T1 — BLOCKED:** proposed new `src/server/integrations/payments/core-bridge.ts` implementing `PaymentWebhookApplicationStore` over `Pick<ServiceDeskFacade,"applyVerifiedPayment">`; no direct DB writes.
- **E05-T2 — BLOCKED:** compose application-state decision before core application; route amount/currency/workspace/account/purpose/late-hold conflicts to durable review store.
- **E05-T3 — BLOCKED:** ensure transient core/store errors enter existing payment recovery path while deterministic mismatches never retry as success.
- **E05-T4 — BLOCKED:** end-to-end contract test from signed raw callback → verification → decision → one facade invocation or one review item.

**Tests TO RUN:** `pnpm vitest run tests/providers/payment-checkout-hardening.test.ts tests/providers/payment-webhook-handler.test.ts tests/providers/payment-webhook-validation.test.ts tests/providers/payment-application-state.test.ts tests/providers/payment-review-bridge.test.ts tests/providers/payment-expired-hold-review.test.ts tests/providers/payment-recovery-bridge.test.ts`.  
**Pass criterion:** duplicate callback produces no second facade call; mismatch/expired hold produces review; valid payment calls facade once with verified event.  
**Fallback:** repair payment import/type drift only.  
**Integration destination/acceptance:** integrated payment handler calls core facade only after verification and focused suite passes.

---

## E06 — CANDIDATE — transactional email dispatcher + durable receipts/suppression

**Prerequisites:** `DEP-C1-INT-BASELINE`, `DEP-C1-EMAIL-STORE`.

**Business capability outcome:** approved transactional templates are suppressed before send when policy requires it, accepted sends persist receipts, callbacks update suppression/delivery state idempotently, and transient failures retry.

### Current symbols consumed
- `createConfiguredEmailTransport(config,http): TransactionalEmailAdapter`
- `buildTransactionalEmailJob(input): TransactionalEmailJob`
- `classifyEmailCallbackPolicy(input): EmailCallbackPolicyDecision`
- `applyEmailCallbackLifecycle(...): EmailCallbackLifecycleDecision`
- `handleEmailProviderCallback(input): Promise<EmailProviderHandlerResult>`

### Slices
- **E06-T1 — BLOCKED:** proposed `src/server/integrations/email/dispatcher.ts` composes template building + `shouldSuppressTransactionalEmail` + configured transport + durable receipt store.
- **E06-T2 — BLOCKED:** persist provider acceptance keyed by email idempotency/provider message ID; no raw recipient/body in evidence.
- **E06-T3 — BLOCKED:** callback bridge applies hard-bounce/complaint suppression idempotently; soft bounce remains retryable, not permanent suppression.
- **E06-T4 — BLOCKED:** send/callback recovery maps timeout/429/5xx to bounded retry and deterministic auth/invalid-recipient to operator review.

**Tests TO RUN:** `pnpm vitest run tests/providers/email-adapter.test.ts tests/providers/email-transport.test.ts tests/providers/email-templates.test.ts tests/providers/email-callback-handler.test.ts tests/providers/email-callback-policy.test.ts tests/providers/email-callback-lifecycle.test.ts`.  
**Pass criterion:** suppress-before-send, one acceptance receipt, duplicate callback idempotent, transient failure retry classification.  
**Fallback:** current email tests/imports only.  
**Integration destination/acceptance:** controller-approved receipt/suppression store wired and focused suite green.

---

## E07 — CANDIDATE — configured AI model service + guarded facade orchestration

**Prerequisites:** `DEP-C1-INT-BASELINE`, `DEP-C1-AI-CONVERSATION`.

**Business capability outcome:** a durable human message is saved before model invocation; structured model output is guarded; only allowlisted proposals reach core facade operations; handover/model failure fails safely.

### Current symbols consumed
- `callAiModel(...): Promise<Result<AiModelOutput>>`
- `extractCleaningRequest(text): CleaningRequestExtraction`
- `buildGuardedAssistantPlan(input): Result<AssistantTurn>`
- `planAiToolOrchestration(...): AiToolOrchestrationPlan`
- `AiConversationStore.appendHumanMessage(...): Promise<string>`
- core facade subset: `updateRequest`, `calculateQuote`, `findSlots`, `readWorkspaceSnapshot`

### Slices
- **E07-T1 — BLOCKED:** proposed `src/server/ai/configured-service.ts` implementing `AiService.respond` with durable conversation store + `callAiModel` + output/citation guards.
- **E07-T2 — BLOCKED:** facade port uses only approved `ServiceDeskFacade` methods; model can propose request-field updates/read operations but cannot set price, paid state, role, provider truth or direct DB mutation.
- **E07-T3 — BLOCKED:** handover-active/provider/model failure returns safe assistant result/review path after human message persistence.
- **E07-T4 — BLOCKED:** expand existing corpus only for composition gaps: malformed structured output, unauthorized tool name, cross-workspace target, handover race, provider timeout.

**Tests TO RUN:** `pnpm vitest run tests/ai tests/providers/ai-tool-orchestration.test.ts tests/providers/ai-business-truth-guard.test.ts tests/providers/ai-model-recovery.test.ts`.  
**Pass criterion:** human message store called before model; malformed output fails closed; no forbidden tool reaches facade; citations reference approved workspace knowledge only.  
**Fallback:** AI import/guardrail test repairs while waiting for conversation store.  
**Integration destination/acceptance:** configured AI service compiles against controller-approved facade/conversation adapter and focused AI suite passes.

---

## E08 — CANDIDATE — signed webhook/n8n durable delivery + bounded recovery

**Prerequisites:** `DEP-C1-INT-BASELINE`, `DEP-C1-RECOVERY-STORE`.

**Business capability outcome:** signed booking webhooks and n8n receipts survive retries/restarts with one logical delivery receipt and bounded dead-letter/operator review.

### Current symbols consumed
- `executeSignedWebhookDelivery(...): Promise<WebhookExecutionResult>`
- `mergeWebhookDeliveryReceipt(...): WebhookDeliveryReceiptMergeDecision`
- `buildWebhookRecoveryEvent(...)`, `decideWebhookRecovery(...)`
- `buildN8nExecutionReceipt(...)`, `mergeN8nExecutionReceipt(...)`, `decideN8nRecovery(...)`
- generic `buildRecoveryQueueRecord(...)`, `applyRecoveryAttemptResult(...)`

### Slices
- **E08-T1 — BLOCKED:** adapt controller-approved durable recovery/lease store to webhook/n8n receipt identities.
- **E08-T2 — BLOCKED:** dispatcher persists attempt/receipt before scheduling retry; restart resumes pending work without blind duplicate.
- **E08-T3 — BLOCKED:** dead-letter after bounded attempts; configuration/auth errors become operator-visible blocked/review state.
- **E08-T4 — BLOCKED:** harden `examples/n8n/booking-confirmed.json` only if needed by executable integration; n8n must not mutate booking/payment truth.

**Tests TO RUN:** `pnpm vitest run tests/providers/webhook-executor.test.ts tests/providers/webhook-delivery-receipt.test.ts tests/providers/webhook-recovery-bridge.test.ts tests/providers/n8n-execution-receipt.test.ts tests/providers/n8n-receipt-idempotency.test.ts tests/providers/n8n-recovery-bridge.test.ts tests/providers/provider-recovery-executor.test.ts tests/providers/provider-recovery-lease.test.ts`.  
**Pass criterion:** retries bounded, duplicate receipt idempotent, restart-safe store contract demonstrated, businessMutationAllowed remains false.  
**Fallback:** repair recovery serialization/classification tests only.  
**Integration destination/acceptance:** Chat 1 durable job store + connector executor pass focused recovery suite.

---

## E09 — CANDIDATE — controlled provider verification and reconnect/error proof

**Prerequisites:** `DEP-EXT-PROVIDER-PROOF` plus relevant E03–E08 integrated capability.

**Business capability outcome:** controlled sandbox/live provider actions produce redacted receipts that can legitimately move individual providers from CONFIGURATION_BLOCKED/CONTRACT_TESTED to PROVIDER_VERIFIED.

### Current symbols/documents consumed
- `docs/provider-operations-checklist.md`
- `buildProviderEvidenceTemplate(...)`, `assessProviderEvidence(...)`
- provider readiness/configuration summaries and existing proof packet helpers.

### Slices
- **E09-T1 — BLOCKED:** controlled WhatsApp inbound/outbound/status proof with opted-in recipient and approved template.
- **E09-T2 — BLOCKED:** controlled Google OAuth/freebusy/create-update-cancel/sync-reconnect proof.
- **E09-T3 — BLOCKED:** controlled payment sandbox checkout + signed callback + duplicate proof; no unsupported live-country assumption.
- **E09-T4 — BLOCKED:** controlled email/webhook/n8n/AI observations with redacted receipts.

**Test/proof criterion:** use the operations checklist and exact controlled IDs/timestamps; fixture/mock output never counts as provider proof.  
**Independent fallback:** rerun/repair previously unexecuted focused tests, approved store adapter composition, or a documented integration gap. Do not fabricate receipts.  
**Integration destination/acceptance:** evidence packet reviewed by controller; only proven provider(s) receive PROVIDER_VERIFIED.

---

## E10 — CANDIDATE — cross-provider journey closure and controller handoff

**Prerequisites:** `DEP-C1-INT-BASELINE` plus accepted E02–E09 ranges or explicit deferrals.

**Business capability outcome:** connector/AI lane closes with exact executable evidence for the customer journey/recovery paths and an integration-ready matrix; unresolved external configuration is explicit.

### Current symbols consumed
- `classifyConnectorRegression(...)`, `summarizeConnectorRegressionMatrix(...)`
- `auditConnectorRedaction(...)`, `summarizeRedactionAudit(...)`
- `buildConnectorClosureReport(...)`
- current provider/AI barrels.

### Slices
- **E10-T1 — BLOCKED:** execute cross-provider journey/recovery tests: WhatsApp intake → AI guarded plan → payment callback → Calendar action → email/webhook delivery; failures route to recovery/review without false business truth.
- **E10-T2 — BLOCKED:** export consistency/redaction audit; remove orphaned duplicate helpers only when source proves they are unused.
- **E10-T3 — BLOCKED:** run `pnpm typecheck`, `pnpm vitest run tests/providers`, `pnpm vitest run tests/ai`, then `pnpm test` once if focused suites are green.
- **E10-T4 — BLOCKED:** update `docs/execution/chat2-ledger.md` and a Chat 2 closure handoff with pinned source SHA, commands/results, provider proof labels and exact unresolved gates.

**Pass criterion:** no failing focused tests; all lane exports compile; no secret/PII/raw-body leakage in evidence; no fixture promoted to provider proof.  
**Integration destination/acceptance:** Chat 1 can merge the pinned final range into `feat/servicedesk-v1-integrate` and reproduce the test evidence.

---

## Manifest self-check

- Batch IDs are unique: E01–E10.
- Task IDs are unique within the lane.
- E01 is READY; E02 is frozen but correctly BLOCKED on E01; E03–E10 have explicit prerequisites.
- All dependency IDs referenced above are defined in this document.
- No READY task has an unmet named dependency.
- All implementation files are Chat 2-owned; shared contracts/package/global taskboard remain Chat 1-owned.
- Already implemented transports/recovery/guardrails are removed from the queue and treated as composition inputs.
- Every batch names an executable acceptance path or, for E09, controlled-provider proof criteria.
- Commands listed here are TO RUN, not evidence.
- Planning makes no implementation, test-pass, runtime-duration or provider-verification claim.
