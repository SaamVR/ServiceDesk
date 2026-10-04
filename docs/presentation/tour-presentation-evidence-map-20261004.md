# ServiceDesk AI V1 — Tour + Presentation Evidence Map

Status: Chat 3 product/UI handoff for the guided tour and presentation route.

Branch: `feat/servicedesk-v1-product`

## Implemented in this batch

### `/tour`

The tour now contains:

1. Static proof anchors used by the slide deck:
   - `#pain`
   - `#promise`
   - `#pricing`
   - `#contact`
2. Three controlled scenarios:
   - `#enquiry-to-paid-job`
   - `#unusual-work-approval`
   - `#failed-send-recovery`
3. Route links from each scenario into implemented product surfaces.
4. Per-step proof boundary labels:
   - `FIXTURE_UI_ONLY`
   - `SANDBOX`
   - `CONFIGURATION_BLOCKED`

### `/presentation`

The presentation now contains:

1. A keyboard-friendly slide index.
2. Exactly 10 slides sourced from `presentationSlides`.
3. Slide links that resolve to either controlled tour scenarios or approved static tour anchors.
4. No provider-proof claim from fixture/sandbox data.

## Scenario route coverage

### 1. WhatsApp enquiry to paid job

Routes:

- `/b/brightroom/enquire`
- `/portal/quotes/quote_moveout_001`
- `/portal/bookings/visit_showcase_001`
- `/crew/jobs/visit_showcase_001`
- `/portal/invoices/invoice_showcase_001`

Boundary:

- Synthetic until Chat 2 supplies controlled provider receipts.
- Sandbox checkout remains sandbox-labelled.
- Receipt display remains blocked until payment callback proof exists.

### 2. Unusual work needs staff approval

Routes:

- `/app/brightroom/overview`
- `/app/brightroom/requests`
- `/app/brightroom/quotes`
- `/app/brightroom/inbox`

Boundary:

- Staff approval is product/UI evidence only.
- Quote approval command remains Chat 1/core authority.
- Inbox delivery proof remains Chat 2/provider authority.

### 3. Failed send and stale Calendar recovery

Routes:

- `/onboarding`
- `/app/brightroom/automations`
- `/app/brightroom/schedule`
- `/app/brightroom/reports`

Boundary:

- Provider recovery is configuration-blocked.
- Calendar freshness and payment/capacity review are visible but not provider verified.
- Reports are scoped to stored sample records only.

## Tests added or updated

- `tests/e2e/showcase-content.test.ts`
  - scenario route links
  - forbidden provider-proof terms
  - three-scenario contract
  - ten-slide contract
- `tests/e2e/presentation-tour-contract.test.ts`
  - ten unique slides
  - slide links resolve to scenario/static tour anchors
  - scenario proof boundary remains conservative

## Verification status

Not executed locally in this batch because Runtime GitHub DNS is blocked and no local checkout exists.

Do not mark this as browser-verified until `/tour` and `/presentation` are inspected at:

- 390px
- 768px
- 1440px

Required checks after integration:

- slide index wraps without horizontal overflow;
- tour scenario route links are reachable;
- static anchors land on visible sections;
- keyboard focus is visible on slide cards and route links;
- no fixture/sandbox state reads as production provider proof.

## Provider-proof status

`CONFIGURATION_BLOCKED`

No WhatsApp, Calendar, payment, email, webhook or AI provider receipt is included in this handoff.
