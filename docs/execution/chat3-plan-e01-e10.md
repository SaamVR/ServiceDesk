# ServiceDesk AI — Chat 3 Product/UI Plan E01–E10
Date: 2026-10-04
Lane: Chat 3 Product/UI
Planning status: SOURCE_DERIVED
Execution branch: `feat/servicedesk-v1-product`
Observed product HEAD: `9cec82448952e1aa8fe1d5a83655693ed4114df9`
Observed counterpart heads:
- Core: `c0b6c2c7d92250398e637c30edfe12e93efc0b1a`
- Connectors: `51fd14c10d488932a54d9524f1b57f89359ec809`
- Integration: `78000504f2749e9ecca0c720ed5b41fbf4bd1832`
Relevant contract: `docs/contracts-v1.md` frozen V1 DTO/facade contract; shared changes remain Chat 1-owned.
Integration destination: `feat/servicedesk-v1-integrate`

## Source findings that change the queue
- Existing product route/module architecture, fixture integrity, responsive/a11y safeguards, tour/presentation contract work and RC handoff are already implemented on the product lane; do not redo them.
- `RequestSummaryPreview`, `CheckoutPreview`, `CrewJobPreview`, `QualityReviewPreview`, and `RecoveryActionsPreview` still expose disabled fixture-only actions.
- Most route previews still import `src/features/operations/sample-data.ts`; view-models themselves are guarded by `tests/e2e/view-model-boundary.test.ts`.
- Current core `ServiceDeskFacade` already defines:
  - `createRequest(ctx, input, meta): Promise<Result<RequestDTO>>`
  - `updateRequest(ctx, id, patch, meta): Promise<Result<RequestDTO>>`
  - `calculateQuote(ctx, id): Promise<Result<QuoteDTO>>`
  - `sendQuote(ctx, id, meta): Promise<Result<QuoteDTO>>`
  - `findSlots(ctx, input): Promise<SlotDTO[]>`
  - `holdSlot(ctx, slotId, quoteId, meta): Promise<Result<{holdId:string;expiresAt:string}>>`
  - `transitionVisit(ctx, id, action, meta): Promise<Result<VisitDTO>>`
  - `readWorkspaceSnapshot(ctx, query): Promise<Result<WorkspaceSnapshot>>`
- No composed authenticated facade accessor/server entry point is observed on the current integration branch.
- `WorkspaceSnapshot` currently includes only requests, quotes, visits and invoices. It does not satisfy inbox message, property, recurrence, preferences, quality, field evidence, integration status or platform billing reads.
- `docs/presentation/shared-interface-requests-20261004.md` requests MessageDTO, PropertyDTO, RecurringSeriesDTO, CommunicationPreferenceDTO, QualityCaseDTO and FieldEvidenceDTO plus route-level read contracts.
- `tests/e2e/**` are Vitest contract/view-model tests, not browser automation.

## Dependency registry
All dependency IDs referenced below are declared here.

- **D-C1-E01-BASELINE** — Chat 1 publishes an executable integration checkpoint that includes reviewed lane ranges and records actual typecheck/test/lint/build results. Current state: OPEN.
- **D-C1-E02-COMPOSITION** — Chat 1 publishes/accepts a server-only authenticated composition boundary returning/using the current `ServiceDeskFacade`; no such accessor is observed now. Current state: OPEN.
- **D-C1-SHARED-READS** — Chat 1 accepts or explicitly defers each request in `shared-interface-requests-20261004.md`, with exact DTO/read/command signatures. Current state: OPEN.
- **D-C2-E03-INBOX** — Chat 2 exposes the approved durable inbox outbound/status bridge needed by the UI; provider status remains distinct from business truth. Current state: OPEN.
- **D-C2-E04-CHECKOUT** — Chat 2 exposes server-authoritative checkout redirect/payment callback application boundary. Current state: OPEN.
- **D-C2-E05-CALENDAR** — Chat 2 exposes approved Calendar sync/error/read boundary for product rendering. Current state: OPEN.
- **D-C1-E06-FIELD** — Chat 1 accepts crew job/FieldEvidence read-command contract and signed-storage authorization boundary. Current state: OPEN.
- **D-C1-E07-CUSTOMER** — Chat 1 accepts PropertyDTO, RecurringSeriesDTO and CommunicationPreferenceDTO plus persistence commands. Current state: OPEN.
- **D-C1-E08-OPS** — Chat 1 accepts quality/recovery mutation/read contracts; InvoiceDTO remains already available. Current state: OPEN.
- **D-C1-E09-ADMIN** — Chat 1 accepts settings/platform-billing/readiness snapshots and permission-filtered report reads beyond current WorkspaceSnapshot where needed. Current state: OPEN.
- **D-C1-E10-RC** — Chat 1 publishes the integrated RC SHA to be used for browser evidence. Current state: OPEN.

