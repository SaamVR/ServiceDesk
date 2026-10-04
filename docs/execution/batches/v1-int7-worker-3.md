# V1 Integration Sprint 7 — Worker 3 / E08 Invoice + Quality + Recovery Product

Branch: `feat/servicedesk-v1-product-sprint6`
Exact base: `fa9568970c012550149a0093360e68bbdaa69e62`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- this packet

Use frozen coordinator contracts:
- InvoiceDTO
- QualityCaseDTO
- AttentionItemDTO
- ManualPaymentInput
- QualityCaseAction / QualityCaseActionInput
- applyManualPayment(...)
- applyQualityCaseAction(...)
- expanded WorkspaceSnapshot

## Mission
Convert invoice/quality/recovery Product surfaces from fixture-owned business truth to typed server snapshot/action boundaries. No cosmetic redesign.

### T1 — invoice server boundary
Build dependency-injected adapters for:
- readWorkspaceSnapshot invoice data;
- applyManualPayment(ctx, invoiceId, input, meta).

No client-side balance mutation.
No optimistic payment.
Manual payment form submits amount/currency/method/reference/occurredAt exactly to server command.

InvoiceLedgerPreview remains props-driven.

### T2 — manual-payment Product rules
Only expose staff manual-payment action when an accepted server adapter is injected.

UI validates basic input shape only.
Server owns:
- remaining balance;
- currency;
- authorization;
- idempotency;
- invoice status.

Handle:
- invoice not found;
- already paid/void;
- amount mismatch;
- currency mismatch;
- version/idempotency conflict;
- unauthorized;
- server failure.

### T3 — quality props boundary
Refactor reusable `QualityReviewPreview` away from local fixture quality case.

Consume:
- QualityCaseDTO;
- VisitDTO;
- AttentionItemDTO[];
- injected action availability/state.

Create explicit `QualityReviewFixturePreview` for demo routes.

### T4 — quality actions
Dependency-injected exact Core boundary:
`applyQualityCaseAction(ctx,id,action,input,meta)`

Support Product controls for:
- START_REVIEW
- ASSIGN
- RESOLVE
- REQUEST_REVIEW

No optimistic quality state changes.
ExpectedVersion/idempotency from current quality case/action context.

### T5 — recovery props boundary
Refactor reusable `RecoveryActionsPreview` away from local recoveryFixtures/sample-data imports.

Build recovery presentation from authoritative:
- AttentionItemDTO[];
- IntegrationStatusDTO[];
- optionally QualityCaseDTO/InvoiceDTO/VisitDTO context supplied by route.

Recovery remains explicit/human-owned.
Do not invent an automated Core recovery command where none exists.

Create explicit fixture wrapper for showcase routes.

### T6 — expanded snapshot mapper
Update route data/server boundary to consume expanded WorkspaceSnapshot:
- invoices;
- recurrenceRules;
- visitEvidence;
- visitChecklistItems;
- attentionItems;
- qualityCases.

Fail closed on workspace mismatches.
Do not fabricate absent quality cases.

### T7 — operational routes
Wire existing:
- staff invoices;
- portal invoice read-only;
- quality;
- recovery/automations
to the typed boundary/fixture wrappers as appropriate.

Preserve all previous route coverage.

Do not enable customer manual payment.

### T8 — harness/tests
Package-free harness proves:
- reusable quality/recovery components own no fixture business truth;
- manual payment delegates once with exact server input;
- no optimistic invoice/quality mutation;
- snapshot cross-workspace rejection;
- customer manual payment disabled;
- quality expectedVersion propagation;
- recovery remains read-only/human-owned;
- no provider/Core repository imports;
- route coverage preserved.

Canonical tests authored.

Receipt:
`docs/execution/receipts/v1-int7-worker-3.md`

Return:
WORKER=3
SPRINT=V1-INT7
FINAL_SHA=<sha>
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
CANONICAL_GATE=<state>
INVOICE_PRODUCT_BOUNDARY=<PASS|FAIL>
QUALITY_PRODUCT_BOUNDARY=<PASS|FAIL>
RECOVERY_PRODUCT_BOUNDARY=<PASS|FAIL>
ROUTE_COVERAGE=<PASS|FAIL>
BLOCKERS=<exact blockers>
READY_NEXT=E09 reporting/admin/settings/platform billing Product wiring
