# ServiceDesk AI V1 — Chat 3 Shared Interface Requests

Status: Product/UI lane request list only. This document does not modify shared contracts. Chat 1 owns DTO/facade approval.

Current Product/UI execution context:

- Product lane planning head: `cc9fac1b4d6bef8162706b7749281606fdab07b4`.
- E01 inventory found no approved server-backed replacement for the missing DTO/read concepts below.
- Current core `WorkspaceSnapshot` covers only `requests`, `quotes`, `visits`, and `invoices`.
- All requests below map to `D-C1-SHARED-READS` unless a more specific blocker is listed.

## Product-lane rule

Until Chat 1 accepts or explicitly defers these requests:

- product UI keeps using frozen DTOs where available;
- missing concepts remain explicitly fixture-only;
- fixtures cannot be presented as tenant truth;
- no product component may claim provider verification;
- no UI action should appear executable without a command handler.

## Executable request matrix

| Request | Existing consumer path | Current symbol/component | Current test coverage | Blocking task | Minimum accepted output |
|---|---|---|---|---|---|
| `MessageDTO` | `src/features/inbox/InboxPreview.tsx`, `src/features/inbox/view-models.ts`, `src/features/product/story-model.ts` | `TemporaryInboxMessage`, `buildInboxThreadView`, `tourScenarios` | `tests/e2e/inbox-view-model.test.ts`, `tests/e2e/presentation-tour-contract.test.ts`, `tests/e2e/product-action-boundary.test.ts` | E03-01/E03-03; D-C2-E03-INBOX for provider status writes | message read model with provider accepted/delivered/read/failed distinction |
| `PropertyDTO` | `src/features/properties/PropertyRecurringPreview.tsx`, `src/features/properties/view-models.ts`, `src/features/crm/CrmPreview.tsx` | `buildPropertyRecurringView`, `buildCrmCustomerView` | `tests/e2e/property-recurring-view-model.test.ts`, `tests/e2e/crm-view-model.test.ts` | E07-01/E07-03; D-C1-E07-CUSTOMER | property read model scoped by workspace/customer |
| `RecurringSeriesDTO` | `src/features/properties/PropertyRecurringPreview.tsx`, `src/features/properties/view-models.ts` | local recurrence labels inside `buildPropertyRecurringView` | `tests/e2e/property-recurring-view-model.test.ts` | E07-02/E07-03; D-C1-E07-CUSTOMER | recurrence read model and pause/resume/skip command decision |
| `CommunicationPreferenceDTO` | `src/features/preferences/CommunicationPreferences.tsx`, `src/features/preferences/view-models.ts` | `buildCommunicationPreferenceView` | `tests/e2e/preferences-view-model.test.ts` | E07-02/E07-04; D-C1-E07-CUSTOMER | persisted preferences with outbound-policy relevant fields |
| `QualityCaseDTO` | `src/features/quality/QualityReviewPreview.tsx`, `src/features/quality/view-models.ts` | `QualityCaseFixture`, `buildQualityCaseView` | `tests/e2e/quality-view-model.test.ts`, `tests/e2e/product-action-boundary.test.ts` | E08-03/E08-04; D-C1-E08-OPS | quality case read model and review request/resolution command decision |
| `FieldEvidenceDTO` | `src/features/crew/CrewJobPreview.tsx`, `src/features/crew/view-models.ts` | fixture `evidenceSlots` returned by `buildCrewExecutionView` | `tests/e2e/crew-execution-view-model.test.ts`, `tests/e2e/crew-route-module.test.ts`, `tests/e2e/product-action-boundary.test.ts` | E06-03/E06-04; D-C1-E06-FIELD | field evidence read model plus signed upload/authorization decision |

## Requested DTOs

### MessageDTO

Needed by:

- shared inbox;
- tour delivery-state proof;
- WhatsApp accepted / delivered / read distinction;
- staff handover/reply UI in E03.

Existing consumer details:

- `src/features/inbox/view-models.ts`: replace `TemporaryInboxMessage` while preserving `buildInboxThreadView(input)` as the presenter mapping.
- `src/features/inbox/InboxPreview.tsx`: replace module-local `sampleMessages` and `sampleThread`.
- `src/features/product/story-model.ts`: tour steps currently reference provider-accepted / delivery-failed semantics.
- Tests: `tests/e2e/inbox-view-model.test.ts`, `tests/e2e/presentation-tour-contract.test.ts`.
- Blocking task: E03-01/E03-03; Chat 2 provider bridge dependency `D-C2-E03-INBOX` for status mutation receipts.

Suggested shape:

