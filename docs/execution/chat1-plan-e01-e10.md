# ServiceDesk AI — Chat 1 Core / Integration Controller Plan E01–E10

Date: 2026-10-04
Lane: Chat 1 — Core/controller and sole integration writer
Status: PLANNING_ONLY
Integration destination: `feat/servicedesk-v1-integrate`
Contract baseline: `dbf1f756d588925a694a4131672248ddb21a14e3` / `docs/contracts-v1.md`

## Fresh observed state

Observed before this plan was authored:

- Integration: `78000504f2749e9ecca0c720ed5b41fbf4bd1832`
- Core: `c0b6c2c7d92250398e637c30edfe12e93efc0b1a`
- Connector/AI: `51fd14c10d488932a54d9524f1b57f89359ec809`
- Product/UI: `9cec82448952e1aa8fe1d5a83655693ed4114df9`
- Core implementation anchor: `4484cee662236c4b4a0327f9abf250252c2c015d`; the three later core commits only change `AGENTS.md`, `docs/execution/throughput-recovery-20261004.md`, and `docs/taskboard.md`.
- Product implementation candidate: `d8ecc6331d30e81bd2098688877389d988b973e3`; current product HEAD is two commits ahead and those later changes are planning/instruction docs only.
- Connector Run 10 closure is implementation-rich but explicitly `CONNECTOR_INTEGRATION_BLOCKED` because the provider/AI suites and typecheck were not executed in its ENOSPC runtime.

Compared with integration, all three worker branches diverge from merge base `dbf1f756d588925a694a4131672248ddb21a14e3`:
- core: 63 ahead / 5 behind;
- connectors: 315 ahead / 5 behind;
- product: 216 ahead / 5 behind.

The five integration-only commits contain controller docs/taskboard state and must be preserved.

## Planning rules applied

- E01 and E02 are frozen against the observed source above.
- E03–E10 are dependency-gated candidates; re-read affected source before execution.
- Existing implementation is wired/tested instead of reimplemented.
- Chat 1 owns contracts, migrations, domain, server/core, server/jobs, DB/domain tests, shared config/barrels, taskboard and integration.
- Worker code is integrated at pinned SHAs only.
- Missing provider credentials block provider verification, not compilation/unit integration.
- Authored-but-unexecuted tests are not evidence.
- SQL/RLS acceptance requires actual PostgreSQL/Supabase execution; Vitest wrappers alone are insufficient.

---

# E01 — Executable Integrated Baseline

Observed base:
- integration `78000504f2749e9ecca0c720ed5b41fbf4bd1832`
- core pin `c0b6c2c7d92250398e637c30edfe12e93efc0b1a`
- connector pin `51fd14c10d488932a54d9524f1b57f89359ec809`
- product pin `9cec82448952e1aa8fe1d5a83655693ed4114df9`
- contract `dbf1f756d588925a694a4131672248ddb21a14e3`

Business capability outcome:
A single executable candidate containing the current core, connector/AI and product implementations, with real verification evidence or an explicit UNVERIFIED environment blocker.

## Ordered slices

### C1-E01-T1 — Runtime + worktree preflight — READY
Existing files:
- `package.json`
- `pnpm-lock.yaml`
- `AGENTS.md`
- `docs/contracts-v1.md`
- `docs/taskboard.md`
- `docs/execution/throughput-recovery-20261004.md`

Actions:
1. Fetch all refs and verify the four observed heads; preserve any newer legitimate commits.
2. Verify clean controller working tree.
3. Inspect free disk, Node version, pnpm availability and package-store usability.
4. Create an isolated scratch integration candidate from current integration HEAD. No reset/rebase/force-push.
5. Run `pnpm install --frozen-lockfile` if dependencies are not already usable.

Acceptance:
- exact runtime facts recorded;
- scratch worktree based on current integration;
- package install succeeds, or exact command/error is recorded and the candidate remains UNVERIFIED.

Fallback:
If runtime execution is blocked, continue C1-E01-T2/T3/T4 as source review/merge preparation on an explicitly UNVERIFIED candidate; do not publish accepted integration.

