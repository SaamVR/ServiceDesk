import {describe,expect,it} from "vitest";
import {buildOwnerAftercareBatch,type AftercareBatchInput} from "../../src/server/ai/aftercare-batch-planner";
const workspaceId="workspace-1",now="2026-10-18T03:00:00.000Z";
const actor={workspaceId,role:"OWNER" as const};
const mk=(i:number)=>({
 visit:{id:"visit-"+i,workspaceId,requestId:"request-"+i,quoteId:"quote-"+i,
  version:1,status:"COMPLETED" as const,
  startAt:"2026-10-17T01:00:00.000Z",serviceMinutes:90,bufferMinutes:10},
 completion:{workspaceId,visitId:"visit-"+i,visitVersion:1,
  eventId:"event-"+i,completedAt:"2026-10-17T02:00:00.000Z",
  source:"PERSISTED_VISIT_COMPLETION_JOURNAL" as const},
 recipient:{recipientRef:"recipient-"+i,consentRequired:true,hasOptIn:true,optedOut:false,
  quietHoursBlocked:false},
});
const input=()=>({workspaceId,actor,now,entries:[mk(1)]});
describe("SONIC R36 C12 source-verified aftercare triage",()=>{
 it("creates clear owner review summary but never sends customer contact",()=>{
  const result=buildOwnerAftercareBatch(input());
  expect(result).toMatchObject({ok:true,value:{
   reviewSuggested:true,oldestReadyAt:"2026-10-17T02:00:00.000Z",
   readyCount:1,anyProviderMessageSent:false,anyPaymentChanged:false
  }});
 });
 it("empty verified batch is truly empty, not invented contact or review",()=>{
  expect(buildOwnerAftercareBatch({...input(),entries:[]})).toMatchObject({
   ok:true,value:{reviewSuggested:false,readyCount:0,inspectedCount:0},
  });
 });
 it("rejects false empty queue if source timestamp is impossible or lacks timezone",()=>{
  for(const bad of ["2026-02-30T03:00:00.000Z","2026-10-18",
    "2026-10-18T03:00:00","2026-10-18T03:00:00+06:00"]){
   expect(buildOwnerAftercareBatch({...input(),entries:[],now:bad}))
    .toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
  }
 });
 it("denies sparse and accessor source arrays before reading any customer rows",()=>{
  const getter=Array(1);
  Object.defineProperty(getter,0,{enumerable:true,get(){throw Error("unsafe saved accessor");}});
  for(const entries of [getter,Array(1)]){
   expect(()=>buildOwnerAftercareBatch({...input(),entries} as AftercareBatchInput)).not.toThrow();
   expect(buildOwnerAftercareBatch({...input(),entries} as AftercareBatchInput))
     .toMatchObject({ok:false,code:"AFTERCARE_BATCH_SOURCE_INVALID"});
  }
 });
});