```ts
export interface MessageDTO {
  id: string;
  workspaceId: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: "WEB" | "WHATSAPP" | "EMAIL";
  bodyPreview: string;
  deliveryStatus: "DRAFT" | "QUEUED" | "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED";
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  version: number;
}
```

### PropertyDTO

Needed by:

- customer portal properties route;
- CRM context;
- recurring visit setup.

Existing consumer details:

- `src/features/properties/view-models.ts`: replace derived fixture property labels in `buildPropertyRecurringView`.
- `src/features/properties/PropertyRecurringPreview.tsx`: stop using sample request/quote/slot/visit/invoice to stand in for a property.
- `src/features/crm/view-models.ts`: replace `propertyLabel` derived from `RequestDTO.propertyId`.
- Tests: `tests/e2e/property-recurring-view-model.test.ts`, `tests/e2e/crm-view-model.test.ts`.
- Blocking task: E07-01/E07-03; dependency `D-C1-E07-CUSTOMER`.

Suggested shape:

```ts
export interface PropertyDTO {
  id: string;
  workspaceId: string;
  customerId: string;
  label: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  serviceNotes?: string;
  accessNotes?: string;
  version: number;
}
```

### RecurringSeriesDTO

Needed by:

- customer recurrence preview;
- future repeat cleaning flow;
- schedule/report recurrence labels.

Existing consumer details:

- `src/features/properties/view-models.ts`: replace recurrence eligibility/labels derived from visit and invoice fixture state.
- `src/features/properties/PropertyRecurringPreview.tsx`: display accepted recurrence data once persistence exists.
- Tests: `tests/e2e/property-recurring-view-model.test.ts`.
- Blocking task: E07-02/E07-03; dependency `D-C1-E07-CUSTOMER`.

Suggested shape:

```ts
export interface RecurringSeriesDTO {
  id: string;
  workspaceId: string;
  customerId: string;
  propertyId: string;
  serviceCode: string;
  cadence: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "CUSTOM";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "CANCELLED";
  nextVisitAt?: string;
  version: number;
}
```

### CommunicationPreferenceDTO

Needed by:

- customer preferences route;
- staff consent/quiet-hours boundary;
- outbound policy UI.

Existing consumer details:

- `src/features/preferences/view-models.ts`: replace `conversation.channel` + fixture quiet-hours labels in `buildCommunicationPreferenceView`.
- `src/features/preferences/CommunicationPreferences.tsx`: stop using `sampleConversation` and `sampleIntegrations` as preference truth.
- Tests: `tests/e2e/preferences-view-model.test.ts`.
- Blocking task: E07-02/E07-04; dependency `D-C1-E07-CUSTOMER` plus Chat 2 outbound-policy consumption.

Suggested shape:

```ts
export interface CommunicationPreferenceDTO {
  id: string;
  workspaceId: string;
  customerId: string;
  preferredChannel: "WEB" | "WHATSAPP" | "EMAIL";
  quietHoursStart?: string;
  quietHoursEnd?: string;
  marketingOptIn: boolean;
  serviceUpdatesOptIn: boolean;
  version: number;
  updatedAt: string;
}
```

### QualityCaseDTO

Needed by:

- staff quality route;
- feedback case ownership;
- review request boundary.

Existing consumer details:

- `src/features/quality/view-models.ts`: replace `QualityCaseFixture` while preserving `buildQualityCaseView({ visit, qualityCase, attentionItems })` presenter mapping.
- `src/features/quality/QualityReviewPreview.tsx`: stop using module-local `sampleQualityCase`.
- Tests: `tests/e2e/quality-view-model.test.ts`, `tests/e2e/product-action-boundary.test.ts`.
- Blocking task: E08-03/E08-04; dependency `D-C1-E08-OPS`.

Suggested shape:

```ts
export interface QualityCaseDTO {
  id: string;
  workspaceId: string;
  visitId: string;
  state: "OPEN" | "IN_REVIEW" | "RESOLVED";
  feedbackScore?: number;
  summary: string;
  ownerUserId?: string;
  dueAt?: string;
  resolutionNote?: string;
  reviewRequestState: "NOT_ELIGIBLE" | "ELIGIBLE" | "REQUESTED";
  version: number;
}
```

### FieldEvidenceDTO

Needed by:

- crew job detail;
- checklist/photo proof;
- completion review.

Existing consumer details:

- `src/features/crew/view-models.ts`: replace fixture `evidenceSlots` and checklist proof labels in `buildCrewExecutionView`.
- `src/features/crew/CrewJobPreview.tsx`: render accepted evidence records and upload/authorization state.
- Tests: `tests/e2e/crew-execution-view-model.test.ts`, `tests/e2e/crew-route-module.test.ts`, `tests/e2e/product-action-boundary.test.ts`.
- Blocking task: E06-03/E06-04; dependency `D-C1-E06-FIELD`.