### C1-E01-T2 — Integrate pinned core range — READY after T1 worktree
Current symbols/files consumed:
- `src/server/core/requests.ts`: `createRequestWithRepository`, `updateRequestWithRepository`, `RequestRepository`
- `src/server/core/quote-facade.ts`: `createQuoteFacadeMethods`
- `src/server/core/capacity-facade.ts`: `createCapacityFacadeMethods`
- `src/server/core/operations.ts`: ledger/outbox/attention repository commands
- migrations `0001_core.sql` through `0004_ledger_outbox_attention.sql`
- existing domain/DB tests under `tests/domain/**`, `tests/db/**`

Action:
Merge the pinned core head `c0b6c2c7d92250398e637c30edfe12e93efc0b1a` into the candidate with normal history. Resolve only controller-owned/shared conflicts and preserve integration docs/taskboard.

Checks TO RUN:
`pnpm typecheck`
`pnpm vitest run tests/domain tests/db`

Pass criterion:
Typecheck exit 0 and executed Vitest suites exit 0. SQL files remain separate DB proof.

### C1-E01-T3 — Integrate pinned connector/AI range — READY after T2 merge
Existing owned surfaces:
- `src/server/integrations/**`
- `src/server/ai/**`
- provider API handlers
- `tests/providers/**`
- `tests/ai/**`

Action:
Merge connector pin `51fd14c10d488932a54d9524f1b57f89359ec809`. Preserve Chat 1 contracts/core and integration-only docs. Resolve shared barrels centrally.

Checks TO RUN:
`pnpm typecheck`
`pnpm vitest run tests/providers`
`pnpm vitest run tests/ai`

Pass criterion:
All commands execute and exit 0. Fixture/mock evidence remains contract-only; do not manufacture provider verification.

Independent fallback:
If one connector family fails on a missing approved core interface, record the exact symbol/request and continue other connector families instead of editing Chat 2 internals speculatively.

### C1-E01-T4 — Integrate pinned product/UI range — READY after T3 merge
Current product anchor:
- functional candidate `d8ecc6331d30e81bd2098688877389d988b973e3`
- current pin `9cec82448952e1aa8fe1d5a83655693ed4114df9`
- `RequestSummaryPreview.tsx` is currently fixture-backed and its update action is disabled because a real request facade is not wired.

Action:
Merge product pin `9cec82448952e1aa8fe1d5a83655693ed4114df9`. Preserve fixture labels where server actions are not yet approved; do not pretend fixture state is tenant truth.

Checks TO RUN:
`pnpm typecheck`
`pnpm vitest run tests/e2e`
`pnpm build`

Browser acceptance, if an executable browser is available:
320 / 390 / 768 / 1440 on key public/business/app routes; record URL, SHA, console errors and PASS/FAIL separately from Vitest.

### C1-E01-T5 — Full integration gate + publish — READY after T2–T4
Commands TO RUN:
`pnpm typecheck`
`pnpm test`
`pnpm lint`
`pnpm build`

Pass criterion:
All four commands execute fresh and exit 0 on the same candidate SHA.

Publish rule:
- If all executable checks pass, fast-forward/merge the verified candidate into `feat/servicedesk-v1-integrate`, update global taskboard with all source SHAs and evidence.
- If checks cannot execute, preserve the candidate on a clearly named UNVERIFIED branch and keep `feat/servicedesk-v1-integrate` unclaimed. Environment recovery remains priority.

Integration destination:
`feat/servicedesk-v1-integrate`

---

# E02 — Shared DTO Decisions + Request/Quote Server Facade

Frozen prerequisite:
`C1-E01-T5` must publish a tested integration checkpoint. Until then E02 is BLOCKED, but its source-derived tasks/signatures are frozen.

Business capability outcome:
Persisted request create/edit/property reads and request-to-quote operations are exposed through authenticated server-owned facade slices; Product can replace the disabled fixture request action without gaining business authority.

## Shared-interface rulings

### ACCEPT in E02 — PropertyDTO
Persisted source: `public.properties` in `0001_core.sql`.

Approved E02 shape:
```ts
export interface PropertyDTO {
  id: string;
  workspaceId: string;
  customerId: string;
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  serviceNotes?: string;
  accessNotes?: string;
  version: number;
}
```

