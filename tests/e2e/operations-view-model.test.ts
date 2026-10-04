import { describe, expect, it } from "vitest";
import type {
  AttentionItemDTO,
  ConversationDTO,
  IntegrationStatusDTO,
  InvoiceDTO,
  QuoteDTO,
  RequestDTO,
  SlotDTO,
  VisitDTO,
} from "../../src/contracts";
import {
  buildCrewJobView,
  buildCustomerPortalView,
  buildStaffQueueView,
  formatMinorMoney,
} from "../../src/features/operations/view-models";

const request: RequestDTO = {
  id: "req_moveout_001",
  workspaceId: "ws_clear_nest",
  customerId: "cust_ada",
  propertyId: "prop_sw11",
  serviceCode: "MOVE_OUT",
  status: "QUOTED",
  bedrooms: 3,
  bathrooms: 2,
  requestedStartAt: "2026-10-09T09:00:00.000Z",
  version: 4,
  createdAt: "2026-10-04T06:00:00.000Z",
  updatedAt: "2026-10-04T06:15:00.000Z",
};

const quote: QuoteDTO = {
  id: "quote_001",
  workspaceId: "ws_clear_nest",
  requestId: request.id,
  version: 2,
  status: "SENT",
  currency: "USD",
  subtotalMinor: 34_000,
  taxMinor: 0,
  totalMinor: 34_000,
  depositMinor: 8_500,
  balanceMinor: 25_500,
  durationMinutes: 240,
  bufferMinutes: 30,
  rateVersion: "move-out-v1",
  validUntil: "2026-10-06T06:15:00.000Z",
};

const slot: SlotDTO = {
  id: "slot_001",
  workspaceId: "ws_clear_nest",
  crewId: "crew_alpha",
  startAt: "2026-10-09T09:00:00.000Z",
  endAt: "2026-10-09T13:30:00.000Z",
  serviceMinutes: 240,
  bufferMinutes: 30,
  availabilityFresh: false,
};

const visit: VisitDTO = {
  id: "visit_001",
  workspaceId: "ws_clear_nest",
  requestId: request.id,
  quoteId: quote.id,
  crewId: "crew_alpha",
  status: "ASSIGNED",
  startAt: slot.startAt,
  serviceMinutes: 240,
  bufferMinutes: 30,
  version: 1,
};

const invoice: InvoiceDTO = {
  id: "invoice_001",
  workspaceId: "ws_clear_nest",
  visitId: visit.id,
  status: "PARTIALLY_PAID",
  currency: "USD",
  totalMinor: 34_000,
  allocatedMinor: 8_500,
  refundedMinor: 0,
  balanceMinor: 25_500,
};

const conversation: ConversationDTO = {
  id: "conv_001",
  workspaceId: "ws_clear_nest",
  requestId: request.id,
  customerId: "cust_ada",
  channel: "WHATSAPP",
  assignedUserId: "dispatcher_1",
  handoverActive: true,
  version: 8,
  lastMessageAt: "2026-10-04T06:12:00.000Z",
};

const attention: AttentionItemDTO = {
  id: "attention_001",
  workspaceId: "ws_clear_nest",
  type: "CALENDAR_STALE",
  severity: "WARNING",
  status: "OPEN",
  resourceType: "slot",
  resourceId: slot.id,
  ownerUserId: "dispatcher_1",
  dueAt: "2026-10-04T07:00:00.000Z",
  summary: "Calendar freshness stale before customer can confirm instantly.",
};

const calendarStatus: IntegrationStatusDTO = {
  workspaceId: "ws_clear_nest",
  provider: "GOOGLE_CALENDAR",
  status: "DEGRADED",
  mode: "FIXTURE",
  lastErrorAt: "2026-10-04T06:12:00.000Z",
  message: "Calendar availability is stale; staff review required.",
};

describe("operations view models", () => {
  it("formats minor money without floating point math", () => {
    expect(formatMinorMoney(34_000, "USD")).toBe("$340.00");
    expect(formatMinorMoney(8_500, "USD")).toBe("$85.00");
  });

  it("builds a customer portal summary from frozen DTOs", () => {
    const view = buildCustomerPortalView({ request, quote, slot, visit, invoice, conversation });

    expect(view.requestId).toBe(request.id);
    expect(view.quoteVersionLabel).toBe("Quote v2 · SENT");
    expect(view.totalLabel).toBe("$340.00");
    expect(view.depositLabel).toBe("$85.00");
    expect(view.balanceLabel).toBe("$255.00");
    expect(view.slotFreshness).toBe("STALE_REVIEW_REQUIRED");
    expect(view.handoverLabel).toBe("Human handover active");
  });

  it("builds a staff queue item with attention and provider status separated", () => {
    const view = buildStaffQueueView({ request, quote, conversation, attentionItems: [attention], integrations: [calendarStatus] });

    expect(view.items).toHaveLength(1);
    expect(view.items[0].severity).toBe("WARNING");
    expect(view.items[0].resourceLabel).toBe("slot slot_001");
    expect(view.items[0].integrationLabel).toBe("Google Calendar · DEGRADED · FIXTURE");
    expect(view.items[0].nextAction).toBe("Review Calendar freshness before instant confirmation.");
  });

  it("builds a crew job card from visit/request/invoice state", () => {
    const view = buildCrewJobView({ request, visit, invoice });

    expect(view.visitId).toBe(visit.id);
    expect(view.statusLabel).toBe("ASSIGNED");
    expect(view.durationLabel).toBe("240m service + 30m buffer");
    expect(view.balanceLabel).toBe("Balance due $255.00 after completion review");
    expect(view.nextAction).toBe("Start travel");
  });
});
