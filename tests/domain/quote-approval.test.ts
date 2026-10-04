import { describe, expect, it } from "vitest";
import { approveQuote, isApprovalCurrent } from "../../src/domain/approval";
import { createQuoteSnapshot, defaultRateCard } from "../../src/domain/quote";

const now = "2026-10-04T06:00:00.000Z";

describe("quote catalog and approval domain", () => {
  it("creates the exact approved move-out fixture snapshot", () => {
    const quote = createQuoteSnapshot({
      id: "quote_1",
      workspaceId: "ws_1",
      requestId: "req_1",
      serviceCode: "MOVE_OUT",
      bedrooms: 3,
      bathrooms: 2,
      oven: true,
      now,
    }, defaultRateCard);

    expect(quote).toMatchObject({
      workspaceId: "ws_1",
      requestId: "req_1",
      version: 1,
      status: "APPROVED",
      currency: "USD",
      subtotalMinor: 34_000,
      taxMinor: 0,
      totalMinor: 34_000,
      depositMinor: 8_500,
      balanceMinor: 25_500,
      durationMinutes: 240,
      bufferMinutes: 30,
      rateVersion: "synthetic-cleaning-v1",
    });
    expect(quote.validUntil).toBe("2026-10-06T06:00:00.000Z");
  });

  it("supports studio-style standard jobs before booking is enabled", () => {
    const quote = createQuoteSnapshot({
      id: "quote_studio",
      workspaceId: "ws_1",
      requestId: "req_studio",
      serviceCode: "STANDARD",
      bedrooms: 0,
      bathrooms: 1,
      now,
    }, defaultRateCard);

    expect(quote).toMatchObject({ totalMinor: 11_500, depositMinor: 2_875, balanceMinor: 8_625 });
    expect(quote.durationMinutes).toBeGreaterThan(0);
  });

  it("rejects out-of-policy room counts", () => {
    expect(() => createQuoteSnapshot({
      id: "quote_large",
      workspaceId: "ws_1",
      requestId: "req_large",
      serviceCode: "DEEP",
      bedrooms: 11,
      bathrooms: 1,
      now,
    }, defaultRateCard)).toThrow(RangeError);
  });

  it("keeps sent quote snapshots unchanged after rate card changes", () => {
    const sent = createQuoteSnapshot({
      id: "quote_old",
      workspaceId: "ws_1",
      requestId: "req_1",
      serviceCode: "STANDARD",
      bedrooms: 2,
      bathrooms: 1,
      now,
    }, defaultRateCard);

    const changedRateCard = {
      ...defaultRateCard,
      version: "synthetic-cleaning-v2",
      standard: { ...defaultRateCard.standard, baseMinor: 12_000 },
    };

    const future = createQuoteSnapshot({
      id: "quote_new",
      workspaceId: "ws_1",
      requestId: "req_1",
      serviceCode: "STANDARD",
      bedrooms: 2,
      bathrooms: 1,
      now,
    }, changedRateCard);

    expect(sent.rateVersion).toBe("synthetic-cleaning-v1");
    expect(sent.totalMinor).toBe(15_500);
    expect(future.rateVersion).toBe("synthetic-cleaning-v2");
    expect(future.totalMinor).toBe(17_500);
  });

  it("invalidates a previous approval when quote version changes", () => {
    const approval = approveQuote({ quoteId: "quote_1", quoteVersion: 1, approverUserId: "owner_1", now });

    expect(isApprovalCurrent(approval, { id: "quote_1", version: 1 })).toBe(true);
    expect(isApprovalCurrent(approval, { id: "quote_1", version: 2 })).toBe(false);
  });
});
