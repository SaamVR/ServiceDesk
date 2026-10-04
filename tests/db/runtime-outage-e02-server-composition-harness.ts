import assert from "node:assert/strict";
import type { ActorContext, CommandMeta, PropertyDTO, Result } from "../../src/contracts";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import type { QuoteSnapshot } from "../../src/domain/quote";
import { createServerCommandEntrypoints } from "../../src/server/core/server-entrypoints";
import type { RequestRecord, RequestRepository } from "../../src/server/core/requests";

const now = "2026-10-04T06:00:00.000Z";
const visitor: ActorContext = { workspaceId: "ws_1", visitorSessionId: "visitor_1", role: "VISITOR" };
const wrongVisitor: ActorContext = { workspaceId: "ws_1", visitorSessionId: "visitor_2", role: "VISITOR" };
const owner: ActorContext = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" };
const wrongWorkspaceOwner: ActorContext = { workspaceId: "ws_2", userId: "owner_2", role: "OWNER" };

function createInMemoryDeps() {
  const requests: RequestRecord[] = [];
  const quotes: QuoteSnapshot[] = [];
  const holds: SlotHold[] = [];
  const slots: CapacitySlot[] = [{
    id: "slot_1",
    workspaceId: "ws_1",
    crewId: "crew_1",
    startsAt: "2026-10-05T09:00:00.000Z",
    endsAt: "2026-10-05T13:30:00.000Z",
    capacityMinutes: 270,
  }];
  const properties: PropertyDTO[] = [{
    id: "prop_1",
    workspaceId: "ws_1",
    customerId: "cust_1",
    label: "Home",
    addressLine1: "1 Main St",
    city: "London",
    postalCode: "SW1A 1AA",
    countryCode: "GB",
    serviceNotes: "Use eco products",
    accessNotes: "Key safe",
    version: 3,
  }];

  const requestRepository: RequestRepository = {
    insert: async (record) => { requests.push(record); return { ok: true, value: record }; },
    findById: async (workspaceId, id) => {
      const request = requests.find((item) => item.workspaceId === workspaceId && item.id === id);
      return request ? { ok: true as const, value: request } : { ok: false as const, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." };
    },
    update: async (record) => {
      const index = requests.findIndex((item) => item.workspaceId === record.workspaceId && item.id === record.id);
      if (index < 0) return { ok: false as const, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." };
      requests[index] = record;
      return { ok: true as const, value: record };
    },
  };

  return {
    requestRepository,
    nextRequestId: () => `req_${requests.length + 1}`,
    quoteRepository: {
      nextQuoteId: () => `quote_${quotes.length + 1}`,
      findById: async (quoteId: string) => quotes.find((quote) => quote.id === quoteId),
      findLatestByRequest: async (requestId: string) => quotes.filter((quote) => quote.requestId === requestId).at(-1),
      saveQuote: async (quote: QuoteSnapshot) => { quotes.push(quote); },
      supersedeQuote: async (quoteId: string) => {
        const quote = quotes.find((item) => item.id === quoteId);
        if (quote) quote.status = "SUPERSEDED";
      },
      updateQuoteStatus: async (quoteId: string, status: QuoteSnapshot["status"]) => {
        const quote = quotes.find((item) => item.id === quoteId);
        if (quote) quote.status = status;
      },
    },
    capacityRepository: {
      nextHoldId: () => `hold_${holds.length + 1}`,
      findSlotById: async (workspaceId: string, slotId: string): Promise<Result<CapacitySlot>> => {
        const slot = slots.find((item) => item.workspaceId === workspaceId && item.id === slotId);
        return slot ? { ok: true, value: slot } : { ok: false, code: "SLOT_NOT_FOUND", message: "Slot was not found in this workspace." };
      },
      listActiveHoldsForSlot: async (workspaceId: string, slotId: string): Promise<Result<SlotHold[]>> => ({ ok: true, value: holds.filter((hold) => hold.workspaceId === workspaceId && hold.slotId === slotId) }),
      insertHold: async (hold: SlotHold): Promise<Result<SlotHold>> => { holds.push(hold); return { ok: true, value: hold }; },
      listSlots: async (workspaceId: string): Promise<Result<CapacitySlot[]>> => ({ ok: true, value: slots.filter((slot) => slot.workspaceId === workspaceId) }),
      listActiveHoldsForWindow: async (workspaceId: string): Promise<Result<SlotHold[]>> => ({ ok: true, value: holds.filter((hold) => hold.workspaceId === workspaceId) }),
    },
    propertyRepository: {
      listActiveByCustomer: async (workspaceId: string, customerId: string): Promise<Result<PropertyDTO[]>> => ({
        ok: true,
        value: properties.filter((property) => property.workspaceId === workspaceId && property.customerId === customerId),
      }),
    },
    now: () => now,
    state: { requests, quotes, holds, properties },
  };
}

async function main() {
  const deps = createInMemoryDeps();
  const commands = createServerCommandEntrypoints(deps);
  const createMeta: CommandMeta = { idempotencyKey: "create", now };

  const created = await commands.createRequestCommand(visitor, { customerId: "cust_1", propertyId: "prop_1", serviceCode: "STANDARD" }, createMeta);
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("create failed");
  assert.equal(created.value.id, "req_1");
  assert.equal(created.value.workspaceId, "ws_1");

  const updated = await commands.updateRequestCommand(visitor, created.value.id, { serviceCode: "MOVE_OUT", bedrooms: 3, bathrooms: 2 }, { idempotencyKey: "update", now, expectedVersion: 1 });
  assert.equal(updated.ok, true);
  if (!updated.ok) throw new Error("update failed");
  assert.equal(updated.value.version, 2);
  assert.equal(updated.value.bedrooms, 3);
  assert.equal(updated.value.serviceCode, "MOVE_OUT");

  const quote = await commands.calculateQuoteCommand(visitor, updated.value.id);
  assert.equal(quote.ok, true);
  if (!quote.ok) throw new Error("quote failed");
  assert.equal(quote.value.totalMinor, 34000);
  assert.equal(quote.value.status, "APPROVED");

  const sent = await commands.sendQuoteCommand(owner, quote.value.id, { idempotencyKey: "send", now, expectedVersion: 1 });
  assert.equal(sent.ok, true);
  if (!sent.ok) throw new Error("send failed");
  assert.equal(sent.value.status, "SENT");

  const slots = await commands.findSlotsCommand(visitor, { requestId: updated.value.id, from: "2026-10-05T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z" });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, "slot_1");

  const held = await commands.holdSlotCommand(owner, "slot_1", quote.value.id, { idempotencyKey: "hold", now });
  assert.equal(held.ok, true);
  if (!held.ok) throw new Error("hold failed");
  assert.deepEqual(held.value, { holdId: "hold_1", expiresAt: "2026-10-04T06:15:00.000Z" });

  const propertyRead = await commands.readPropertySnapshotCommand(owner, "cust_1");
  assert.equal(propertyRead.ok, true);
  if (!propertyRead.ok) throw new Error("property read failed");
  assert.equal(propertyRead.value.length, 1);
  assert.equal(propertyRead.value[0].accessNotes, "Key safe");

  const wrongVisitorUpdate = await commands.updateRequestCommand(wrongVisitor, created.value.id, { bedrooms: 1 }, { idempotencyKey: "wrong-visitor", now, expectedVersion: 2 });
  assert.deepEqual(wrongVisitorUpdate, { ok: false, code: "VISITOR_SCOPE_REQUIRED", message: "Visitor session cannot access this request." });

  const wrongWorkspaceQuote = await commands.calculateQuoteCommand(wrongWorkspaceOwner, updated.value.id);
  assert.deepEqual(wrongWorkspaceQuote, { ok: false, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." });

  const staleUpdate = await commands.updateRequestCommand(visitor, created.value.id, { bathrooms: 1 }, { idempotencyKey: "stale", now, expectedVersion: 1 });
  assert.deepEqual(staleUpdate, { ok: false, code: "VERSION_CONFLICT", message: "Request version changed before this command was applied." });

  const visitorProperty = await commands.readPropertySnapshotCommand(visitor, "cust_1");
  assert.deepEqual(visitorProperty, { ok: false, code: "STAFF_AUTH_REQUIRED", message: "Verified staff membership is required." });

  console.log("runtime-outage e02 server composition harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
