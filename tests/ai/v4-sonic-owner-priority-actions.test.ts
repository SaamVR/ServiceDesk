import {describe,expect,it} from "vitest";
import {ownerPriorityActions} from "../../src/server/ai/owner-priority-actions";

const empty={
  openRequests:0,waitingOnCustomerQuotes:0,quoteValidityNeedsReview:0,
  collectibleInvoices:0,invoiceLedgersNeedingReview:0,unassignedActiveVisits:0,
  unresolvedCriticalAttentions:0,
};
describe("SONIC AI-B saved-source owner priority cards",()=>{
  it("sorts the real exception and customer queues into bounded actionable destinations",()=>{
    const p=ownerPriorityActions({
      ...empty,openRequests:9,waitingOnCustomerQuotes:3,
      quoteValidityNeedsReview:2,collectibleInvoices:4,
      invoiceLedgersNeedingReview:1,unassignedActiveVisits:7,
      unresolvedCriticalAttentions:2,
    });
    expect(p?.map(v=>v.key)).toEqual([
      "CRITICAL_ATTENTION","LEDGER_REVIEW","QUOTE_VALIDITY",
      "UNASSIGNED_VISIT","COLLECTIBLE_INVOICE",
    ]);
    expect(p).toMatchObject([
      {module:"overview",count:2,priority:"CRITICAL",source:"VERIFIED_SAVED_QUEUE_COUNT"},
      {module:"invoices",count:1,priority:"HIGH"},
      {module:"quotes",count:2,priority:"HIGH"},
      {module:"schedule",count:7,priority:"HIGH"},
      {module:"invoices",count:4,priority:"NORMAL"},
    ]);
    for(const a of p??[]) expect(a.instruction).not.toMatch(/sent|paid|overdue|delivered|guaranteed/i);
  });
  it("never promotes zero-count categories into owner recommendations",()=>{
    expect(ownerPriorityActions(empty)).toEqual([]);
    expect(ownerPriorityActions({...empty,openRequests:3})).toMatchObject([
      {key:"OPEN_REQUEST",count:3,module:"requests",priority:"NORMAL"},
    ]);
    expect(ownerPriorityActions({...empty,waitingOnCustomerQuotes:1},7))
      .toMatchObject([{key:"WAITING_QUOTE",count:1,module:"quotes"}]);
  });
  it("fails closed on unverifiable, negative, fractional, overly large and nonnumeric counts",()=>{
    for(const n of [NaN,Infinity,-1,1.5,5001,"2",null,undefined]){
      const poisoned={...empty,unresolvedCriticalAttentions:n};
      expect(ownerPriorityActions(poisoned as typeof empty)).toBeNull();
    }
    expect(ownerPriorityActions({ ...empty,openRequests:10},0)).toBeNull();
    expect(ownerPriorityActions({...empty,openRequests:10},8)).toBeNull();
  });
  it("cannot accept missing or additional data fields pretending to be authorized queue facts",()=>{
    expect(ownerPriorityActions({openRequests:2} as typeof empty)).toBeNull();
    expect(ownerPriorityActions({...empty,customerEmail:"private@example.test"} as typeof empty))
      .toBeNull();
  });
});
