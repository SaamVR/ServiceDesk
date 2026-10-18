import {describe,expect,it} from "vitest";
import {prepareDispatchAiReview,type DispatchAiReviewInput} from "../../src/server/ai/dispatch-review";
const workspaceId="workspace-1",actor={workspaceId,role:"OWNER" as const};
const visit={id:"visit-1",workspaceId,requestId:"request-1",quoteId:"quote-1",
 status:"CONFIRMED" as const,startAt:"2026-10-19T10:00:00.000Z",
 serviceMinutes:90,bufferMinutes:30,version:1,serviceCode:"STANDARD"};
const crew={id:"crew-1",workspaceId,active:true,
 availableFrom:"2026-10-19T09:00:00.000Z",availableTo:"2026-10-19T15:00:00.000Z",
 serviceCodes:["STANDARD"]};
const attention={id:"attention-1",workspaceId,type:"WORKFLOW_RULE",
 severity:"WARNING",status:"OPEN",resourceType:"visit",resourceId:"visit-1",
 summary:"Owner review before dispatch"};
const source=():DispatchAiReviewInput=>({actor,workspaceId,snapshot:{visits:[visit],crews:[crew],
 attentionItems:[attention as any]}});
describe("SONIC R42 L06 dispatch evidence completeness",()=>{
 it("suggests a candidate but never confirms crew assignment or customer contact",()=>{
  expect(prepareDispatchAiReview(source())).toMatchObject({ok:true,value:{
   withVerifiedFit:1,needingManualReview:0,proposals:[{visitId:"visit-1",
    verifiedCrewId:"crew-1",crewAssigned:false,customerNotified:false,
    ownerOrDispatcherApprovalRequired:true,availabilityConfirmed:false}] }});
 });
 it("refuses incomplete, cross-tenant, duplicate and poisoned attention rows",()=>{
  for(const attentionItems of [
   [{...attention,workspaceId:"foreign"}],
   [{...attention,resourceId:"visit-1",id:"attention-1"},attention],
   [{...attention,severity:"MAX"}],
   [{...attention,status:"STOLEN"}],
   [{...attention,summary:{private:"secret"}}],
   [Object.assign(Object.create({payload:"private"}),attention)],
  ]){
   expect(prepareDispatchAiReview({...source(),snapshot:{...source().snapshot,attentionItems:attentionItems as any}}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"});
  }
 });
 it("refuses forged visit and crew row prototypes and unsupported service codes",()=>{
  for(const patch of [
   {visits:[{...visit,serviceCode:"\u202eINJECTED"}]},
   {visits:[Object.assign(Object.create({notes:"private"}),visit)]},
   {crews:[Object.assign(Object.create({token:"hidden"}),crew)]},
   {crews:[{...crew,active:"true"}]},
  ]){
   expect(prepareDispatchAiReview({...source(),snapshot:{...source().snapshot,...patch} as any}))
    .toMatchObject({ok:false,code:"DISPATCH_REVIEW_SOURCE_UNVERIFIED"});
  }
 });
 it("denies actor tenant drift and disallowed staff roles",()=>{
   expect(prepareDispatchAiReview({...source(),actor:{...actor,role:"CREW"}}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_ROLE_REQUIRED"});
   expect(prepareDispatchAiReview({...source(),actor:{...actor,workspaceId:"foreign"}}))
     .toMatchObject({ok:false,code:"DISPATCH_REVIEW_ROLE_REQUIRED"});
 });
});
