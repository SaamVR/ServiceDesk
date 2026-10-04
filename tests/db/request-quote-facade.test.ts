import { describe, expect, it } from "vitest";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import type { QuoteSnapshot } from "../../src/domain/quote";
import { createRequestQuoteFacadeMethods } from "../../src/server/core/request-quote-facade";
import type { RequestRecord, RequestRepository } from "../../src/server/core/requests";

const now = "2026-10-04T06:00:00.000Z";
const owner = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" as const };

describe("request quote capacity composition", () => {
  it("composes request update into quote calculation and slot read", async () => {
    const requests: RequestRecord[] = [];
    const quotes: QuoteSnapshot[] = [];
    const slot: CapacitySlot = { id: "slot_1", workspaceId: "ws_1", crewId: "crew_1", startsAt: "2026-10-05T09:00:00.000Z", endsAt: "2026-10-05T13:30:00.000Z", capacityMinutes: 270 };
    const requestRepository: RequestRepository = {
      insert: async (request) => { requests.push(request); return { ok: true, value: request }; },
      findById: async (workspaceId, id) => ({ ok: true, value: requests.find((request) => request.workspaceId === workspaceId && request.id === id)! }),
      update: async (request) => { requests[0] = request; return { ok: true, value: request }; },
    };
    const facade = createRequestQuoteFacadeMethods({
      requestRepository, nextRequestId: () => "req_1", now: () => now,
      quoteRepository: { nextQuoteId: () => "quote_1", findById: async (id) => quotes.find((quote) => quote.id === id), findLatestByRequest: async (id) => quotes.filter((quote) => quote.requestId === id).at(-1), saveQuote: async (quote) => { quotes.push(quote); }, supersedeQuote: async () => undefined, updateQuoteStatus: async () => undefined },
      capacityRepository: { nextHoldId: () => "hold_1", findSlotById: async () => ({ ok: true, value: slot }), listActiveHoldsForSlot: async () => ({ ok: true, value: [] as SlotHold[] }), insertHold: async (hold) => ({ ok: true, value: hold }), listSlots: async () => ({ ok: true, value: [slot] }), listActiveHoldsForWindow: async () => ({ ok: true, value: [] as SlotHold[] }) },
    });
    const created = await facade.createRequest(owner, { serviceCode: "MOVE_OUT" }, { idempotencyKey: "create", now });
    if (!created.ok) throw new Error("create failed");
    await facade.updateRequest(owner, created.value.id, { bedrooms: 3, bathrooms: 2 }, { idempotencyKey: "update", now, expectedVersion: 1 });
    await expect(facade.calculateQuote(owner, created.value.id)).resolves.toMatchObject({ ok: true, value: { totalMinor: 34000, status: "APPROVED" } });
    await expect(facade.findSlots(owner, { requestId: created.value.id, from: "2026-10-05T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z" })).resolves.toHaveLength(1);
  });
});
