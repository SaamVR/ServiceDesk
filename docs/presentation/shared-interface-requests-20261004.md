# ServiceDesk AI V1 — Chat 3 Shared Interface Requests

Status: Product/UI lane request list only. This document does not modify shared contracts. Chat 1 owns DTO/facade approval.

## Why this exists

Chat 3 currently renders several V1 product surfaces using frozen DTOs where available and explicitly labelled fixture-only local types where shared DTOs are not yet available.

The goal is to make replacement with facade/API snapshots straightforward without letting product fixtures become a second source of business truth.

## Requested DTOs

### MessageDTO

Needed by:

- shared inbox
- tour delivery-state proof
- WhatsApp accepted / delivered / read distinction

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

- customer portal properties route
- CRM context
- recurring visit setup

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

- customer recurrence preview
- future repeat cleaning flow
- schedule/report recurrence labels

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

- customer preferences route
- staff consent/quiet-hours boundary
- outbound policy UI

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

- staff quality route
- feedback case ownership
- review request boundary

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

- crew job detail
- checklist/photo proof
- completion review

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

## Requested facade/API reads

These can be route-level server reads or facade snapshot helpers. Exact API shape is Chat 1 owned.

```ts
readInboxSnapshot(ctx, conversationId)
readCustomerPortalSnapshot(ctx, customerId)
readPropertySnapshot(ctx, customerId)
readRecurringSeries(ctx, customerId)
readCommunicationPreference(ctx, customerId)
readQualityCaseSnapshot(ctx, visitId)
readCrewJobSnapshot(ctx, visitId)
readTourSnapshot(ctx, scenarioId)
```

## Product-lane boundary

Until these are approved:

- product UI keeps using frozen DTOs where available;
- missing concepts remain explicitly fixture-only;
- fixtures cannot be presented as tenant truth;
- no product component may claim provider verification;
- no UI action should appear executable without a command handler.
