# ServiceDesk AI — Cycle 5 Worker 3 / Product & UI — Long-Run Truth & Readiness Batch

Branch: `feat/servicedesk-v1-product`
Expected previous HEAD: `eeed52256937d520c37921228402e287b31e1c8e`

Read:
- `AGENTS.md`
- `docs/execution/runtime-outage-mode-20261004.md`
- `docs/execution/high-throughput-mode-v2-20261004.md`
- this packet

Do one quick normal-runtime probe. If canonical package access remains unavailable, enter outage mode immediately.

## Completion quota

Complete at least FIVE substantive slices before receipt unless every remaining authorized slice is genuinely blocked. If READY finishes, continue FALLBACK automatically.

Prefer 2–3 grouped implementation commits plus one compact receipt.

React/Next/browser-dependent work remains frozen in outage mode. This batch owns pure Product view-model logic and canonical tests only.

## READY queue

### CYCLE-5-W3-T1 — Quote approval state truth

Current:
- `src/features/quotes/view-models.ts`
- `tests/e2e/quote-approval-view-model.test.ts`

Current `needsApproval` can remain true for a high-value quote after APPROVED/SENT/ACCEPTED because it also keys directly off total value.

Harden view logic so lifecycle state is authoritative:
- PENDING_APPROVAL => needsApproval true;
- APPROVED/SENT/ACCEPTED/DECLINED/EXPIRED/SUPERSEDED => needsApproval false;
- DRAFT must not be labelled ready for staff send;
- high-value risk remains visible as risk metadata without re-opening approval after approval is complete.

Preserve `canAiApprove:false`.

### CYCLE-5-W3-T2 — Onboarding missing-provider fail-closed

Current:
- `src/features/onboarding/view-models.ts`
- `tests/e2e/onboarding-view-model.test.ts`

A partial integration array can currently make `allLive` true.

Require the V1 operational provider set represented by the product:
- WHATSAPP
- GOOGLE_CALENDAR
- PAYMENT
- EMAIL
- AI

For overall IMPLEMENTED/readiness:
- every required provider must be present;
- every required provider must be CONNECTED;
- every required provider must be LIVE.

Missing providers must appear as blocked/missing readiness, never implicit success.

WEBHOOK may remain supplemental unless existing source/test contracts explicitly require it.

### CYCLE-5-W3-T3 — Recovery release-state completeness

Current:
- `src/features/recovery/view-models.ts`
- `tests/e2e/recovery-actions-view-model.test.ts`

Harden releaseLabel:
- empty integrations must not imply IMPLEMENTED when recovery items exist;
- each recovery item must have its mapped provider present;
- mapped provider must be CONNECTED + LIVE for releaseLabel to be IMPLEMENTED;
- any missing/sandbox/fixture/degraded/blocked provider => CONFIGURATION_BLOCKED;
- `canExecuteAutomatically` stays false.

### CYCLE-5-W3-T4 — Connector proof requires provider state

Current:
- `src/features/integrations/view-models.ts`
- `tests/e2e/connector-operations-view-model.test.ts`

Current providerVerified depends only on evidence samples.

Harden so mapped provider stages require BOTH:
- sample.state === PROVIDER_VERIFIED;
- matching IntegrationStatusDTO is CONNECTED + LIVE.

Missing/non-live integration must keep releaseLabel CONFIGURATION_BLOCKED even if the evidence sample claims PROVIDER_VERIFIED.

Keep RECOVERY/unmapped stages governed by their evidence state without inventing a provider mapping.

### CYCLE-5-W3-T5 — Quality review eligibility requires completed visit

Current:
- `src/features/quality/view-models.ts`
- `tests/e2e/quality-view-model.test.ts`

`canRequestReview` must require all:
- qualityCase.state === RESOLVED;
- reviewRequestState === ELIGIBLE;
- visit.status === COMPLETED.

Resolved quality case on a non-completed/cancelled/payment-review visit must fail closed.

Update reviewRequestLabel so the reason is understandable without claiming a request was sent.

### CYCLE-5-W3-T6 — Communication preference real-provider truth

Current:
- `src/features/preferences/view-models.ts`
- `tests/e2e/preferences-view-model.test.ts`

Current availability can treat CONNECTED + SANDBOX or CONNECTED + undefined mode as real provider use.

Require:
- integration.status === CONNECTED;
- integration.mode === LIVE.

FIXTURE, SANDBOX, undefined mode, missing integration, degraded/re-auth/blocked remain unavailable.

Keep the view explicitly fixture/UI-only and do not create production preference mutations.

### CYCLE-5-W3-T7 — Combined Product outage harness

Add:
- `tests/e2e/runtime-outage-product-readiness-harness.ts`

Use Node assert and real changed view-models.

Cover at minimum:
- high-value ACCEPTED quote does not reopen approval;
- DRAFT is not send-ready;
- partial/missing required provider set is blocked;
- recovery with missing/non-live mapped provider is blocked;
- PROVIDER_VERIFIED evidence + non-live integration remains blocked;
- resolved quality case + non-COMPLETED visit cannot request review;
- CONNECTED+SANDBOX preference channel is unavailable;
- all representative valid cases still behave correctly.

Run under global `ts-node --transpile-only`.

## FALLBACK queue

F1. Add regression that empty evidence list never yields providerVerified true.

F2. Add onboarding regression for duplicate provider entries where one is stale/non-live; choose fail-closed semantics instead of accepting an arbitrary duplicate.

F3. Add quality regression for REQUESTED review state ensuring canRequestReview=false and label remains informational.

## Canonical gate

If pnpm recovers: focused affected e2e tests → broader Product suite → typecheck/lint/build/browser smoke.

Otherwise outage harness PASS => `IMPLEMENTED`; canonical gate remains `CONFIGURATION_BLOCKED`. No CONTRACT_TESTED/provider/browser claim.

## Receipt

Write compact:
`docs/execution/receipts/worker-3-cycle-5.md`

Include completed slice IDs and READY_NEXT. Do not restate packet/source.
