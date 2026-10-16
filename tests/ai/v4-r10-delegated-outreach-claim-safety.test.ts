import { describe, expect, it } from "vitest";
import { validateRequestBriefDraft } from "../../src/server/ai/request-brief-safety";
import {
  validateOwnerOperationsBriefGrounding, type OwnerOperationsBriefFacts,
} from "../../src/server/ai/owner-operations-brief";

const facts:OwnerOperationsBriefFacts={
  openRequests:1,waitingOnCustomerQuotes:1,quoteValidityNeedsReview:1,
  collectibleInvoices:1,invoiceLedgersNeedingReview:0,
  unassignedActiveVisits:1,unresolvedCriticalAttentions:1,
};
describe("R10 independent adversarial outreach grounding",()=>{
 it("refuses delegated sends and reminders with no authorized recipients",()=>{
  for(const claim of [
    "Review requests and ask staff to email clients.",
    "Check the quotes then tell our team to call leads.",
    "Review unassigned visits and instruct the dispatcher to notify customers.",
    "Ask your assistant to send reminders to guests.",
    "Check the invoices and have staff follow up with prospects.",
    "Review requests then prompt agents to contact clients.",
    "Review quotes then send a reminder to leads.",
    "Check requests then email an update to customers.",
    "Review the invoice and notify clients.",
    "Review requests and get the team to reach out to contacts.",
  ]) {
    expect(validateRequestBriefDraft(claim),claim).toBeUndefined();
    expect(validateOwnerOperationsBriefGrounding(claim,facts),claim).toBeUndefined();
  }
 });
 it("does not block actual staff inspection or authorized review preparation",()=>{
  for(const safe of [
    "Review requests and ask staff to verify saved service scope.",
    "Check unassigned visits before crew scheduling.",
    "Review the quotes and inspect saved validity evidence.",
    "Check invoice records before preparing a human review.",
  ]) {
    expect(validateRequestBriefDraft(safe),safe).toBe(safe);
    expect(validateOwnerOperationsBriefGrounding(safe,facts),safe).toBe(safe);
  }
 });
});