Suggested shape:

```ts
export interface FieldEvidenceDTO {
  id: string;
  workspaceId: string;
  visitId: string;
  kind: "CHECKLIST" | "PHOTO" | "TIME_NOTE" | "MATERIAL_NOTE" | "INCIDENT";
  status: "PENDING" | "CAPTURED" | "REVIEW_REQUIRED" | "APPROVED" | "REJECTED";
  label: string;
  note?: string;
  capturedAt?: string;
  capturedByUserId?: string;
  version: number;
}
```

## Requested facade/API reads and commands

These can be route-level server reads, server actions, or facade snapshot helpers. Exact API shape is Chat 1 owned. Product/UI only needs serializable snapshots and command results.

| Read/command | Existing consumer | Blocking E-task | Minimum output / behavior |
|---|---|---|---|
| `readInboxSnapshot(ctx, conversationId)` | `src/app/app/[workspace]/inbox/page.tsx`, `InboxPreview` | E03-03 | `ConversationDTO` + `MessageDTO[]` + handover/reply permission |
| `replyToConversation(ctx, conversationId, body, meta)` or accepted equivalent | inbox reply UI | E03-03/E03-04 | `Result<MessageDTO>` or policy denial; provider status remains separate |
| `setConversationHandover(ctx, conversationId, enabled, meta)` or accepted equivalent | inbox handover UI | E03-03/E03-04 | updated `ConversationDTO`; prevents AI send when active |
| `readCustomerPortalSnapshot(ctx, customerId)` | `src/app/portal/**`, `CustomerPanel` | E05-01 | request/quote/visit/invoice plus any accepted property/preference summaries |
| `readPropertySnapshot(ctx, customerId)` | properties and CRM surfaces | E07-01 | `PropertyDTO[]` scoped to workspace/customer |
| `readRecurringSeries(ctx, customerId)` | properties/recurrence controls | E07-02 | `RecurringSeriesDTO[]` scoped to workspace/customer |
| `pauseRecurringSeries` / `resumeRecurringSeries` / `skipRecurringOccurrence` or accepted equivalents | recurrence controls | E07-03 | versioned Result with conflict state |
| `readCommunicationPreference(ctx, customerId)` | preferences route and outbound-policy preview | E07-02 | `CommunicationPreferenceDTO` or explicit not-configured state |
| `updateCommunicationPreference(ctx, customerId, patch, meta)` or accepted equivalent | preferences route | E07-03/E07-04 | versioned Result; quiet-hours/consent fields persisted |
| `readQualityCaseSnapshot(ctx, visitId)` | quality route | E08-03 | `QualityCaseDTO` + related `AttentionItemDTO[]` |
| `resolveQualityCase` / `requestCustomerReview` or accepted equivalents | quality actions | E08-04 | versioned Result; review request eligibility enforced |
| `readCrewJobSnapshot(ctx, visitId)` | crew job detail | E06-03 | `RequestDTO`, `VisitDTO`, `InvoiceDTO`, `FieldEvidenceDTO[]`, allowed actions |
| `appendFieldEvidence` / signed upload command or accepted equivalent | crew evidence UI | E06-03 | signed upload/read state; actor scoped to assigned crew |
| `readTourSnapshot(ctx, scenarioId)` | `/tour`, `/presentation` | E10-01/E10-03 | integrated journey state and proof boundary labels |
| `readIntegrationReadiness(ctx)` or accepted equivalent | onboarding/settings/integrations | E09-03 | `IntegrationStatusDTO[]` from configured state, not fixture samples |
| `readPlatformBillingSnapshot(ctx)` or accepted equivalent | billing/settings | E09-02 | platform subscription status separated from customer `InvoiceDTO` |

## Existing facade methods already observed

The product plan can use these once Chat 1 provides the authenticated server composition boundary:

```ts
createRequest(ctx, input, meta): Promise<Result<RequestDTO>>
updateRequest(ctx, id, patch, meta): Promise<Result<RequestDTO>>
calculateQuote(ctx, id): Promise<Result<QuoteDTO>>
sendQuote(ctx, id, meta): Promise<Result<QuoteDTO>>
findSlots(ctx, input): Promise<SlotDTO[]>
holdSlot(ctx, slotId, quoteId, meta): Promise<Result<{ holdId: string; expiresAt: string }>>
transitionVisit(ctx, id, action, meta): Promise<Result<VisitDTO>>
readWorkspaceSnapshot(ctx, query): Promise<Result<WorkspaceSnapshot>>
```

Product/UI blocker: no accepted route-level accessor/composition boundary is observed in the product lane or current integration branch, so Chat 3 must not invent a singleton or duplicate server ownership.
