import { describe, expect, it } from "vitest";
import type { QuoteSnapshot } from "../../src/domain/quote";
import type { RequestRecord, RequestRepository } from "../../src/server/core/requests";
import { createQuoteFacadeMethods } from "../../src/server/core/quote-facade";

const now = "2026-10-04T06:00:00.000Z";
const staff = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" as const };
const request = {
  id: "req_1",
  workspaceId: "ws_1",
  customerId: "cust_1",
  propertyId: "prop_1",
  serviceCode: "MOVE_OUT",
  status: "READY" as const,
  bedrooms: 3,
  bathrooms: 2,
  version: 1,
  createdAt: now,
  updatedAt: now,
} satisfies RequestRecord;

function createRequestRepo(found: RequestRecord | undefined): RequestRepository {
  return {
    insert: async (record) => ({ ok: true, value: record }),
    findById: async () => found ? { ok: true, value: found } : { ok: false, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." },
    update: async (record) => ({ ok: true, value: record }),
  };
}

function createQuoteRepo() {
  const saved: QuoteSnapshot[] = [];
  const statusUpdates: string[] = [];
  return {
    saved,
    statusUpdates,
    repo: {
      nextQuoteId: () => `quote_${saved.length + 1}`,
      findById: async (quoteId: string) => saved.find((quote) => quote.id === quoteId),
      findLatestByRequest: async (requestId: string) => saved.filter((quote) => quote.requestId === requestId).at(-1),
      saveQuote: async (quote: QuoteSnapshot) => { saved.push(quote); },
      supersedeQuote: async (quoteId: string) => {
        const quote = saved.find((item) => item.id === quoteId);
        if (quote) quote.status = "SUPERSEDED";
      },
      updateQuoteStatus: async (quoteId: string, status: QuoteSnapshot["status"]) => { statusUpdates.push(`${quoteId}:${status}`); },
    },
  };
}

describe("quote facade methods", () => {
  it("calculates a facade QuoteDTO from a tenant-scoped request", async () => {
    const quotes = createQuoteRepo();
    const facade = createQuoteFacadeMethods({
      requestRepository: createRequestRepo(request),
      quoteRepository: quotes.repo,
      now: () => now,
    });

    await expect(facade.calculateQuote(staff, "req_1")).resolves.toMatchObject({
      ok: true,
      value: {
        id: "quote_1",
        workspaceId: "ws_1",
        requestId: "req_1",
        totalMinor: 34_000,
        depositMinor: 8_500,
        balanceMinor: 25_500,
        durationMinutes: 240,
        bufferMinutes: 30,
        status: "APPROVED",
      },
    });
  });

  it("denies a repository result from another workspace", async () => {
    const quotes = createQuoteRepo();
    const facade = createQuoteFacadeMethods({
      requestRepository: createRequestRepo(request),
      quoteRepository: quotes.repo,
      now: () => now,
    });

    await expect(facade.calculateQuote({ workspaceId: "ws_2", userId: "owner_2", role: "OWNER" }, "req_1")).resolves.toEqual({
      ok: false,
      code: "WORKSPACE_MISMATCH",
      message: "Actor is not scoped to this workspace.",
    });
  });

  it("sends an exact approved quote id with expected-version guard", async () => {
    const quotes = createQuoteRepo();
    const facade = createQuoteFacadeMethods({
      requestRepository: createRequestRepo(request),
      quoteRepository: quotes.repo,
      now: () => now,
    });

    const calculated = await facade.calculateQuote(staff, "req_1");
    if (!calculated.ok) throw new Error("quote fixture was not calculated");

    await expect(facade.sendQuote(staff, calculated.value.id, { idempotencyKey: "send-1", now, expectedVersion: 2 })).resolves.toEqual({
      ok: false,
      code: "VERSION_CONFLICT",
      message: "Quote version changed before send.",
    });
    await expect(facade.sendQuote(staff, calculated.value.id, { idempotencyKey: "send-2", now, expectedVersion: 1 })).resolves.toMatchObject({
      ok: true,
      value: { id: calculated.value.id, status: "SENT" },
    });
    expect(quotes.statusUpdates).toEqual(["quote_1:SENT"]);
  });
});
