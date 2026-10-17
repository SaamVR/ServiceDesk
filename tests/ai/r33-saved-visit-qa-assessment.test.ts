import {describe,expect,it} from "vitest";
import {assessSavedVisitQuality} from "../../src/server/ai/visit-qa-assessment";
import type {VisitDTO,VisitEvidenceDTO,VisitChecklistItemDTO} from "../../src/contracts";
const workspaceId="workspace-1",visitId="visit-1";
const actor={workspaceId,role:"OWNER" as const};
const visit={
 id:visitId,workspaceId,requestId:"request-1",quoteId:"quote-1",
 status:"PENDING_REVIEW" as const,startAt:"2026-10-18T08:00:00Z",
 serviceMinutes:120,bufferMinutes:30,version:2,
} satisfies VisitDTO;
const evidence=(id:string,kind:VisitEvidenceDTO["kind"]):VisitEvidenceDTO=>({
 id,workspaceId,visitId,kind,
 ...(kind.endsWith("PHOTO") ? {mediaReference:{storageProvider:"trusted-storage",objectRef:"private-object-key"}} : {}),
 capturedAt:"2026-10-18T10:00:00Z",submittedByUserId:"crew-1",
 createdAt:"2026-10-18T10:00:00Z",
});
const checklist=(id:string,completed:boolean):VisitChecklistItemDTO=>({
 id,workspaceId,visitId,itemKey:id,completed,
 updatedByUserId:"crew-1",updatedAt:"2026-10-18T10:00:00Z",version:1,
});
const input=()=>({actor,workspaceId,visit,evidence:[
 evidence("evidence-a","BEFORE_PHOTO"),evidence("evidence-b","AFTER_PHOTO"),
],checklist:[checklist("step-1",true)]});
describe("SONIC R33 L07 actual saved visit QA evidence plan",()=>{
 it("never auto-approves even with complete evidence and checklist",()=>{
   const r=assessSavedVisitQuality(input());
   expect(r).toMatchObject({ok:true,value:{
     state:"HUMAN_QA_REVIEW_REQUIRED",findings:[],beforeEvidenceCount:1,
     afterEvidenceCount:1,checklistCount:1,completedChecklistCount:1,
     approved:false,automatedCompletion:false,
   }});
 });
 it("produces truthful missing evidence, incomplete tasks and incident review flags",()=>{
   const r=assessSavedVisitQuality({...input(),evidence:[evidence("issue-1","INCIDENT_NOTE")],
     checklist:[checklist("step-1",false)]});
   expect(r).toMatchObject({ok:true,value:{findings:[
     "BEFORE_PHOTO_EVIDENCE_MISSING","AFTER_PHOTO_EVIDENCE_MISSING",
     "CHECKLIST_INCOMPLETE","INCIDENT_REQUIRES_OWNER_REVIEW"
   ],incidentEvidenceCount:1}});
   expect(assessSavedVisitQuality({...input(),checklist:[]}))
     .toMatchObject({ok:true,value:{findings:["CHECKLIST_UNAVAILABLE"]}});
 });
 it("rejects cross-tenant evidence, counterfeit duplicate rows and unsafe photo references",()=>{
   for(const extra of [
     {evidence:[{...evidence("evidence-a","BEFORE_PHOTO"),workspaceId:"foreign"}]},
     {evidence:[evidence("a","AFTER_PHOTO"),evidence("a","AFTER_PHOTO")]},
     {evidence:[{...evidence("a","AFTER_PHOTO"),mediaReference:undefined}]},
     {checklist:[checklist("a",true),checklist("a",false)]},
     {checklist:[{...checklist("a",true),workspaceId:"other"}]},
   ]) expect(assessSavedVisitQuality({...input(),...extra}))
     .toMatchObject({ok:false,code:"QA_SOURCE_INVALID"});
 });
 it("critic: a whitespace-only or invalid provider photo reference is not saved quality evidence",()=>{
   for(const mediaReference of [
     {storageProvider:"trusted",objectRef:"   "},
     {storageProvider:"   ",objectRef:"some-object"},
     {storageProvider:"trusted",objectRef:"x".repeat(513)},
   ]){
     expect(assessSavedVisitQuality({...input(),evidence:[
       {...evidence("photo-1","BEFORE_PHOTO"),mediaReference},
     ]})).toMatchObject({ok:false,code:"QA_SOURCE_INVALID"});
   }
 });
 it("does not disclose crew/private media location in the public proposal",()=>{
   const r=assessSavedVisitQuality(input());
   expect(JSON.stringify(r)).not.toContain("private-object-key");
   expect(JSON.stringify(r)).not.toContain("crew-1");
 });
 it("requires owner/dispatcher and reviewable saved state",()=>{
   expect(assessSavedVisitQuality({...input(),actor:{workspaceId,role:"CREW"}}))
     .toMatchObject({ok:false,code:"QA_AUTHORITY_MISSING"});
   expect(assessSavedVisitQuality({...input(),visit:{...visit,status:"CONFIRMED"}}))
     .toMatchObject({ok:false,code:"QA_NOT_REVIEWABLE"});
   expect(assessSavedVisitQuality({...input(),actor:{workspaceId:"foreign",role:"OWNER"}}))
     .toMatchObject({ok:false,code:"QA_AUTHORITY_MISSING"});
 });
});
