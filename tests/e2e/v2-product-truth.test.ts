import { describe, expect, it } from "vitest";
import {
  buildUpcomingVisits,
  summarizeOutstandingInvoices,
} from "../../src/features/operations/product-truth";

describe("V2 product truth helpers", () => {
  it("orders future visits chronologically and selects the nearest one first", () => {
    const visits = [
      { id: "later", startAt: "2026-10-08T09:00:00.000Z" },
      { id: "past", startAt: "2026-10-04T09:00:00.000Z" },
      { id: "nearest", startAt: "2026-10-05T10:00:00.000Z" },
      { id: "same-time-b", startAt: "2026-10-06T09:00:00.000Z" },
      { id: "same-time-a", startAt: "2026-10-06T09:00:00.000Z" },
    ];

    const upcoming = buildUpcomingVisits(visits, "2026-10-05T08:00:00.000Z");

    expect(upcoming.map((visit) => visit.id)).toEqual([
      "nearest",
      "same-time-a",
      "same-time-b",
      "later",
    ]);
    expect(visits[0]?.id).toBe("later");
  });

  it("sums outstanding balances only when every open invoice shares one currency", () => {
    const summary = summarizeOutstandingInvoices([
      { status: "OPEN", currency: "USD", balanceMinor: 1200 },
      { status: "PARTIALLY_PAID", currency: "USD", balanceMinor: 800 },
      { status: "VOID", currency: "EUR", balanceMinor: 9999 },
    ]);

    expect(summary).toEqual({
      count: 2,
      currency: "USD",
      totalMinor: 2000,
      multipleCurrencies: false,
    });
  });

  it("never presents a cross-currency balance as one monetary total", () => {
    const summary = summarizeOutstandingInvoices([
      { status: "OPEN", currency: "USD", balanceMinor: 1200 },
      { status: "OPEN", currency: "EUR", balanceMinor: 900 },
    ]);

    expect(summary.count).toBe(2);
    expect(summary.multipleCurrencies).toBe(true);
    expect(summary.currency).toBeUndefined();
    expect(summary.totalMinor).toBeUndefined();
  });
});