Approved read:
```ts
readPropertySnapshot(
  ctx: ActorContext,
  customerId: string
): Promise<Result<PropertyDTO[]>>
```

Reason:
All fields map to the existing properties table; a customer may own multiple properties, therefore the read returns an array.

### DEFER to E05 — MessageDTO + readInboxSnapshot
Current `public.messages` persists id/workspace/conversation/direction/sender/provider id/body/attachments/created_at but does not persist the requested delivery state/timestamps. Do not fabricate `PROVIDER_ACCEPTED/DELIVERED/READ/FAILED` from connector response alone.

### DEFER to E05/E07 — CommunicationPreferenceDTO
Current `communication_consents` stores channel/purpose/status/source/evidence but has no preferred-channel or quiet-hours fields. Persistence must be added before approving the requested shape.

### DEFER to E07 — RecurringSeriesDTO + readRecurringSeries
Current `recurrence_rules` supports `WEEKLY|FORTNIGHTLY|MONTHLY` and an `active` boolean. The product request's `CUSTOM`, `DRAFT` and `CANCELLED` states are not backed by current V1 schema. E07 must either add approved persistence or return the narrower V1 contract; do not silently broaden scope.

### DEFER to E06 — FieldEvidenceDTO + readCrewJobSnapshot
No field-evidence/checklist persistence exists yet.

### DEFER to E08 — QualityCaseDTO + readQualityCaseSnapshot
No quality-case persistence exists yet.

### DEFER — readCustomerPortalSnapshot
Compose only after PropertyDTO plus persisted visit/invoice/message reads exist.

### DEFER to E10 — readTourSnapshot
Presentation/tour snapshots must be derived from integrated server state, not fixture promotion.

## Ordered slices

### C1-E02-T1 — Contract + property read — BLOCKED on E01
Modify:
- `src/contracts/dtos.ts`
- `src/contracts/index.ts`

Proposed new:
- `src/server/core/property-repository.ts`: row mapping and scoped property read gateway.
- `src/server/core/property-read.ts`: authorization + DTO conversion.

Output signature:
`readPropertySnapshot(ctx: ActorContext, customerId: string): Promise<Result<PropertyDTO[]>>`

Tests:
new `tests/db/property-read.test.ts`
Inputs: owner/dispatcher in workspace A, same customer id attempt from workspace B, missing customer.
Expected: scoped rows only; cross-workspace read denied/empty according to repository contract; no unscoped query.
Command: `pnpm vitest run tests/db/property-read.test.ts`
Pass: exit 0.

### C1-E02-T2 — Request facade slice — BLOCKED on E01
Existing symbols consumed:
- `createRequestWithRepository`
- `updateRequestWithRepository`
- `RequestRepository`
- `ServiceDeskFacade.createRequest/updateRequest`

Proposed new file:
`src/server/core/request-facade.ts`

Output:
```ts
createRequestFacadeMethods(deps): Pick<
  ServiceDeskFacade,
  "createRequest" | "updateRequest"
>
```

Behavior:
- map `CreateRequestInput` to `CreateRequestRecordInput` with `ctx.workspaceId` and visitor session;
- map persisted `RequestRecord` to `RequestDTO`;
- retain visitor-session, active-staff, role and expected-version enforcement already implemented in `requests.ts`.

Tests:
new `tests/db/request-facade.test.ts`
Expected: visitor session cannot mutate another request; dispatcher can update same-workspace request; version conflict returns `VERSION_CONFLICT`; persisted result maps to DTO.
Command: `pnpm vitest run tests/db/request-facade.test.ts tests/db/request-commands.test.ts tests/db/request-repository-adapter.test.ts`

### C1-E02-T3 — Request/quote/capacity facade composition — BLOCKED on T2
Existing symbols:
- `createRequestFacadeMethods`
- `createQuoteFacadeMethods`
- `createCapacityFacadeMethods`

Proposed new:
`src/server/core/request-quote-facade.ts`

Output:
```ts
createRequestQuoteFacade(deps): Pick<
  ServiceDeskFacade,
  "createRequest" | "updateRequest" |
  "calculateQuote" | "sendQuote" |
  "findSlots" | "holdSlot"
>
```

