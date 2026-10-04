import { describe, expect, it } from "vitest";
import type { AttentionItemDTO, IntegrationStatusDTO, SlotDTO, VisitDTO } from "../../src/contracts";
import { buildScheduleLaneView } from "../../src/features/schedule/view-models";

const slot: SlotDTO = {
  id: "slot_001",
  workspaceId: "ws_showcase",
  crewId: "crew_alpha",
  startAt: "2026-10-09T09:00:00.000Z",
  endAt: "2026-10-09T13:30:00.000Z",
  serviceMinutes: 240,
  bufferMinutes: 30,
  availabilityFresh: false,
};

const visit: VisitDTO = {
  id: "visit_001",
  workspaceId: "ws_showcase",
  requestId: "req_001",
  quoteId: "quote_001",
  crewId: "crew_alpha",
  status: "ASSIGNED",
  startAt: slot.startAt,
  serviceMinutes: 240,
  bufferMinutes: 30,
  version: 3,
};

const calendarStatus: IntegrationStatusDTO = {
  workspaceId: "ws_showcase",
  provider: "GOOGLE_CALENDAR",
  status: "DEGRADED",
  mode: "FIXTURE",
  message: "External busy cache is stale.",
};

const conflict: AttentionItemDTO = {
  id: "attn_calendar_stale",
  workspaceId: "ws_showcase",
  type: "CALENDAR_STALE",
  severity: "WARNING",
  status: "OPEN",
  resourceType: "slot",
  resourceId: slot.id,
  summary: "Calendar freshness stale before customer can confirm instantly.",
};

describe("schedule lane view model", () => {
  it("explains stale calendar and slot freshness without confirming instantly", () => {
    const view = buildScheduleLaneView({ slot, visit, integrations: [calendarStatus], attentionItems: [conflict] });

    expect(view.slotId).toBe(slot.id);
    expect(view.crewLabel).toBe("crew_alpha");
    expect(view.durationLabel).toBe("240m service + 30m buffer");
    expect(view.freshnessLabel).toBe("Stale availability — staff review required");
    expect(view.integrationLabel).toBe("Google Calendar · DEGRADED · FIXTURE");
    expect(view.conflictReasons).toEqual(["Calendar freshness stale before customer can confirm instantly."]);
    expect(view.canInstantConfirm).toBe(false);
  });
});
