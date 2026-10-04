# ServiceDesk AI V1 — Product tour and presentation storyboard

Status: Chat 3 product/UI evidence map. Provider receipts, real payment evidence and real screenshots remain blocked until Chat 2 verifies controlled providers and Chat 1 integrates facade-backed application state.

## Product route map

- `/` — outcome-first homepage with interface proof preview.
- `/features` — lifecycle, staff/customer/crew capabilities and operational boundaries.
- `/integrations` — WhatsApp, Google Calendar, payments, email/webhook and AI status with configuration-blocked states.
- `/use-cases/cleaning` — residential cleaning V1 story.
- `/pricing` — deterministic quote fixture and contact-first platform-plan copy; no invented SaaS prices.
- `/help`, `/contact`, `/privacy`, `/terms` — support and policy baseline copy with no unverified claims.
- `/b/[slug]` — public business home with service story, operating-area placeholder, process and journey CTAs.
- `/b/[slug]/enquire` — focused enquiry route with read-only fixture form and editable structured summary.
- `/b/[slug]/book` — focused booking route with slot/hold/checkout boundary and sandbox payment labels.
- `/portal` — customer overview only.
- `/portal/properties` — property and recurrence preview only.
- `/portal/quotes/[id]` — current quote/version boundary only.
- `/portal/bookings/[id]` — booking and checkout-state preview only.
- `/portal/invoices/[id]` — invoice allocation ledger only.
- `/portal/preferences` — communication preference preview only.
- `/app/[workspace]/overview` — staff attention overview.
- `/app/[workspace]/inbox` — inbox and delivery-state distinction.
- `/app/[workspace]/customers` — CRM/customer context.
- `/app/[workspace]/requests` — structured request summary.
- `/app/[workspace]/quotes` — quote approval/version comparison.
- `/app/[workspace]/schedule` — schedule freshness/conflict panel.
- `/app/[workspace]/jobs` — staff visit/assignment summary.
- `/app/[workspace]/invoices` — invoice allocation ledger.
- `/app/[workspace]/quality` — quality case lifecycle.
- `/app/[workspace]/automations` — recovery action ownership.
- `/app/[workspace]/reports` — scoped reporting metrics.
- `/app/[workspace]/settings` — owner service/team/integration settings.
- `/app/[workspace]/billing` — platform billing boundary separated from customer payments.
- `/crew/today` — mobile assigned-visit list with network-required V1 boundary.
- `/crew/jobs/[id]` — mobile crew job execution, checklist, evidence, notes, incident and completion review.
- `/onboarding` — six-step owner setup readiness plus ordered connector operations evidence.
- `/tour` — isolated showcase workspace with three controlled scenarios.
- `/presentation` — ten keyboard-addressable slides linking into `/tour`.
- `/demo` — redirects to `/tour`.

## Current implemented UI proof map

These are product-lane interfaces. Unless otherwise stated, the displayed operational records are typed fixture/sample DTOs waiting for facade/API integration.

| Journey | Implemented UI evidence | Current proof boundary |
| --- | --- | --- |
| Public business site | route-specific home/enquire/book modules with journey CTAs | public copy is fixture/sample; no real owner service catalog yet |
| Intake | editable request summary, missing fields, deterministic quote explanation | fixture DTOs; mutations must go through `ServiceDeskFacade.updateRequest` |
| CRM | request/quote/visit/invoice/conversation customer context | derived from frozen DTOs; customer/property DTO detail still pending shared contract |
| Quote approval | current/version comparison, approval state and immutable sent-version warning | UI only; domain approval command remains Chat 1 authority |
| Shared inbox | conversation/context panes and accepted/delivered/read/failed distinction | no provider receipt; message DTO requested from Chat 1 |
| Schedule | calendar freshness, slot conflicts and instant-confirmation blocking | Calendar provider proof unavailable |
| Checkout | quote/hold/payment/visit stages, sandbox labeling, receipt suppression | no live or provider-verified payment receipt |
| Customer portal | route-specific overview/property/quote/booking/invoice/preferences surfaces | property/recurrence/preferences use isolated fixture types pending shared DTOs |
| Crew | route-specific today/job-detail surfaces, status progression, checklist, evidence slots, time/material note, incident, completion boundary | field-proof DTO/core commands pending Chat 1; no offline sync claim |
| Onboarding | six setup steps plus provider readiness and connector operations | owner settings and provider receipts are configuration-blocked |
| Quality | feedback, case owner/deadline, resolution and optional review request | quality case uses isolated fixture type pending shared DTO |
| Reporting | conversion, collection, capacity and missing-contribution labels from stored DTO records | no invented metrics; facade-backed scoped data pending |
| Connector operations | WhatsApp inbound, outbound policy, status, Calendar, payment, recovery sequence | fixture/sandbox/policy evidence only; `CONFIGURATION_BLOCKED` |
| Recovery | delivery reconcile, Calendar reconnect/freshness, payment/capacity review actions | buttons are UI affordances only until commands are integrated |

