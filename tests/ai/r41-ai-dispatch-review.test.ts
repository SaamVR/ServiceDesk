import {describe,expect,it} from "vitest";
import {prepareDispatchAiReview} from "../../src/server/ai/dispatch-review";
import type {DispatchSnapshot} from "../../src/features/dispatch/recommendations";
const workspaceId="workspace-1";
const actor={workspaceId,role:"DISPATCHER" as const};
const build=():DispatchSnapshot=>({
 visits:[{
   id:"visit-1",workspaceId,requestId:"request-1",quoteId:"quote-1",
   status:"CONFIRMED",startAt:"2026-10-18T09:00:00Z",serviceMinutes:60,
   bufferMinutes:15,version:3,serviceCode:"STANDARD",
 }],
 crews:[{
   id:"crew-1",workspaceId,active:true,
   availableFrom:"2026-10-18T08:00:00Z",
   availableTo:"2026-10-18T12:00:00Z",
   serviceCodes:["STANDARD"],
 }],
});
describe("R41 AI-D saved scope dispatch assistance (no autonomous assignments)",()=>{
 it("recommends a real high-confidence saved crew candidate while refusing to confirm the booking",()=>{
   const result=prepareDispatchAiReview({actor,workspaceId,snapshot:build()});
   expect(result).toMatchObject({ok:true,value:{
     unassignedVisits:1,withVerifiedFit:1,needingManualReview:0,
     modelInvoked:false,businessStateMutated:false,
     proposals:[{visitId:"visit-1",visitVersion:3,verifiedCrewId:"crew-1",
       confidence:"HIGH",ownerOrDispatcherApprovalRequired:true,
       availabilityConfirmed:false,crewAssigned:false,customerNotified:false,
       routeEfficiency:"NOT_SCORED_NO_GEOGRAPHY"}],
   }});
 });
 it("does not upgrade uncertain staff skills or incomplete availability to a confirmed candidate",()=>{
   const snapshot=build();
   snapshot.crews[0].serviceCodes=undefined;
   snapshot.crews[0].availableFrom=undefined;
   snapshot.crews[0].availableTo=undefined;
   expect(prepareDispatchAiReview({actor,workspaceId,snapshot}))
     .toMatchObject({ok:true,value:{withVerifiedFit:0,needingManualReview:1,
       proposals:[{eligibleCrewCount:0,confidence:"NONE",crewAssigned:false}]}});
 });
 it("rejects overlapping assigned crew and clearly reports inability to confirm a fit",()=>{
   const snapshot=build();
   snapshot.visits.push({...snapshot.visits[0],id:"visit-2",crewId:"crew-1"});
   expect(prepareDispatchAiReview({actor,workspaceId,snapshot}))
     .toMatchObject({ok:true,value:{withVerifiedFit:0,needingManualReview:1,
       proposals:[{blockedReasonCodes:["SCHEDULE_OVERLAP"],confidence:"NONE"}]}});
 });
 it("fails closed on cross-tenant/invalid saved sources and role escalation",()=>{
   expect(prepareDispatchAiReview({actor:{...actor,role:"CUSTOMER"},workspaceId,snapshot:build()}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_ROLE_REQUIRED"});
   const foreign=build(); foreign.crews[0].workspaceId="workspace-other";
   expect(prepareDispatchAiReview({actor,workspaceId,snapshot:foreign}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"});
   const clock=build(); clock.visits[0].startAt="2026-02-30T09:00:00Z";
   expect(prepareDispatchAiReview({actor,workspaceId,snapshot:clock}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"});
   const incomplete=build();incomplete.crews=Array(80).fill(incomplete.crews[0]);
   expect(prepareDispatchAiReview({actor,workspaceId,snapshot:incomplete}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"});
 });
});
