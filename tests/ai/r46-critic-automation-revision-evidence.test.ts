import {describe,expect,it} from "vitest";
import {reviewAutomationRevision} from "../../src/server/ai/automation-revision-review";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const draft:WorkflowRuleVersionDTO={
 id:"version-1",ruleId:"rule-1",workspaceId:"workspace-1",branchId:"branch-1",
 versionNumber:1,state:"DRAFT",eventType:"REQUEST_CREATED",conditions:[],
 actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"REVIEW_REQUEST"}],
 maxActionsPerEvent:1,createdAt:"2026-10-18T00:00:00.000Z",
};
const owned=()=>({actor:{workspaceId:"workspace-1",role:"OWNER" as const},
 workspaceId:"workspace-1",branchId:"branch-1",previous:null,draft});
describe("R46 CRITIC-01 workflow revision untrusted authority boundaries",()=>{
 it("rejects invalid Gregorian dates instead of presenting forged saved evidence",()=>{
  for(const createdAt of ["2026-02-30T00:00:00.000Z","2026-13-01T00:00:00.000Z",
    "Bearer private-token","2026-10-18T00:00:00Z"]){
    expect(reviewAutomationRevision({...owned(),draft:{...draft,createdAt}}))
      .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  }
 });
 it("rejects non-integer based-on version and poisoned published clock",()=>{
  expect(reviewAutomationRevision({...owned(),draft:{...draft,
    basedOnVersionNumber:"1" as unknown as number}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  expect(reviewAutomationRevision({...owned(),draft:{...draft,
    publishedAt:"2026-02-30T00:00:00.000Z"}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
 });
 it("does not invoke a hostile actor getter or inherit untrusted authority",()=>{
  const accessor=Object.defineProperty({workspaceId:"workspace-1"},"role",{
    enumerable:true,get(){throw Error("private actor getter executed");},
  });
  const inherited=Object.assign(Object.create({role:"OWNER"}),{workspaceId:"workspace-1"});
  for(const actor of [accessor,inherited]){
    expect(()=>reviewAutomationRevision({...owned(),actor} as never)).not.toThrow();
    expect(reviewAutomationRevision({...owned(),actor} as never))
      .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_OWNER_REQUIRED"});
  }
 });
 it("rejects extra caller authority flags and hidden root fields",()=>{
  const elevated={...owned(),permissionGranted:true};
  const hidden=Object.defineProperty(owned(),"providerSecret",{
    enumerable:false,value:"redact-this",
  });
  for(const input of [elevated,hidden]){
   expect(reviewAutomationRevision(input)).toMatchObject({
     ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  }
 });
});