## E01 — Product wiring inventory + executable baseline repair
**State:** FROZEN / READY  
**Base:** Product `9cec82448952e1aa8fe1d5a83655693ed4114df9`; frozen V1 contracts.  
**Business outcome:** every non-live Product/UI affordance has a concrete wiring target/blocker, and product-owned compile/test/browser-load defects are repaired instead of expanding fixture previews.

### Slices
1. **E01-01 READY — Fixture/action inventory and blocker map.**
   - Inspect/record current actions in:
     `RequestSummaryPreview.tsx`, `CheckoutPreview.tsx`, `CrewJobPreview.tsx`, `QualityReviewPreview.tsx`, `RecoveryActionsPreview.tsx`, `InboxPreview.tsx`, `OperationalRoute.tsx`.
   - Also record fixture-only reads in CRM/properties/preferences/invoices/reports/billing/onboarding/settings previews.
   - Update only `docs/execution/chat3-ledger.md`; if a reusable assertion is justified, add `tests/e2e/product-action-boundary.test.ts`.
   - Current consumers: `buildEditableRequestSummary`, `buildCheckoutView`, `buildCrewExecutionView`, `buildQualityCaseView`, `buildRecoveryActionsView`, `buildInboxThreadView`.
   - Acceptance: each apparent action is either disabled/preview, linked to a current facade signature, or tied to a declared dependency ID.

2. **E01-02 READY — Run focused product checks and fix only observed Product/UI failures.**
   - Command TO RUN:
     `pnpm test tests/e2e/view-model-boundary.test.ts tests/e2e/sample-data-integrity.test.ts tests/e2e/accessibility-contract.test.ts tests/e2e/route-family-contract.test.ts tests/e2e/presentation-tour-contract.test.ts`
   - Then TO RUN if checkout works: `pnpm typecheck`, `pnpm lint`, `pnpm build`.
   - Pass criterion: commands exit 0. If environment blocks, record exact command/error as NOT EXECUTED/blocked and continue E01-03; never mark CONTRACT_TESTED.

3. **E01-03 READY — Browser-load smoke on existing routes without adding a browser package.**
   - Routes: `/b/brightroom/enquire`, `/portal`, `/app/brightroom/inbox`, `/crew/today`, `/tour`, `/presentation`.
   - Browser evidence must name URL, Product or integrated SHA, viewport and observed failure/success.
   - Fallback if browser unavailable: inspect route imports/server-client boundaries and repair only source-confirmed issues.

4. **E01-04 READY — Make shared-interface request document executable for Chat 1.**
   - Modify `docs/presentation/shared-interface-requests-20261004.md`.
   - For each requested DTO/read, add existing consumer path, specific test file, blocking E-batch/task ID, and minimum required fields only.
   - No contract edits in Chat 3.
   - Acceptance: every request has a consumer + test + blocker and maps to D-C1-SHARED-READS.

**Integration acceptance:** Chat 1 can review one pinned Product SHA where product-owned checks either ran green or precise environment blockers are recorded; no new fixture feature growth.

## E02 — Persistent enquiry/request + server snapshot quote
**State:** FROZEN; independent refactor READY, server wiring BLOCKED on D-C1-E01-BASELINE + D-C1-E02-COMPOSITION.  
**Base:** Product `9cec824...`; Core `c0b6c2c...`; Integration `7800050...`; frozen V1 facade signatures above.  
**Business outcome:** a business-site enquiry creates/edits a persisted request and renders its server-derived quote/snapshot after reload.

### Slices
1. **E02-01 READY — Remove fixture ownership from request-summary rendering.**
   - Modify `src/features/request-intake/RequestSummaryPreview.tsx` and `src/features/request-intake/view-models.ts`.
   - Refactor the rendered component to consume `RequestDTO` + `QuoteDTO` props while preserving `buildEditableRequestSummary({request,quote})`.
   - Keep a clearly named fixture wrapper only where showcase routes still need it.
   - Update `tests/e2e/request-summary-view-model.test.ts` and add a component/source-boundary test only if needed.
   - Acceptance: production-capable summary component no longer imports `sample-data.ts`.

2. **E02-02 READY — Extract enquiry form state from `OperationalRoute`.**
   - Modify `src/features/operations/OperationalRoute.tsx`; propose new `src/features/request-intake/EnquiryForm.tsx`.
   - Output responsibility: render service/bedrooms/bathrooms/requestedStartAt and display `Result` errors/version conflicts without local pricing authority.
   - No server mutation yet; preview state stays explicit until E02-03.

