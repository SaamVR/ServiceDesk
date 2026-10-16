import { describe, expect, it } from "vitest";
import { validateRequestBriefDraft } from "../../src/server/ai/request-brief-safety";
import { validateOwnerOperationsBriefGrounding, type OwnerOperationsBriefFacts } from "../../src/server/ai/owner-operations-brief";

const sourceCounts: OwnerOperationsBriefFacts = {
  openRequests:1,waitingOnCustomerQuotes:1,quoteValidityNeedsReview:1,
  collectibleInvoices:1,invoiceLedgersNeedingReview:0,
  unassignedActiveVisits:1,unresolvedCriticalAttentions:1,
};

describe("R10 AI source-grounded completion claims",()=>{
 it("refuses passive completed business operations without a saved command receipt",()=>{
  for(const fabricated of [
    "The quote has been approved. Review the request.",
    "The customer has accepted the quote. Check requests.",
    "Payment was received. Review the invoice.",
    "The invoice was paid. Inspect outstanding invoices.",
    "The booking is confirmed. Review the request.",
    "The appointment has been scheduled. Check visits.",
    "The email was sent. Review the quote.",
    "The refund was processed. Inspect the invoice.",
    "The deposit has been charged. Review the invoice.",
    "Customer received the quote. Check open requests.",
    "Our team have invoiced the customer. Review requests.",
  ]) {
    expect(validateRequestBriefDraft(fabricated),fabricated).toBeUndefined();
    expect(validateOwnerOperationsBriefGrounding(fabricated,sourceCounts),fabricated)
      .toBeUndefined();
  }
 });
 it("still permits human-review advice that explicitly proposes, not claims, an action",()=>{
  for(const suggestion of [
    "Review the saved request scope before discussing a quote.",
    "Check the verified invoice ledger before taking any action.",
    "Review the unassigned visits and confirm scope with an authorized staff member.",
  ]) {
    expect(validateRequestBriefDraft(suggestion),suggestion).toBe(suggestion);
    expect(validateOwnerOperationsBriefGrounding(suggestion,sourceCounts),suggestion)
      .toBe(suggestion);
  }
 });
});