Do not invent implementations for `applyVerifiedPayment`, `transitionVisit` or `readWorkspaceSnapshot`; those remain later core batches.

Tests:
new `tests/db/request-quote-facade.test.ts`
Journey: create persisted request -> update rooms/service -> calculate quote -> approved quote fixture/repository state -> send quote.
Expected: server-side pricing snapshot only; workspace/visitor/version guards preserved.

### C1-E02-T4 — Server-owned entrypoint boundary — BLOCKED on T3
Responsibility:
Expose the composed request/quote facade from a server-only module usable by Chat 3 route/server actions without importing repositories directly.

Proposed new:
`src/server/core/server-entrypoints.ts`

Output signatures:
```ts
createRequestCommand(ctx, input, meta): Promise<Result<RequestDTO>>
updateRequestCommand(ctx, requestId, patch, meta): Promise<Result<RequestDTO>>
calculateQuoteCommand(ctx, requestId): Promise<Result<QuoteDTO>>
sendQuoteCommand(ctx, quoteId, meta): Promise<Result<QuoteDTO>>
readPropertySnapshot(ctx, customerId): Promise<Result<PropertyDTO[]>>
```

Dependency:
Runtime repository gateways must be provided by approved server composition; no browser-side DB client authority.

### C1-E02-T5 — E02 executable acceptance — BLOCKED on T1–T4
Commands TO RUN:
`pnpm typecheck`
`pnpm vitest run tests/db/request-facade.test.ts tests/db/request-quote-facade.test.ts tests/db/property-read.test.ts tests/db/quote-facade.test.ts`
`pnpm vitest run tests/domain`

Pass criterion:
All commands exit 0 and a persisted request-to-quote flow is exercised without fixture business truth.

Integration destination:
current tested `feat/servicedesk-v1-integrate`.

Independent fallback:
If product route wiring is blocked by Chat 3, finish property/request facade tests and publish exact server signatures for Chat 3; do not edit product-owned files.

---

# E03 — Atomic Verified Payment → Ledger / Visit / Outbox / Review

Prerequisite:
E02 verified request/quote/slot facade; integrated Chat 2 payment callback contract available.

Current source:
- `ServiceDeskFacade.applyVerifiedPayment(event: VerifiedPaymentEvent)`
- `src/server/core/operations.ts`: `appendLedgerEntryWithRepository`, `enqueueOutboxEventWithRepository`, `raiseAttentionItemWithRepository`
- `src/domain/operations.ts`: `LedgerEntry`, `OutboxEvent`, `AttentionItem`
- `0004_ledger_outbox_attention.sql`
- no core operations persistence adapter currently exists.

Business outcome:
A verified provider event is applied once to authoritative core state; duplicate/mismatch/expired-hold cases cannot falsely confirm a visit, and ambiguous cases persist operator attention.

Slices:
- C1-E03-T1 BLOCKED: add `src/server/core/operations-repository.ts` mapping `ledger_entries/outbox_events/attention_items`, preserving workspace/idempotency constraints.
- C1-E03-T2 BLOCKED: add core payment application transaction boundary consuming `VerifiedPaymentEvent`; output remains `Result<{ visit?: VisitDTO; invoice?: InvoiceDTO }>`.
- C1-E03-T3 BLOCKED: atomically append ledger + transition eligible visit/hold + enqueue confirmation outbox; no partial success.
- C1-E03-T4 BLOCKED: persist mismatched amount/currency/purpose/expired hold into deduplicated attention/review state; duplicate provider event returns prior outcome.
- C1-E03-T5 BLOCKED: actual PostgreSQL proof for transaction rollback/idempotency plus focused Vitest.

Tests:
new DB adapter/transaction tests plus SQL proof.
Commands TO RUN:
`pnpm vitest run tests/db/operations-commands.test.ts tests/db/payment-application.test.ts`
actual PostgreSQL/Supabase execution for new SQL proof.
Pass: duplicate verified event yields one ledger mutation/outbox; mismatch cannot confirm visit; transaction failure leaves no partial authoritative mutation.

