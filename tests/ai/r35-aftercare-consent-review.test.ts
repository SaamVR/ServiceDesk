import {describe,expect,it} from "vitest";
import {planConsentAwareAftercare} from "../../src/server/ai/aftercare-review";
import type {VisitDTO} from "../../src/contracts";
const workspaceId="workspace-a",visitId="visit-a";
const visit:VisitDTO={
 id:visitId,workspaceId,requestId:"request-a",quoteId:"quote-a",
 status:"COMPLETED",startAt:"2026-10-16T10:00:00.000Z",
 serviceMinutes:60,bufferMinutes:15,version:3,
};
const completion={
 workspaceId,visitId,visitVersion:3,eventId:"event-a",
 completedAt:"2026-10-17T10:00:00.000Z",
 source:"PERSISTED_VISIT_COMPLETION_JOURNAL" as const,
};
const recipient={recipientRef:"recipient-a",consentRequired:true,hasOptIn:true, optedOut:false,quietHoursBlocked:false};
const input=()=>({workspaceId,actor:{workspaceId,role:"OWNER" as const},
 visit,completion,recipient,now:"2026-10-18T11:00:00.000Z"});
describe("SONIC L20 committed service follow-up review",()=>{
 it("proposes a draft-only aftercare review with explicit opt-in and committed visit event",()=>{
  expect(planConsentAwareAftercare(input())).toMatchObject({ok:true,value:{
   eligibleForManualReview:true,reason:"READY_TO_REVIEW",
   state:"AFTERCARE_OWNER_APPROVAL_REQUIRED",automatedSend:false,
   customerContactSent:false,providerDeliveryVerified:false,draftOnly:true,
  }});
 });
 it("suppresses opt-out, quiet-hours, missing opt-in and incomplete service",()=>{
  for(const [overrides,reason] of [
   [{recipient:{...recipient,optedOut:true}},"OPTED_OUT"],
   [{recipient:{...recipient,hasOptIn:false}},"CONSENT_REQUIRED"],
   [{recipient:{...recipient,quietHoursBlocked:true}},"QUIET_HOURS"],
   [{visit:{...visit,status:"PENDING_REVIEW"}},"NOT_COMPLETED"],
  ] as const){
   const result=planConsentAwareAftercare({...input(),...overrides} as typeof input);
   expect(result).toMatchObject({ok:true,value:{eligibleForManualReview:false,reason,automatedSend:false}});
  }
 });
 it("denies stale/synthetic source identity, other tenant and wrong visit version",()=>{
  for(const patch of [
    {completion:{...completion,source:"MODEL_GUESS"}},
    {completion:{...completion,visitVersion:2}},
    {completion:{...completion,workspaceId:"other"}},
    {completion:{...completion,completedAt:"2026-02-30T10:00:00.000Z"}},
    {completion:{...completion,completedAt:"2026-10-19T10:00:00.000Z"}},
  ])expect(planConsentAwareAftercare({...input(),...patch} as never))
    .toMatchObject({ok:false,code:"AFTERCARE_SOURCE_INVALID"});
 });
 it("suppresses obsolete completion receipts without sending",()=>{
  const result=planConsentAwareAftercare({...input(),now:"2027-01-18T11:00:00.000Z"});
  expect(result).toMatchObject({ok:true,value:{eligibleForManualReview:false,reason:"TOO_OLD"}});
  expect(JSON.stringify(result)).not.toContain("recipient-a");
 });
 it("cannot be activated by a non-owner or other workspace",()=>{
  expect(planConsentAwareAftercare({...input(),actor:{workspaceId,role:"DISPATCHER"}}))
    .toMatchObject({ok:false,code:"AFTERCARE_OWNER_REQUIRED"});
  expect(planConsentAwareAftercare({...input(),actor:{workspaceId:"other",role:"OWNER"}}))
    .toMatchObject({ok:false,code:"AFTERCARE_OWNER_REQUIRED"});
 });
});
