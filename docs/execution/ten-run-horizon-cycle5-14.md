# ServiceDesk AI — Ten-Run Throughput Horizon (Cycles 5–14)

Date: 2026-10-04
Purpose: reduce coordinator planning latency while preserving source-derived active batches.

This is a thematic queue. It does not authorize skipping proof, ownership, or the active batch. Cycle 5 is active; Cycle 6 is the preplanned backup. Later cycles are promoted and source-refreshed by the GPT-5.6 coordinator before dispatch.

| Cycle | Worker 1 — Core | Worker 2 — Connectors/AI | Worker 3 — Product/UI |
| --- | --- | --- | --- |
| 5 | Request → Quote → Visit command integrity sweep | WhatsApp outbound/receipt/template/media safety sweep | Quote/onboarding/recovery/quality/connector truth sweep |
| 6 | Repository/facade idempotency + failure/atomicity boundaries | WhatsApp outbound dispatch + acceptance/retry consolidation | CRM/request/schedule/inbox data-truth sweep |
| 7 | Customer/property/CRM tenancy + import/update invariants | Google Calendar OAuth/freebusy/reconciliation hardening | Crew/job/customer-portal/quality operational truth |
| 8 | Capacity recurrence/time/date safety + scheduling conflicts | Payment checkout/webhook/signature/idempotency hardening | Integrations/recovery/settings/onboarding readiness |
| 9 | Visit lifecycle/crew assignment/state transition hardening | Email transport/templates/callback lifecycle | Reporting/platform billing/invoice/checkout consistency |
| 10 | Ledger/outbox/attention retry + recovery semantics | Generic webhook + n8n execution/retry/idempotency | Presentation/tour/product-story accuracy and proof labels |
| 11 | Invoice/payment application + late-payment review core | AI extraction/tool/action business-truth guards | Accessibility/static action boundaries + responsive contracts |
| 12 | Subscription/platform-billing core semantics | AI model recovery/cost/provider selection | Route-family/navigation consistency and dead-route cleanup |
| 13 | Quality/review/feedback + owner attention semantics | Cross-provider recovery scheduler/lease/receipt/ops snapshot | Server-wiring preparation against accepted shared contracts |
| 14 | Core release regression + canonical catch-up | Provider release regression + controlled live-proof preparation | Product release regression + build/browser catch-up |

## Promotion rule

When any lane completes a cycle:
1. coordinator integrates it immediately;
2. that lane's already-prepared backup becomes active;
3. coordinator refreshes exact source for the next horizon row and writes a new backup;
4. other lanes continue independently.

## Outage-era prioritization

While canonical pnpm/build/browser remains unavailable:
- prioritize pure TypeScript/Node-standard-library logic with strong package-free harnesses;
- avoid starting dependency-heavy work that cannot be executed;
- author canonical tests now so the eventual catch-up gate becomes a verification pass rather than a development cycle.

## End condition for each run

Each worker should finish >=5 substantive slices where the packet contains that much authorized work. If primary slices finish early, execute FALLBACK slices from the same packet before returning.
