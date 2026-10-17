import {describe,expect,it} from "vitest";
import type {QualityCaseDTO,VisitDTO,AttentionItemDTO} from "../../src/contracts";
import {buildQualityCaseView} from "../../src/features/quality/view-models";

const visit={id:"visit-a",workspaceId:"tenant-a",requestId:"req-a",quoteId:"quote-a",
 status:"COMPLETED",startAt:"2026-10-18T11:00:00.000Z",serviceMinutes:60,bufferMinutes:15,version:2} as VisitDTO;
const q={id:"case-a",workspaceId:"tenant-a",visitId:"visit-a",state:"RESOLVED",
 summary:"Sensitive quality note",ownerUserId:"private-owner",feedbackScore:5,
 dueAt:"2026-10-18T16:00:00.000Z",reviewRequestState:"ELIGIBLE",version:2,
 createdAt:"2026-10-18T12:00:00.000Z",updatedAt:"2026-10-18T15:00:00.000Z"} as QualityCaseDTO;
const item=(w:string)=>({workspaceId:w,resourceId:q.id,status:"OPEN",summary:"attention"} as unknown as AttentionItemDTO);
const view=(qualityCase=q,v=visit,sourceLabel:"SERVER_SNAPSHOT"|"FIXTURE_UI_ONLY"="SERVER_SNAPSHOT")=>
 buildQualityCaseView({qualityCase,visit:v,attentionItems:[item("tenant-a"),item("tenant-b")],
  sourceLabel,actionAvailability:{enabledActions:["REQUEST_REVIEW"],acceptedActionHandlerSupplied:true}});
describe("R34 saved quality evidence integrity",()=>{
 it("shows only same-tenant unresolved attentions and verified rating",()=>{
   expect(view()).toMatchObject({sourceIntegrity:"MATCHED",relatedAttentionCount:1,
    feedbackLabel:"5/5 customer feedback",canRequestReview:true});
 });
 it("redacts mismatched saved visits and disables manual review",()=>{
   for(const v of [{...visit,workspaceId:"tenant-b"},{...visit,id:"other"}]){
     const r=view(q,v);
     expect(r).toMatchObject({sourceIntegrity:"MISMATCH",relatedAttentionCount:0,
       issueSummary:"Quality evidence unavailable",ownerLabel:"Unverified",
       canRequestReview:false,actionAvailability:{enabledActions:[],acceptedActionHandlerSupplied:false}});
     expect(JSON.stringify(r)).not.toMatch(/Sensitive quality note|private-owner/);
   }
 });
 it("rejects invalid numeric feedback, never inventing customer score",()=>{
   for(const score of [NaN,Infinity,-1,0,6,2.5]){
     expect(view({...q,feedbackScore:score}).feedbackLabel).toBe("Feedback not verified");
   }
 });
 it("never represents fixture-only previews as eligible review requests",()=>{
   expect(view(q,visit,"FIXTURE_UI_ONLY")).toMatchObject({
     canRequestReview:false,sourceIntegrity:"MATCHED",dataSource:"FIXTURE_UI_ONLY",
     reviewRequestLabel:"Fixture preview — customer review request unavailable"});
 });
});
