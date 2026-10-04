import { describe, expect, it } from "vitest";
import type { QuoteSnapshot } from "../../src/domain/quote";
import { createPostgresQuoteRepository, mapQuoteRowToSnapshot, mapQuoteSnapshotToRow } from "../../src/server/core/quote-repository";

const quote: QuoteSnapshot = {
  id: "quote_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  version: 1,
  status: "APPROVED",
  currency: "USD",
  serviceCode: "MOVE_OUT",
  subtotalMinor: 34_000,
  taxMinor: 0,
  totalMinor: 34_000,
  depositMinor: 8_500,
  balanceMinor: 25_500,
  durationMinutes: 240,
  bufferMinutes: 30,
  rateVersion: "synthetic-cleaning-v1",
  validUntil: "2026-10-06T06:00:00.000Z",
  lineItems: [{ code: "BASE", description: "Base service", amountMinor: 18_000, durationMinutes: 120 }],
};

describe("quote persistence adapter", () => {
  it("maps quote snapshots to rows and back without losing money/version state", () => {
    const row = mapQuoteSnapshotToRow(quote);

    expect(row).toMatchObject({
      id: "quote_1",
      workspace_id: "ws_1",
      request_id: "req_1",
      version: 1,
      status: "APPROVED",
      total_minor: 34_000,
      deposit_minor: 8_500,
      balance_minor: 25_500,
      rate_version: "synthetic-cleaning-v1",
    });
    expect(mapQuoteRowToSnapshot(row)).toEqual(quote);
  });

  it("finds latest request quote by workspace and request id", async () => {
    const calls: string[] = [];
    const repo = createPostgresQuoteRepository({
      nextQuoteId: () => "quote_2",
      findLatestByRequest: async (requestId) => {
        calls.push(requestId);
        return { data: mapQuoteSnapshotToRow(quote), error: null };
      },
      saveQuote: async () => ({ data: mapQuoteSnapshotToRow(quote), error: null }),
      supersedeQuote: async () => ({ data: null, error: null }),
      updateQuoteStatus: async () => ({ data: null, error: null }),
    });

    await expect(repo.findLatestByRequest("req_1")).resolves.toEqual(quote);
    expect(calls).toEqual(["req_1"]);
  });
});
