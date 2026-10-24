import {describe,expect,it} from "vitest";
import {buildOwnerAftercareBatch} from "../../src/server/ai/aftercare-batch-planner";
import type {VisitDTO} from "../../src/contracts";
const workspaceId="workspace-a",now="2026-10-24T10:00:00.000Z";
const entry=()=>{
 const visit:VisitDTO={id:"visit-1",workspaceId,requestId:"req-1",quoteId:"quote-1",
  status:"COMPLETED",startAt:"2026-10-23T08:00:00.000Z",
  serviceMinutes:90,bufferMinutes:15,version:2};
 return {visit,completion:{workspaceId,visitId:"visit-1",visitVersion:2,
  eventId:"event-1",completedAt:"2026-10-23T09:30:00.000Z",
  source:"PERSISTED_VISIT_COMPLETION_JOURNAL" as const},
  recipient:{recipientRef:"recipient-1",consentRequired:true,
   hasOptIn:true,optedOut:false,quietHoursBlocked:false}};
};
const run=(entries:ReturnType<typeof entry>[])=>buildOwnerAftercareBatch({
 workspaceId,actor:{workspaceId,role:"OWNER"},now,entries,
});
describe("R45 owner aftercare opaque/hidden source row regression",()=>{
 it("accepts exactly one visible journal-backed consent-compliant candidate",()=>{
  expect(run([entry()])).toMatchObject({ok:true,value:{
   state:"OWNER_AFTERCARE_REVIEW_QUEUE",readyCount:1,
   anyProviderMessageSent:false,anyPaymentChanged:false,
   candidates:[{visitId:"visit-1",ownerApprovalRequired:true,customerContactSent:false}],
  }});
 });
 it("rejects hidden saved rows that JSON serialization would omit",()=>{
  const entries=[entry()];
  Object.defineProperty(entries,"0",{value:entry(),enumerable:false,configurable:true});
  expect(run(entries)).toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
 });
 it("rejects sparse or extra own array metadata",()=>{
  const entries=[entry(),entry()];delete (entries as Array<typeof entries[number]|undefined>)[1];
  expect(run(entries as ReturnType<typeof entry>[]))
    .toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
  const extra=Object.assign([entry()],{autoSend:true});
  expect(run(extra)).toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
 });
});
