import {describe,expect,it} from "vitest";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";
import {inspectOwnerAutomationPortfolio} from "../../src/server/ai/automation-portfolio-conflicts";
const scope={workspaceId:"workspace-1",branchId:"branch-1",actorWorkspaceId:"workspace-1",role:"OWNER" as const};
const inp=(drafts:any[])=>({actor:{workspaceId:scope.workspaceId,role:"OWNER"},workspaceId:scope.workspaceId,branchId:scope.branchId,drafts});
const draft=(type:"REQUEST_CREATED"|"QUOTE_ACCEPTED"|"ATTENTION_OPENED",code?:"STANDARD"|"DEEP"|"MOVE_OUT")=>{
 const r=compileModelWorkflowDraft({eventType:type,severity:"WARNING",...(code?{serviceCode:code}:{})},scope);
 if(!r.ok)throw Error("invalid trusted fixture");return r.value;
};
describe("R43 owner automation portfolio overlap risk",()=>{
 it("detects exact duplicates and unconditional rules shadowing selective rules",()=>{
  const r=inspectOwnerAutomationPortfolio(inp([
    draft("REQUEST_CREATED"),draft("REQUEST_CREATED","DEEP"),
    draft("REQUEST_CREATED","DEEP"),draft("ATTENTION_OPENED"),draft("ATTENTION_OPENED"),
  ]));
  expect(r).toMatchObject({ok:true,value:{inspected:5,reviewedWithoutConflicts:false,
    publishPerformed:false,providerMessagesSent:false}});
  if(r.ok)expect(r.value.conflicts.map(x=>x.code)).toEqual([
    "UNCONDITIONAL_SHADOW","UNCONDITIONAL_SHADOW","OVERLAPPING_CONDITION","DUPLICATE_DRAFT"
  ]);
 });
 it("does not confuse unrelated events or disjoint service conditions",()=>{
  const r=inspectOwnerAutomationPortfolio(inp([
    draft("REQUEST_CREATED","STANDARD"),draft("REQUEST_CREATED","DEEP"),
    draft("QUOTE_ACCEPTED","STANDARD")
  ]));
  expect(r).toMatchObject({ok:true,value:{conflicts:[],reviewedWithoutConflicts:true,
    workflowExecuted:false,financialStateChanged:false}});
 });
 it("independent critic: nested action must not hide an unapproved provider send or financial authority",()=>{
   const d=draft("REQUEST_CREATED");
   const hiddenAction=Object.defineProperty({...d.actions[0]},"sendProviderMessage",{value:true,enumerable:false});
   const conditionsWithAccessors=[Object.defineProperty({
     field:"request.serviceCode",operator:"EQ",value:"STANDARD"
   },"sendProviderMessage",{value:true,enumerable:false})];
   for(const malformed of [
     {...d,actions:[hiddenAction]},
     {...d,actions:[{...d.actions[0],recipient:"CUSTOMER_PRIMARY"}]},
     {...d,actions:[{type:"CREATE_ATTENTION",severity:"CRITICAL",summaryKey:"X",paymentPaid:true}]},
     {...d,conditions:conditionsWithAccessors},
   ])expect(inspectOwnerAutomationPortfolio(inp([malformed]))).toMatchObject({
      ok:false,code:"PORTFOLIO_SOURCE_INVALID"
   });
 });
 it("refuses cross-workspace, nonowner, foreign draft, provider rights and hidden data",()=>{
  const d=draft("REQUEST_CREATED");
  for(const x of [
   {...inp([d]),actor:{workspaceId:"foreign",role:"OWNER"}},
   {...inp([d]),actor:{workspaceId:"workspace-1",role:"DISPATCHER"}},
   inp([{...d,workspaceId:"foreign"}]), inp([{...d,published:true}]),
   inp([{...d,sendsCustomerMessages:true}]),
   inp([Object.defineProperty({...d},"hiddenPayment",{value:1,enumerable:false})]),
   inp([]),inp(Array(26).fill(d)),
  ])expect(inspectOwnerAutomationPortfolio(x)).toMatchObject({ok:false});
 });
});
