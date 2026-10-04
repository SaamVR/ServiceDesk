import { describe, expect, it } from "vitest";
import type { QuoteSnapshot } from "../../src/domain/quote";
import { createQuoteDraftWithRepository, sendQuoteWithRepository } from "../../src/server/core/quotes";

const now = "2026-10-04T06:00:00.000Z";

describe("quote command repository seam", () => {
  it("creates versioned quote snapshots and supersedes the previous request quote", async () => {
    const saved: QuoteSnapshot[] = [];
    const superseded: string[] = [];

    const repo = {
      nextQuoteId: () => `quote_${saved.length + 1}`,
      findById: async (quoteId: string) => saved.find((quote) => quote.id === quoteId),
      findLatestByRequest: async () => saved.at(-1),
      saveQuote: async (quote: QuoteSnapshot) => { saved.push(quote); },
      supersedeQuote: async (quoteId: string) => { superseded.push(quoteId); },
      updateQuoteStatus: async () => undefined,
    };

    const first = await createQuoteDraftWithRepository(repo, {
      workspaceId: "ws_1",
      requestId: "req_1",
      serviceCode: "STANDARD",
      bedrooms: 1,
      bathrooms: 1,
      now,
    });
    const second = await createQuoteDraftWithRepository(repo, {
      workspaceId: "ws_1",
      requestId: "req_1",
      serviceCode: "STANDARD",
      bedrooms: 2,
      bathrooms: 1,
      now,
    });

    expect(first).toMatchObject({ ok: true, value: { id: "quote_1", version: 1 } });
    expect(second).toMatchObject({ ok: true, value: { id: "quote_2", version: 2 } });
    expect(superseded).toEqual(["quote_1"]);
    expect(saved.map((quote) => quote.totalMinor)).toEqual([13_500, 15_500]);
  });

  it("sends only the current approved quote version", async () => {
    const quote = {
      id: "quote_1",
      requestId: "req_1",
      workspaceId: "ws_1",
      version: 2,
      status: "APPROVED" as const,
      currency: "USD",
      serviceCode: "STANDARD" as const,
      subtotalMinor: 15_500,
      taxMinor: 0,
      totalMinor: 15_500,
      depositMinor: 3_875,
      balanceMinor: 11_625,
      durationMinutes: 115,
      bufferMinutes: 30,
      rateVersion: "synthetic-cleaning-v1",
      validUntil: "2026-10-06T06:00:00.000Z",
      lineItems: [],
    } satisfies QuoteSnapshot;

    const statusUpdates: string[] = [];
    const repo = {
      nextQuoteId: () => "quote_unused",
      findById: async () => quote,
      findLatestByRequest: async () => quote,
      saveQuote: async () => undefined,
      supersedeQuote: async () => undefined,
      updateQuoteStatus: async (quoteId: string, status: QuoteSnapshot["status"]) => { statusUpdates.push(`${quoteId}:${status}`); },
    };

    await expect(sendQuoteWithRepository(repo, "req_1", { expectedVersion: 1 })).resolves.toEqual({
      ok: false,
      code: "VERSION_CONFLICT",
      message: "Quote version changed before send.",
    });
    await expect(sendQuoteWithRepository(repo, "req_1", { expectedVersion: 2 })).resolves.toMatchObject({ ok: true, value: { status: "SENT" } });
    expect(statusUpdates).toEqual(["quote_1:SENT"]);
  });
});