3. **E02-03 BLOCKED — Wire authenticated create/update request actions.**
   - Dependency: D-C1-E01-BASELINE + D-C1-E02-COMPOSITION.
   - Proposed route-owned file: `src/app/b/[slug]/enquire/actions.ts`.
   - Consume exact current facade methods `createRequest(...)`, `updateRequest(...)`, then `calculateQuote(...)` or `readWorkspaceSnapshot(...)` as approved by Chat 1.
   - Required output: serializable action state containing authoritative `RequestDTO`, optional `QuoteDTO`, and Result error code/message; no duplicate DTOs.

4. **E02-04 BLOCKED — Route reload uses server snapshot and denies cross-session writes.**
   - Modify `src/app/b/[slug]/enquire/page.tsx`.
   - Inputs: route slug + authenticated/visitor ActorContext supplied by accepted server boundary.
   - Test inputs: valid visitor session, wrong visitor session, expectedVersion conflict, reload after update.
   - Command TO RUN: focused new request-action test plus `pnpm test tests/e2e/request-summary-view-model.test.ts`.
   - Pass criterion: persisted update survives a fresh read; denied/version-conflict state is visible and no fixture mutation is mistaken for truth.

**Fallback:** if D-C1 dependencies remain open, finish E02-01/E02-02 and strengthen boundary tests; do not invent a facade singleton.

## E03 — Server-backed shared inbox + takeover/reply/status
**State:** CANDIDATE / BLOCKED on D-C1-E01-BASELINE + D-C1-SHARED-READS + D-C2-E03-INBOX.  
**Business outcome:** staff sees stored conversation/messages, human takeover state and durable outbound status; provider accepted/delivered/read remain distinct.

### Slices
1. **E03-01** replace `TemporaryInboxMessage` in `src/features/inbox/view-models.ts` once Chat 1 accepts MessageDTO; keep `buildInboxThreadView` as the presentation mapping.
2. **E03-02** refactor `InboxPreview.tsx` to props/server data; remove module-local `sampleMessages`/`sampleThread`.
3. **E03-03** wire `src/app/app/[workspace]/inbox/page.tsx` to accepted inbox read snapshot and handover/reply commands; do not call provider adapters directly.
4. **E03-04** make thread selection/reply buttons operational only when commands exist; otherwise keep disabled with explicit reason.

**Tests TO RUN:** `pnpm test tests/e2e/inbox-view-model.test.ts` plus new server-action/read tests. Inputs: inbound, PROVIDER_ACCEPTED, DELIVERED, READ, FAILED; handover on/off. Pass: server state renders exactly and outbound policy denial is visible.  
**Fallback:** props-only refactor and MessageDTO adapter test.  
**Integration acceptance:** integrated inbox reload shows stored thread and receipt-derived state, not fixture messages.

## E04 — Quote send/slot hold/checkout journey
**State:** CANDIDATE / BLOCKED on D-C1-E01-BASELINE + D-C1-E02-COMPOSITION + D-C2-E04-CHECKOUT.  
**Business outcome:** staff/customer can move from authoritative quote to fresh slot hold and server checkout without client-side price/payment authority.

### Slices
1. **E04-01** refactor `QuoteApprovalPreview.tsx`, `SchedulePreview.tsx`, `CheckoutPreview.tsx` to accept DTO props; preserve `buildQuoteApprovalView`, `buildScheduleLaneView`, `buildCheckoutView`.
2. **E04-02** wire current facade `sendQuote`, `findSlots`, `holdSlot` through route-owned server actions after composition exists.
3. **E04-03** wire provider checkout redirect only through D-C2-E04-CHECKOUT; no direct Chat 3 Stripe/provider calls.
4. **E04-04** render HOLD_EXPIRED / PAYMENT_REVIEW / version-conflict recovery without showing a receipt unless verified payment state exists.

**Tests TO RUN:** `pnpm test tests/e2e/quote-approval-view-model.test.ts tests/e2e/schedule-view-model.test.ts tests/e2e/checkout-view-model.test.ts` plus action tests. Pass: $340/$85/$255 remains server-derived; stale slot cannot instant-confirm; late payment shows review.  
**Fallback:** props-only refactor and error-state tests.  
**Integration acceptance:** one integrated quote→fresh slot→hold→checkout path reaches provider boundary without fixture mutation.

