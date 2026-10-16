import { describe, expect, it } from "vitest";
import { validateOwnerOperationsBriefGrounding, type OwnerOperationsBriefFacts } from "../../src/server/ai/owner-operations-brief";

const onlyVisits: OwnerOperationsBriefFacts = {
  openRequests: 0,
  waitingOnCustomerQuotes: 0,
  quoteValidityNeedsReview: 0,
  collectibleInvoices: 0,
  invoiceLedgersNeedingReview: 0,
  unassignedActiveVisits: 2,
  unresolvedCriticalAttentions: 0,
};

describe("V4 independent queue-mention grounding regressions", () => {
  it("does not let a positive visit count authorize advice for empty queues", () => {
    for (const claim of [
      "Review the invoices.",
      "Check quotes next.",
      "Inspect the request queue.",
      "Prioritize attention items.",
      "Review unassigned visits and invoices.",
      "Check the invoice ledger after inspecting visits.",
    ]) {
      expect(validateOwnerOperationsBriefGrounding(claim, onlyVisits), claim).toBeUndefined();
    }
  });

  it("rejects categories absent from the saved owner operations fact schema", () => {
    for (const claim of [
      "Review payment transactions.",
      "Inspect refunds.",
      "Check bookings.",
      "Review customer messages.",
      "Inspect revenue before making changes.",
      "Check capacity for tomorrow.",
    ]) {
      expect(validateOwnerOperationsBriefGrounding(claim, onlyVisits), claim).toBeUndefined();
    }
  });

  it("blocks unverified customer outreach disguised as an owner recommendation", () => {
    for (const claim of [
      "Review unassigned visits and contact customers.",
      "Check visits before calling customers.",
      "Review unassigned visits, then email the customers.",
    ]) {
      expect(validateOwnerOperationsBriefGrounding(claim, onlyVisits), claim).toBeUndefined();
    }
  });

  it("preserves grounded inspection advice and honest generic fallback", () => {
    expect(validateOwnerOperationsBriefGrounding(
      "Review unassigned visits before assigning staff.", onlyVisits,
    )).toBe("Review unassigned visits before assigning staff.");
    expect(validateOwnerOperationsBriefGrounding(
      "Check the authoritative workspace queues before making changes.", onlyVisits,
    )).toBe("Check the authoritative workspace queues before making changes.");
  });
});
