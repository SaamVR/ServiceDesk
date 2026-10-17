import { describe, expect, it } from "vitest";
import {
  validateOwnerOperationsBriefGrounding,
  type OwnerOperationsBriefFacts,
} from "../../src/server/ai/owner-operations-brief";

const facts:OwnerOperationsBriefFacts={
  openRequests:1,waitingOnCustomerQuotes:1,quoteValidityNeedsReview:1,
  collectibleInvoices:1,invoiceLedgersNeedingReview:1,
  unassignedActiveVisits:1,unresolvedCriticalAttentions:1,
};
describe("R12 owner brief unsourced relative-calendar safety",()=>{
  it("denies timing recommendations that numeric counts cannot substantiate",()=>{
    for(const claim of [
      "Review critical attention items tomorrow.",
      "Check invoices today.",
      "Review open requests tonight.",
      "Review open requests yesterday.",
      "Review expired quotes this morning.",
      "Review unassigned visits this afternoon.",
      "Review critical attention items this evening.",
      "Inspect invoice ledgers next week.",
      "Review unassigned visits next month.",
      "Check critical attention items before lunch.",
      "Review critical attention items by EOD.",
      "Inspect expired quotes by COB.",
      "Review the invoice ledger by end of day.",
      "Review open requests before close of business.",
      "Check unassigned visits within an hour.",
      "Inspect critical attention items at noon.",
      "Review invoices later this week.",
      "Review unassigned visits by Friday.",
      "Check invoices on Monday.",
      "Inspect critical attentions Wednesday.",
      "Inspect quotes tomorrow morning.",
      "Review overdue invoices before taking action.",
      "Check late requests against the saved queue.",
      "Inspect past-due visits.",
      "Review delinquent invoices.",
      "Check overdue critical attention items.",
      "Review invoices that are overdue.",
      "Check if requests are late.",
      "Inspect visits that have been delinquent.",
      "Prioritize attentions that were past-due.",
    ]) {
      expect(validateOwnerOperationsBriefGrounding(claim,facts),claim).toBeUndefined();
    }
  });
  it("preserves non-calendar source-grounded human inspection recommendations",()=>{
    for(const advice of [
      "Review the saved critical attention items.",
      "Inspect the verified invoice ledger before taking action.",
      "Review unassigned visits in the saved schedule.",
      "Check expired quotes and inspect saved validity evidence.",
      "Prioritize open requests based on verified saved queue details.",
    ]) expect(validateOwnerOperationsBriefGrounding(advice,facts),advice).toBe(advice);
  });
});