## Tour scenarios

### 1. WhatsApp enquiry → quote → deposit → Calendar → crew completion → balance

Synthetic until Chat 2 verifies real provider receipts.

1. Customer asks for move-out cleaning.
2. AI/tool-assisted intake captures service, property, bedrooms, bathrooms, oven, area and date.
3. Request summary remains editable and versioned.
4. Core quote fixture returns $340 total, $85 deposit, $255 balance, 240-minute service and 30-minute buffer.
5. Customer selects a fresh slot; the app shows a 15-minute hold.
6. Test checkout state is labelled as sandbox/sample.
7. Calendar event, provider acceptance, delivery and read remain separate states.
8. Crew executes checklist, evidence, time/material note and incident workflow.
9. Completion review precedes balance invoice/customer feedback.
10. Receipt is shown only after verified payment evidence exists.

### 2. Unusual work → staff approval

1. Oversized property or hazardous note changes request to NEEDS_REVIEW.
2. Attention queue opens an owned review task.
3. Dispatcher compares the current quote/version and policy boundary.
4. Staff approves, revises or declines through domain authority.
5. Customer receives only the authoritative current quote version.

### 3. Failed send / stale Calendar / late payment → owned recovery

1. Provider delivery fails or becomes uncertain.
2. Calendar freshness becomes stale or synchronization fails.
3. Payment after hold expiry enters PAYMENT_REVIEW instead of silently confirming.
4. Attention item shows resource, severity and owner.
5. Dispatcher reconciles uncertain provider state before retry.
6. Calendar reconnect/refresh happens before instant confirmation.
7. Payment/capacity is reviewed before visit confirmation.
8. Recovery remains auditable and does not fabricate provider success.

## Ten-slide presentation

1. Customer pain — fragmented messages, quotes, calendars, crews and invoices.
2. Product promise — one operational record.
3. Customer journey — business enquiry, editable summary, quote, property/recurrence, booking, invoices, preferences.
4. Staff inbox and CRM — attention first, conversation/context panes and customer operational context.
5. Pricing and quote governance — deterministic fixture plus versioned approval.
6. Scheduling and connector state — holds, freshness, buffers, conflicts and distinct provider states.
7. Crew execution — today list, job detail, status, checklist, evidence, time/material and incident.
8. Collections and recurrence — deposit, balance, invoice allocation and repeat visits.
9. Quality/recovery/onboarding boundaries — feedback cases, failed delivery, owner setup, handover and no invented authority.
10. Actual capabilities and contact — link to tour and mark configuration-blocked provider/test history accurately.

## Screenshot capture matrix

Do not capture “final” publishing screenshots until the integrated branch renders facade-backed routes.

Required capture set after integration:

- 1440px: homepage, public business home, staff overview/inbox/schedule/quality, presentation.
- 768px: customer portal modules and onboarding connector readiness.
- 390px: customer booking/checkout and crew job execution.
- 320px: business enquiry and crew job detail stress check.

Each capture must confirm no clipping, no accidental public customer data, readable 16px body, touch targets, focus visibility and reduced-motion behavior.

## Evidence policy

- Use real screenshots only after implementation renders the integrated routes.
- Mark synthetic history, fixture provider state and sandbox payment state until verified provider evidence exists.
- Never show a connected badge, delivered/read state, paid receipt, testimonial, compliance claim or live-mode payment proof without source evidence.
- Provider acceptance is not recipient delivery.
- Fixture/sample states can prove UI contracts only; they are never `PROVIDER_VERIFIED`.
- Chat 3 does not merge into `feat/servicedesk-v1-integrate`; Chat 1 inspects and integrates exact pushed commits.
