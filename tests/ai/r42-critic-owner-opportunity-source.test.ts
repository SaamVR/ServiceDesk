import {describe,expect,it} from "vitest";
import {suggestOwnerAutomationOpportunities,type OwnerAutomationOpportunityDependencies}
 from "../../src/server/ai/owner-automation-opportunities";
import {ownerPriorityActions} from "../../src/server/ai/owner-priority-actions";
const ws="11111111-1111-4111-8111-111111111111",branch="22222222-2222-4222-8222-222222222222";
const facts={openRequests:2,waitingOnCustomerQuotes:0,quoteValidityNeedsReview:0,
 collectibleInvoices:0,invoiceLedgersNeedingReview:0,unassignedActiveVisits:0,
 unresolvedCriticalAttentions:1};
const owner={workspaceId:ws,role:"OWNER",userId:"owner-a"};
function deps(mode:"forged-count"|"failed-branch"|"valid"):OwnerAutomationOpportunityDependencies {
 return {
  resolveActor:async()=>({ok:true,value:{workspace:{id:ws,slug:"qa-cleaning"},actor:owner,service:{}}}),
  verifyBranch:async()=>{
    if(mode==="failed-branch")throw Error("db disconnected");
    return true;
  },
  loadWorkday:async()=>({ok:true,value:{
   state:"VERIFIED_OWNER_WORKDAY_REVIEW",source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
   workspaceId:ws,facts,
   priorities:mode==="forged-count"
     ?ownerPriorityActions({...facts,unresolvedCriticalAttentions:5000},7)
     :ownerPriorityActions(facts,7),
  }}),
 } as unknown as OwnerAutomationOpportunityDependencies;
}
describe("R42 independent CRITIC L19 future automation trust-boundaries",()=>{
 it("vetoes a forged verified-priority count that disagrees with exact saved workload facts",async()=>{
  const r=await suggestOwnerAutomationOpportunities("qa-cleaning",branch,deps("forged-count"));
  expect(r).toMatchObject({ok:false,code:"OPPORTUNITY_WORKDAY_UNAVAILABLE"});
 });
 it("does not throw or publish when saved-branch recheck fails",async()=>{
  const result=await suggestOwnerAutomationOpportunities("qa-cleaning",branch,deps("failed-branch"));
  expect(result).toMatchObject({ok:false,code:"OPPORTUNITY_BRANCH_UNVERIFIED"});
 });
 it("continues to suggest review-only future rules for unmodified authenticated evidence",async()=>{
  const result=await suggestOwnerAutomationOpportunities("qa-cleaning",branch,deps("valid"));
  expect(result).toMatchObject({ok:true,value:{
   modelInvoked:false,published:false,providerMessagesSent:false,
   suggestions:[{target:"FUTURE_ATTENTION_OPENED"},{target:"FUTURE_REQUEST_CREATED"}]
  }});
 });
});