Fallback:
If provider bridge is not yet wired, test the core `VerifiedPaymentEvent` input directly and publish the accepted signature to Chat 2.

---

# E04 — Durable Outbox Claiming + Lease/Retry Worker

Prerequisite:
E03 operations repository/transaction proof.

Current source:
- DB `outbox_events` already has `locked_at`, `locked_by`, `sent_at`.
- domain `OutboxEvent` currently exposes status/attempts/idempotency/nextAttemptAt but not lock/sent fields.
- `recordOutboxFailure` already supplies bounded exponential retry behavior.
- `src/server/jobs/**` does not exist yet.

Business outcome:
Two workers cannot dispatch the same committed event; crashes release via lease expiry and pending work resumes safely.

Slices:
- C1-E04-T1 BLOCKED: extend core outbox persistence model only as needed to expose lock/sent fields without changing provider ownership.
- C1-E04-T2 BLOCKED: add repository atomic claim method using PostgreSQL row locking / skip-locked semantics; proposed output `claimPendingOutbox(workerId, now, leaseSeconds, limit): Promise<Result<OutboxEvent[]>>`.
- C1-E04-T3 BLOCKED: proposed `src/server/jobs/outbox-worker.ts` with `runOutboxWorkerOnce`; dispatch callback is injected from connector layer.
- C1-E04-T4 BLOCKED: mark sent, retry transient failures with original idempotency key, terminally fail exhausted work; re-check cancellation/eligibility from core before dispatch.
- C1-E04-T5 BLOCKED: concurrency/restart DB proof.

Pass:
concurrent workers claim an event once; expired lease permits safe reclaim; SENT/terminal events are never redelivered automatically.

Fallback:
If connector dispatcher signature changes, finish claim/lease repository and tests with an injected transport interface.

---

# E05 — Inbox Persistence, Human Takeover + Delivery Read Model

Prerequisite:
E01 connector inbound/outbound/status modules integrated; E04 durable jobs available.

Current persisted source:
- `public.conversations`
- `public.messages`
- unique `(workspace_id, provider_message_id)`
- `ConversationDTO`
- current messages table lacks requested delivery lifecycle timestamps/state.

Business outcome:
Inbound messages persist once, staff takeover blocks automated outbound execution, and UI reads delivery state derived from durable server records.

Slices:
- C1-E05-T1 BLOCKED: approve DB-backed `MessageDTO`; add next available migration for durable outbound delivery lifecycle rather than inferring state.
- C1-E05-T2 BLOCKED: add conversation/message repository and `readInboxSnapshot(ctx, conversationId): Promise<Result<{ conversation: ConversationDTO; messages: MessageDTO[] }>>`.
- C1-E05-T3 BLOCKED: add handover command with expected conversation version; update `handover_active` and owner revision atomically.
- C1-E05-T4 BLOCKED: add authorized outbound enqueue command that refuses AI/automatic sends while takeover is active; provider acceptance/delivered/read updates enter through verified connector commands.
- C1-E05-T5 BLOCKED: duplicate inbound/provider idempotency + takeover race tests.

Shared request:
`MessageDTO` and `readInboxSnapshot` become ACCEPTED only after T1 persistence exists.

Communication preferences:
add/approve only fields backed by persistence; current `communication_consents` is not enough for preferred-channel/quiet-hours claims.

Pass:
same provider message persists once; cross-workspace conversation denied; takeover activated before worker dispatch prevents automated send; provider accepted/delivered/read remain distinct.

---

# E06 — Crew Job Commands + Field Evidence

Prerequisite:
E05 conversation/outbound boundary and integrated visit persistence.

Current source:
- `VisitRecord`, `VisitRepository`, `scheduleVisitFromHoldWithRepository`
- `public.crews`, `crew_members`, `visits`
- no field-evidence/checklist table.

Business outcome:
Assigned crew can perform only authorized visit transitions and capture evidence; completion requires checklist/evidence and manager review when required.

