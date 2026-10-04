import { describe, expect, it } from "vitest";
import { buildQuoteAcceptanceAvailability } from "@/features/quotes/server-boundary";
import { buildSandboxCheckoutAvailability } from "@/features/checkout/sandbox-checkout-boundary";

describe("E10B customer quote to sandbox checkout boundary", () => {
  const quote = { id: "q1", workspaceId: "w1", requestId: "r1", version: 3, status: "SENT", currency: "USD", subtotalMinor: 10000, taxMinor: 0, totalMinor: 10000, depositMinor: 2500, balanceMinor: 7500, durationMinutes: 120, bufferMinutes: 30, rateVersion: "v1", validUntil: "2026-10-10T00:00:00.000Z" } as const;
  it("enables quote acceptance only when an accepted handler is injected", () => {
    expect(buildQuoteAcceptanceAvailability(quote, false).enabled).toBe(false);
    expect(buildQuoteAcceptanceAvailability(quote, true).enabled).toBe(true);
  });
  it("enables checkout only after accepted quote and valid hold", () => {
    const accepted = { ...quote, status: "ACCEPTED" as const };
    expect(buildSandboxCheckoutAvailability({ quote: accepted, handlerInjected: true, now: "2026-10-04T00:00:00.000Z" }).enabled).toBe(false);
    expect(buildSandboxCheckoutAvailability({ quote: accepted, heldSlot: { slot: { id: "s1", workspaceId: "w1", crewId: "c1", startAt: "2026-10-06T10:00:00.000Z", endAt: "2026-10-06T12:30:00.000Z", serviceMinutes: 120, bufferMinutes: 30, availabilityFresh: true }, holdId: "h1", expiresAt: "2026-10-04T01:00:00.000Z", quoteId: "q1", expectedQuoteVersion: 3 }, handlerInjected: true, now: "2026-10-04T00:00:00.000Z" }).enabled).toBe(true);
  });
});