## E05 — Customer portal confirmed booking + Calendar-visible recovery
**State:** CANDIDATE / BLOCKED on D-C1-E01-BASELINE + D-C1-SHARED-READS + D-C2-E05-CALENDAR.  
**Business outcome:** customer portal reload shows persisted visit/invoice and honest Calendar/error state; cancel/reschedule is policy-authorized.

### Slices
1. **E05-01** wire portal overview/booking/invoice to current `readWorkspaceSnapshot` for RequestDTO/QuoteDTO/VisitDTO/InvoiceDTO.
2. **E05-02** refactor `PropertyRecurringPreview` and `CommunicationPreferences` to props while D-C1 shared DTO decisions remain pending.
3. **E05-03** expose cancellation only through approved `transitionVisit(...,"CANCEL",...)`; reschedule stays blocked until Chat 1 publishes a command/policy.
4. **E05-04** consume IntegrationStatusDTO/Calendar snapshot only after D-C2-E05-CALENDAR; failed sync remains visible after reload.

**Tests TO RUN:** `pnpm test tests/e2e/customer-route-module.test.ts tests/e2e/property-recurring-view-model.test.ts tests/e2e/preferences-view-model.test.ts` plus portal read/action tests.  
**Fallback:** server-back only the current WorkspaceSnapshot fields.  
**Integration acceptance:** reload returns persisted visit/invoice; no unsupported reschedule or Calendar-success claim.

## E06 — Crew authorized transitions + evidence/completion
**State:** CANDIDATE / BLOCKED on D-C1-E01-BASELINE + D-C1-E02-COMPOSITION + D-C1-E06-FIELD.  
**Business outcome:** assigned crew sees authoritative job state, performs allowed visit transitions, uploads approved evidence, and reaches manager review safely.

### Slices
1. **E06-01** refactor `CrewJobPreview.tsx` to accept RequestDTO/VisitDTO/InvoiceDTO; preserve `buildCrewExecutionView({request,visit,invoice})`.
2. **E06-02** wire current `transitionVisit` actions EN_ROUTE, START, SUBMIT_REVIEW through authenticated route actions.
3. **E06-03** replace fixture evidence slots with accepted FieldEvidenceDTO/read contract and signed-upload authorization from D-C1-E06-FIELD.
4. **E06-04** surface authorization/version/upload/completion-review failures without optimistic completion.

**Tests TO RUN:** `pnpm test tests/e2e/crew-execution-view-model.test.ts tests/e2e/crew-route-module.test.ts` plus crew action tests. Pass: non-assigned/cross-workspace actor denied; incomplete evidence cannot appear completed.  
**Fallback:** props/server visit transition wiring without evidence upload.  
**Integration acceptance:** integrated crew job route updates persisted VisitDTO and reloads same state.

## E07 — CRM/property/recurrence/preferences persistence
**State:** CANDIDATE / BLOCKED on D-C1-E07-CUSTOMER.  
**Business outcome:** customer/property edits, recurrence controls and communication preferences persist and constrain outbound behavior.

### Slices
1. **E07-01** refactor `CrmPreview.tsx`, `PropertyRecurringPreview.tsx`, `CommunicationPreferences.tsx` away from direct sample-data imports.
2. **E07-02** consume accepted PropertyDTO/RecurringSeriesDTO/CommunicationPreferenceDTO; retire corresponding local fixture-only shapes.
3. **E07-03** wire create/edit/pause/resume/preference commands through accepted server boundary.
4. **E07-04** display version conflicts and consent/quiet-hour effects without bypassing Chat 2 outbound policy.

**Tests TO RUN:** `pnpm test tests/e2e/crm-view-model.test.ts tests/e2e/property-recurring-view-model.test.ts tests/e2e/preferences-view-model.test.ts` plus action tests.  
**Fallback:** DTO adapters/props refactor after Chat 1 DTO decision even if mutations lag.  
**Integration acceptance:** edits survive reload; opted-out/quiet-hour state is present for outbound policy consumption.

## E08 — Invoice + attention recovery + quality case
**State:** CANDIDATE / PARTIALLY BLOCKED on D-C1-E08-OPS; InvoiceDTO read can proceed after baseline.  
**Business outcome:** financial/attention/quality views reflect persisted server state and action conflicts honestly.

### Slices
1. **E08-01** refactor `InvoiceLedgerPreview.tsx` to consume authoritative InvoiceDTO; preserve `buildInvoiceLedgerView(invoice)`.
2. **E08-02** wire invoice page to `readWorkspaceSnapshot(...invoiceId...)`; never derive paid receipt from sandbox fixture.
3. **E08-03** replace `RecoveryFixture` and module-local recovery arrays when Chat 1 provides durable attention/recovery read-command contract.
4. **E08-04** replace `QualityCaseFixture` after QualityCaseDTO acceptance and wire resolution/review-request commands.

