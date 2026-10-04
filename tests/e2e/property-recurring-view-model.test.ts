import { describe, expect, it } from "vitest";
import { buildPropertyRecurringView } from "../../src/features/properties/view-models";
import {
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
} from "../../src/features/operations/sample-data";

describe("property and recurrence portal model", () => {
  it("keeps property and recurring visit data fixture-only until shared DTOs exist", () => {
    const view = buildPropertyRecurringView({
      request: sampleRequest,
      quote: sampleQuote,
      slot: sampleSlot,
      visit: sampleVisit,
      invoice: sampleInvoice,
    });

    expect(view.propertyLabel).toContain("Move-out clean property");
    expect(view.fixtureBoundary).toBe("PROPERTY_AND_RECURRENCE_FIXTURE_ONLY");
    expect(view.recurringCandidate.frequencyLabel).toBe("Monthly maintenance candidate");
    expect(view.recurringCandidate.canAutoSchedule).toBe(false);
    expect(view.recurringCandidate.blocker).toContain("RecurringVisitDTO");
    expect(view.history.some((entry) => entry.kind === "invoice")).toBe(true);
  });

  it("uses the frozen pricing and slot facts as read-only context", () => {
    const view = buildPropertyRecurringView({
      request: sampleRequest,
      quote: sampleQuote,
      slot: sampleSlot,
      visit: sampleVisit,
      invoice: sampleInvoice,
    });

    expect(view.currentVisit).toEqual({
      startLabel: "2026-10-09T09:00:00.000Z",
      crewLabel: "crew_alpha",
      durationLabel: "240m service + 30m buffer",
      quoteLabel: "$340.00 total · $85.00 deposit",
    });
  });
});
