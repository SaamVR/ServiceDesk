# ServiceDesk AI V1 — Responsive + Accessibility Evidence Checklist

Status: Chat 3 static hardening complete for this pass. Browser verification is still blocked in the current GPT Runtime because no local checkout is available and GitHub DNS resolution fails.

## Current static hardening

Implemented on `feat/servicedesk-v1-product`:

- Global skip link to `#main-content` from the root layout.
- Separate `src/app/responsive-a11y.css` loaded after `globals.css`.
- Static min-width containment for layout primitives to reduce overflow risk.
- `overflow-wrap:anywhere` for headings, text, pills, links and buttons.
- `:target` scroll-margin for sticky-header anchor navigation.
- Mobile-safe tour scenario step cards.
- Mobile-safe slide index and scenario link horizontal scroll regions.
- Reduced-motion override disabling presentation scroll snap.
- Focus-visible outline on slide cards.
- UI state cards use `role="status"`, `aria-live`, and `aria-atomic`.
- Fixture-only state actions are disabled and labeled as preview.

## Fixture IDs used for inspection

Use the actual seeded UI fixture IDs:

- request: `req_moveout_001`
- quote: `quote_moveout_001`
- slot: `slot_showcase_001`
- visit: `visit_showcase_001`
- invoice: `invoice_showcase_001`
- conversation: `conv_showcase_001`

## Routes requiring browser inspection

Inspect these after Runtime checkout or deployment is available:

### Public

- `/`
- `/features`
- `/integrations`
- `/pricing`
- `/b/brightroom`
- `/b/brightroom/enquire`
- `/b/brightroom/book`

### Customer

- `/portal`
- `/portal/properties`
- `/portal/quotes/quote_moveout_001`
- `/portal/bookings/visit_showcase_001`
- `/portal/invoices/invoice_showcase_001`
- `/portal/preferences`

### Staff

- `/app/BrightRoom%20Services/overview`
- `/app/BrightRoom%20Services/inbox`
- `/app/BrightRoom%20Services/customers`
- `/app/BrightRoom%20Services/quotes`
- `/app/BrightRoom%20Services/schedule`
- `/app/BrightRoom%20Services/jobs`
- `/app/BrightRoom%20Services/invoices`
- `/app/BrightRoom%20Services/quality`
- `/app/BrightRoom%20Services/automations`
- `/app/BrightRoom%20Services/reports`
- `/app/BrightRoom%20Services/settings`
- `/app/BrightRoom%20Services/billing`

### Crew

- `/crew/today`
- `/crew/jobs/visit_showcase_001`

### Showcase

- `/onboarding`
- `/tour`
- `/presentation`

## Viewport matrix

Required viewports:

- 320px
- 390px
- 768px
- 1440px

For each inspected route, record:

- no horizontal body overflow;
- sticky header does not cover target content;
- nav remains reachable;
- grouped staff nav can scroll on mobile;
- touch targets are at least 44px where interactive;
- focus-visible is visible and not clipped;
- tab order follows visual order;
- disabled preview actions are visibly disabled;
- fixture/sandbox/configuration labels remain visible;
- no provider state is mislabeled as verified;
- reduced-motion mode does not rely on scroll snapping;
- headings remain readable at 320px;
- status pills wrap instead of overflowing;
- no accidental private/customer data appears.

## Known blockers

- No local checkout in current Runtime.
- `git ls-remote https://github.com/SaamVR/ServiceDesk.git HEAD` fails with DNS resolution error.
- Browser checks, typecheck, lint, build and test execution are therefore not claimed in this evidence document.

## Provider evidence state

No provider evidence was collected in this pass.

Current provider-related proof remains:

- WhatsApp: configuration blocked / fixture only.
- Calendar: configuration blocked / fixture only.
- Payments: sandbox or fixture only.
- Email/webhook/AI: configuration blocked or fixture only.

No `PROVIDER_VERIFIED` claim is allowed from this pass.