Slices:
- C1-E06-T1 BLOCKED: add transition repository operations and implement `ServiceDeskFacade.transitionVisit` with role/workspace/version guards.
- C1-E06-T2 BLOCKED: add next available field-evidence/checklist migration.
- C1-E06-T3 BLOCKED: approve DB-backed `FieldEvidenceDTO`; add evidence repository/commands.
- C1-E06-T4 BLOCKED: add `readCrewJobSnapshot(ctx, visitId)` returning visit + approved evidence/read state; enforce assigned crew scope.
- C1-E06-T5 BLOCKED: reject completion with incomplete checklist or review-required evidence; test manager-reviewed completion.

Pass:
unassigned crew denied; stale version rejected; incomplete evidence cannot become COMPLETED.

Fallback:
If storage upload signing remains product/infrastructure-blocked, complete metadata/evidence authorization and keep binary upload wiring blocked explicitly.

---

# E07 — V1 Recurrence Generation + Pause/Resume/Skip

Prerequisite:
E06 visit transition/repository stable.

Current source:
- `expandWeeklyRecurrence`
- `WeeklyRecurrenceInput`
- `recurrence_rules` with `WEEKLY|FORTNIGHTLY|MONTHLY`, timezone/local start/starts_on/ends_on/max_occurrences/`active`
- no persisted skip exception command.

Business outcome:
Basic V1 recurring visits are generated idempotently, capacity is checked per occurrence, and pause/resume/skip does not create duplicates.

Contract ruling:
Do not accept product `CUSTOM` cadence or unpersisted `DRAFT/CANCELLED` states in V1 merely for UI compatibility.
Proposed V1 `RecurringSeriesDTO` after persistence review uses cadence `WEEKLY|FORTNIGHTLY|MONTHLY`; status is only states actually persisted/approved.

Slices:
- C1-E07-T1 BLOCKED: normalize recurrence expansion for the three persisted frequencies while preserving timezone semantics.
- C1-E07-T2 BLOCKED: add recurrence repository + idempotent occurrence identity.
- C1-E07-T3 BLOCKED: add skip exception persistence and pause/resume commands.
- C1-E07-T4 BLOCKED: check capacity/active holds per occurrence before visit creation; occupied occurrence remains actionable rather than silently overbooked.
- C1-E07-T5 BLOCKED: approve `RecurringSeriesDTO` + `readRecurringSeries(ctx, customerId)` and run retry/DST/capacity tests.

Pass:
retrying generation produces no duplicate visits; paused series generates none; skipped occurrence stays skipped; occupied slot not allocated.

---

# E08 — Invoice Balance + Manual Payment + Quality / Attention Lifecycle

Prerequisite:
E03 authoritative ledger and E06 visit completion/evidence.

Current source:
- `InvoiceDTO` contract exists.
- no invoice/payment/quality tables are present in migrations 0001–0004.
- `attention_items` already stores `owner_user_id` and `due_at`, while domain `AttentionItem` does not yet expose them.

Business outcome:
Financial balance is derived from authoritative ledger entries; authorized manual payments are auditable; quality cases and attention ownership/deadlines are durable.

Slices:
- C1-E08-T1 BLOCKED: add invoice persistence using next available migration; balance is derived from ledger allocations, never AI/provider text.
- C1-E08-T2 BLOCKED: authorized manual payment command writes an idempotent ledger entry with actor/audit context.
- C1-E08-T3 BLOCKED: extend attention domain/repository to owner/due fields already persisted.
- C1-E08-T4 BLOCKED: add quality-case persistence and approve DB-backed `QualityCaseDTO` + `readQualityCaseSnapshot(ctx, visitId)`.
- C1-E08-T5 BLOCKED: version-conflict, duplicate payment, balance and case lifecycle tests.

Pass:
financial totals equal ledger truth; duplicate manual payment does not double-credit; stale quality/attention update rejected.

---

# E09 — Permissioned Reporting + Platform Billing Separation + Usage

Prerequisite:
E08 financial/quality persistence and E01 connector subscription adapter integrated.

Current source:
- no core subscription/usage/report persistence exists in current core branch;
- `workspace_memberships` has billing-role metadata;
- connector lane contains subscription/provider boundary code, which must not mutate customer invoice truth.

Business outcome:
Reports are workspace/role scoped, platform subscription billing is separate from customer service invoices, and workspace usage limits are enforced server-side.

