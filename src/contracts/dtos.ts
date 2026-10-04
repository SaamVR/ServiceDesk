import type { CurrencyCode, ISODateTime } from "./core";

export type RequestStatus = "NEW" | "COLLECTING" | "READY" | "NEEDS_REVIEW" | "QUOTED" | "BOOKED" | "LOST" | "CLOSED";

export interface RequestDTO {
  id: string; workspaceId: string; customerId?: string; propertyId?: string; serviceCode?: string;
  status: RequestStatus; bedrooms?: number; bathrooms?: number; requestedStartAt?: ISODateTime;
  version: number; createdAt: ISODateTime; updatedAt: ISODateTime;
}


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

export interface QuoteDTO {
  id: string; workspaceId: string; requestId: string; version: number;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "SUPERSEDED";
  currency: CurrencyCode; subtotalMinor: number; taxMinor: number; totalMinor: number; depositMinor: number;
  balanceMinor: number; durationMinutes: number; bufferMinutes: number; rateVersion: string; validUntil: ISODateTime;
}

export interface SlotDTO {
  id: string; workspaceId: string; crewId: string; startAt: ISODateTime; endAt: ISODateTime;
  serviceMinutes: number; bufferMinutes: number; availabilityFresh: boolean;
}

export interface VisitDTO {
  id: string; workspaceId: string; requestId: string; quoteId: string; crewId?: string;
  status: "AWAITING_PAYMENT" | "CONFIRMED" | "ASSIGNED" | "EN_ROUTE" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "CANCELLED" | "PAYMENT_REVIEW";
  startAt: ISODateTime; serviceMinutes: number; bufferMinutes: number; version: number;
}

export interface InvoiceDTO {
  id: string; workspaceId: string; visitId?: string; status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  currency: CurrencyCode; totalMinor: number; allocatedMinor: number; refundedMinor: number; balanceMinor: number;
}

export interface ConversationDTO {
  id: string; workspaceId: string; requestId?: string; customerId?: string; channel: "WEB" | "WHATSAPP" | "EMAIL";
  assignedUserId?: string; handoverActive: boolean; version: number; lastMessageAt?: ISODateTime;
}

export interface IntegrationStatusDTO {
  workspaceId: string; provider: "WHATSAPP" | "GOOGLE_CALENDAR" | "PAYMENT" | "EMAIL" | "WEBHOOK" | "AI";
  status: "NOT_CONFIGURED" | "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "BLOCKED";
  mode?: "FIXTURE" | "SANDBOX" | "LIVE"; lastSuccessfulAt?: ISODateTime; lastErrorAt?: ISODateTime; message?: string;
}

export interface AttentionItemDTO {
  id: string; workspaceId: string; type: string; severity: "INFO" | "WARNING" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"; resourceType: string; resourceId: string;
  ownerUserId?: string; dueAt?: ISODateTime; summary: string;
}


export type MessageDeliveryState =
  | "QUEUED"
  | "RUNNING"
  | "PROVIDER_ACCEPTED"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "SUPPRESSED";

export interface MessageDTO {
  id: string;
  workspaceId: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL";
  senderKind: "CUSTOMER" | "STAFF" | "AI" | "SYSTEM";
  providerMessageId?: string;
  body?: string;
  mediaReference?: { provider: "WHATSAPP"; providerMediaId: string };
  deliveryState?: MessageDeliveryState;
  createdAt: ISODateTime;
}


export type VisitEvidenceKind =
  | "BEFORE_PHOTO"
  | "AFTER_PHOTO"
  | "ISSUE_PHOTO"
  | "TIME_MATERIAL_NOTE"
  | "INCIDENT_NOTE";

export interface VisitEvidenceDTO {
  id: string;
  workspaceId: string;
  visitId: string;
  kind: VisitEvidenceKind;
  mediaReference?: { storageProvider: string; objectRef: string; mimeType?: string };
  text?: string;
  capturedAt: ISODateTime;
  submittedByUserId: string;
  createdAt: ISODateTime;
}

export interface VisitChecklistItemDTO {
  id: string;
  workspaceId: string;
  visitId: string;
  itemKey: string;
  completed: boolean;
  note?: string;
  updatedByUserId: string;
  updatedAt: ISODateTime;
  version: number;
}

export type RecurrenceFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export interface RecurrenceRuleDTO {
  id: string;
  workspaceId: string;
  requestId: string;
  propertyId: string;
  frequency: RecurrenceFrequency;
  timezone: string;
  localStartTime: string;
  startsOn: string;
  endsOn?: string;
  maxOccurrences?: number;
  generatedOccurrences: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  nextOccurrenceOn?: string;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
