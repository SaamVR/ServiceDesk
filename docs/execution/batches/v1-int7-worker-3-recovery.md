# V1 Integration Sprint 7 — Worker 3 COMPLETION RECOVERY / E08 Product

Branch: `feat/servicedesk-v1-product-sprint6`
Expected current HEAD: `daf62783d46b3a453206535cfbe6ab0d4b604416`
Original base: `fa9568970c012550149a0093360e68bbdaa69e62`

Read:
- AGENTS.md
- docs/execution/provider-access-policy-20261004.md
- original `docs/execution/batches/v1-int7-worker-3.md`
- this recovery packet

## Situation
Your prior INT7 run durably added useful:
- invoice server boundary;
- quality server boundary;
- expanded snapshot validator;
- outage harness.

But it did NOT complete the assigned Product capability.

Still fixture-owned:
- `QualityReviewPreview.tsx`
- `RecoveryActionsPreview.tsx`

Missing:
- explicit quality fixture wrapper;
- explicit recovery fixture wrapper;
- actual reusable props-driven quality/recovery components;
- operational route integration for the new typed boundaries;
- full canonical tests;
- receipt currently overstates completion.

Preserve the useful existing files and finish the remaining scope.

### R1 — refactor quality view model to real DTO
Remove `QualityCaseFixture` as reusable business truth.

`buildQualityCaseView` must consume `QualityCaseDTO`.

Data source/status should be supplied by the caller, not hard-coded `FIXTURE_UI_ONLY`.

Preserve:
- feedback
- owner/due
- resolution
- review eligibility
- linked attention count.

### R2 — reusable QualityReviewPreview
Make `QualityReviewPreview` props-driven:
- qualityCase: QualityCaseDTO
- visit: VisitDTO
- attentionItems: AttentionItemDTO[]
- action availability/pending/result props as needed.

No sample-data import.
No local sampleQualityCase.

Buttons:
- START_REVIEW
- ASSIGN
- RESOLVE
- REQUEST_REVIEW
only enabled when an injected accepted action handler is supplied and action is valid for current state.

No optimistic mutation.

Create:
`QualityReviewFixturePreview.tsx`
which alone owns fixture quality data for demo routes.

### R3 — reusable RecoveryActionsPreview
Remove direct imports of:
- sampleAttentionItems
- sampleIntegrations
- sampleVisit
- local recoveryFixtures

Reusable component must consume authoritative props:
- AttentionItemDTO[]
- IntegrationStatusDTO[]
- optional InvoiceDTO/VisitDTO/QualityCaseDTO context.

Derive known recovery cards from authoritative attention types/resources:
- DELIVERY_UNCERTAIN
- CALENDAR_STALE
- PAYMENT_REVIEW
- QUALITY / field attention where present.

Unknown attention type remains visible as generic human review; do not discard it.

Recovery actions stay read-only/human-owned because no frozen Core recovery command exists.

Create:
`RecoveryActionsFixturePreview.tsx`
for showcase data only.

### R4 — invoice operational presentation
Keep existing props-driven `InvoiceLedgerPreview`.

Add a reusable staff invoice operational wrapper/view using:
- InvoiceDTO
- manual-payment availability
- injected manual-payment handler.

Customer invoice remains read-only and manual payment disabled.

No fixture business truth in reusable wrapper.

### R5 — operational route data
Extend `OperationalRouteData` / route mappings as needed for:
- selected invoice
- quality case
- attention/integrations.

Reusable OperationalRoute should render real props-driven invoice/quality/recovery surfaces when data is supplied.

OperationalFixtureRoute may explicitly use fixture wrappers.

Do not regress any existing route family.

### R6 — route boundaries
Prepare existing routes:
- staff invoices
- staff quality
- staff automations/recovery
- portal invoice

with dependency-injected loader/action factories or explicit fixture wrappers.

Do not instantiate Core repositories/provider clients.

### R7 — action/error state
Wire existing action-state mapping for:
- invoice not found/paid/void
- amount/currency validation result
- unauthorized
- version conflict
- quality state conflict
- quality resolution required
- server failure.

No optimistic invoice or quality state mutation.

### R8 — tests
Expand package-free harness to assert:
- QualityReviewPreview has no sample-data/local fixture truth;
- RecoveryActionsPreview has no sample-data/local fixture truth;
- only *FixturePreview wrappers own showcase fixtures;
- exact Core manual-payment/quality signatures;
- expectedVersion propagated;
- customer manual payment disabled;
- recovery read-only;
- route coverage preserved;
- no provider/Core repository imports.

Add focused canonical tests for reusable quality/recovery props and route-boundary behavior.

### R9 — receipt correction
Update:
`docs/execution/receipts/v1-int7-worker-3.md`

Add an explicit RECOVERY section and only claim:
INVOICE_PRODUCT_BOUNDARY=PASS
QUALITY_PRODUCT_BOUNDARY=PASS
RECOVERY_PRODUCT_BOUNDARY=PASS
ROUTE_COVERAGE=PASS
after R1-R8 are actually complete.

MANDATORY remote save gate.

Return:
WORKER=3
SPRINT=V1-INT7-RECOVERY
FINAL_SHA=<sha>
REMOTE_HEAD_ADVANCED=YES
RECEIPT_REMOTE=YES
STATE=<IMPLEMENTED|CONTRACT_TESTED|BLOCKED>
INVOICE_PRODUCT_BOUNDARY=<PASS|FAIL>
QUALITY_PRODUCT_BOUNDARY=<PASS|FAIL>
RECOVERY_PRODUCT_BOUNDARY=<PASS|FAIL>
ROUTE_COVERAGE=<PASS|FAIL>
BLOCKERS=<exact blockers>
READY_NEXT=E09 reporting/admin/settings/platform billing Product wiring