Slices:
- C1-E09-T1 BLOCKED: define permission-filtered reporting read models from core DB aggregates.
- C1-E09-T2 BLOCKED: add platform subscription/usage persistence in separate tables/resource types.
- C1-E09-T3 BLOCKED: bridge verified platform-subscription events to platform ledger only; never customer invoice allocation.
- C1-E09-T4 BLOCKED: server-side usage checks on approved resource creation paths.
- C1-E09-T5 BLOCKED: two-workspace isolation + billing separation tests.

Pass:
workspace A cannot read B metrics; platform subscription cannot mark a customer invoice paid; exceeded usage is rejected before mutation.

Fallback:
If billing provider proof is unavailable, execute pure core contract/ledger tests with injected verified events; provider stays CONFIGURATION_BLOCKED.

---

# E10 — Final Integrated Journey + DB/RLS/Concurrency + Operations Packet

Prerequisite:
E03–E09 accepted ranges plus current pinned Chat 2/Chat 3 ranges.

Business outcome:
The V1 enquiry-to-paid-job workflow is proven on one integrated SHA, with unresolved live-provider gates explicitly separated from code readiness.

Slices:
- C1-E10-T1 BLOCKED: integrate all accepted pinned worker ranges accumulated after E01; resolve shared conflicts centrally.
- C1-E10-T2 BLOCKED: run actual PostgreSQL/Supabase migrations and SQL RLS/concurrency proofs for tenancy, quote snapshot, capacity hold, payment/outbox/job claims and later schemas.
- C1-E10-T3 BLOCKED: execute full `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, provider/AI suites and UI/e2e suite on the same SHA.
- C1-E10-T4 BLOCKED: browser journey at required responsive widths for enquiry -> request edit -> quote -> slot/checkout -> confirmed job -> crew/quality/invoice surfaces; fixture-only routes remain labelled.
- C1-E10-T5 BLOCKED: update `docs/taskboard.md`, `docs/operations.md` and release/handoff packet with exact SHA, commands, DB/browser evidence and remaining provider configuration gates.

Pass:
No unresolved compile/test/build/DB safety failure; complete authoritative journey is evidenced; provider verification claims are supported only by controlled receipts.

Integration destination:
`feat/servicedesk-v1-integrate`

---

# Dependency manifest

- C1-E01-T1 -> C1-E01-T2 -> C1-E01-T3 -> C1-E01-T4 -> C1-E01-T5
- C1-E02-* requires C1-E01-T5
- E03 requires E02 verified facade/contract checkpoint
- E04 requires E03 durable operations repository
- E05 requires E04 plus integrated Chat 2 message/status boundaries
- E06 requires E05 and visit persistence
- E07 requires E06 visit/capacity commands
- E08 requires E03 ledger + E06 completion/evidence
- E09 requires E08 and integrated subscription/provider boundary
- E10 requires all accepted E03–E09 ranges and current worker pins

Independent fallback policy:
A blocked external provider or worker interface never authorizes cross-lane duplicate helpers. Complete a declared independent core repository/test/read task in the same batch, or record the exact dependency and stop only when no independent authorized work remains.

# Planner self-check

- IDs unique: PASS
- E01/E02 source-derived and frozen: PASS
- Later batches have explicit prerequisites: PASS
- No READY task has an unmet dependency: PASS
- Current implementation identified and not requeued as greenfield: PASS
- Ownership follows `AGENTS.md`: PASS
- Product shared-interface requests explicitly accepted/deferred: PASS
- Every batch has executable acceptance: PASS
- Unexecuted commands are labelled TO RUN, not evidence: PASS
- Provider mocks/fixtures are not promoted to provider verification: PASS

# First execution task

`C1-E01-T1`

Execute E01 from the current integration branch. Refresh all four branch heads and preserve newer progress. Restore/confirm an executable isolated integration runtime, then sequentially integrate the pinned core, connector and product ranges and run the specified verification after each. Do not end after the first merge or failure; continue through independent E01 slices. Publish `feat/servicedesk-v1-integrate` only if the full executable gate passes. Otherwise preserve an explicitly UNVERIFIED candidate and report the exact environment/test blocker.