**Tests TO RUN:** `pnpm test tests/e2e/invoice-ledger-view-model.test.ts tests/e2e/recovery-actions-view-model.test.ts tests/e2e/quality-view-model.test.ts` plus action/version-conflict tests.  
**Fallback:** E08-01/E08-02 only.  
**Integration acceptance:** invoice totals match persisted InvoiceDTO; recovery/quality actions only enable with server commands.

## E09 — Reports/billing/onboarding/settings + mobile/a11y
**State:** CANDIDATE / PARTIALLY BLOCKED on D-C1-E09-ADMIN; current WorkspaceSnapshot can feed basic reports after baseline.  
**Business outcome:** owner/admin surfaces use scoped server snapshots, maintain customer-vs-platform billing separation, and pass keyboard/mobile review.

### Slices
1. **E09-01** feed `buildReportingView({requests,quotes,visits,invoices})` from server WorkspaceSnapshot instead of sample arrays.
2. **E09-02** replace `PlatformPlanFixture`, `ServiceSettingFixture`, `TeamInviteFixture` only after accepted admin snapshots; preserve customer invoice/platform billing separation.
3. **E09-03** drive `buildOnboardingReadinessView` and `buildOnboardingSetupView` from actual IntegrationStatusDTO read once available.
4. **E09-04** browser review 320/390/768/1440 for owner/admin + primary journeys; use existing `responsive-a11y.css`, no new browser dependency without Chat 1 approval.

**Tests TO RUN:** `pnpm test tests/e2e/reporting-view-model.test.ts tests/e2e/platform-billing-view-model.test.ts tests/e2e/onboarding-view-model.test.ts tests/e2e/settings-view-model.test.ts tests/e2e/accessibility-contract.test.ts tests/e2e/responsive-css-contract.test.ts`.  
**Fallback:** reports server backing + static accessibility contract fixes.  
**Integration acceptance:** scoped report numbers come from integrated snapshot; platform subscription is never shown as customer invoice credit; keyboard/mobile observations recorded.

## E10 — Integrated guided tour + real browser evidence
**State:** CANDIDATE / BLOCKED on D-C1-E10-RC plus accepted E02–E09 ranges.  
**Business outcome:** same-product tour/presentation demonstrates the integrated journey without upgrading fixture/provider claims.

### Slices
1. **E10-01** rebind `tourScenarios` route links and presentation claims to the integrated RC behavior; preserve conservative proof labels.
2. **E10-02** update `TourScenarioList`, `PresentationSlidesPreview`, `/tour`, `/presentation` only where integrated product differs.
3. **E10-03** capture real browser evidence for enquiry→quote→slot/checkout→booking→crew→invoice/recovery at integrated SHA; separate manual/browser evidence from Vitest.
4. **E10-04** refresh presentation evidence docs with exact integrated SHA, URLs/viewports, remaining configuration/provider gates.

**Tests TO RUN:** `pnpm test tests/e2e/showcase-content.test.ts tests/e2e/presentation-tour-contract.test.ts tests/e2e/route-family-contract.test.ts tests/e2e/accessibility-contract.test.ts`; broader Product/UI regression once.  
**Fallback:** repair route/claim inconsistencies; never fabricate screenshots or provider receipts.  
**Integration acceptance:** Chat 1 can reproduce the guided journey from the named integrated SHA and every unverified provider step remains explicitly configuration-blocked.

## Integration cadence
- After each Product/UI batch, pin the exact worker SHA/range in `docs/execution/chat3-ledger.md`.
- Chat 1 reviews that pinned range next cycle; Chat 3 continues only independent or compatibility work if two ranges accumulate unintegrated.
- Do not merge into `feat/servicedesk-v1-integrate` from Chat 3.
- No shared contract/package/lockfile edits in this lane.

## Planner manifest self-check
- Unique task IDs: PASS (E01-01…E10-04; no duplicate IDs).
- Dependencies declared before use: PASS.
- Ownership: PASS; all proposed writes are Chat 3-owned. Shared definitions are requests only.
- READY tasks with unmet external dependencies: PASS; only E01 and independent E02 refactors are READY.
- E01/E02 frozen against observed heads: PASS.
- E03–E10 explicitly prerequisite-gated: PASS.
- Existing work removed from queue rather than reimplemented: PASS.
- Every batch has executable acceptance and test commands TO RUN: PASS.
- No unexecuted command is claimed as evidence: PASS.

## First execution task
`E01-01` — inventory fixture/disabled actions and map each to current facade/shared-interface dependency before any new UI expansion.
