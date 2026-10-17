import {describe,expect,it} from "vitest";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";
const scope={workspaceId:"workspace-1",branchId:"branch-1",
 actorWorkspaceId:"workspace-1",role:"OWNER" as const};
describe("SONIC L04 safe AI model-to-automation-draft compiler",()=>{
 it("compiles each persisted event into one internal owner-reviewed action with no sends or finance rights",()=>{
   const events=["REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED",
     "INVOICE_PAID","ATTENTION_OPENED"] as const;
   for(const eventType of events){
     const result=compileModelWorkflowDraft({eventType,severity:"WARNING"},scope);
     expect(result).toMatchObject({ok:true,value:{
       state:"DRAFT_REQUIRES_OWNER_REVIEW",eventType,actions:[{type:"CREATE_ATTENTION"}],
       published:false,requiresOwnerPublish:true,previewOnly:true,
       sendsCustomerMessages:false,mutatesFinancialState:false,
       maxActionsPerEvent:1,
     }});
   }
 });
 it("permits only a bounded saved-service filter, and no service field for attention events",()=>{
   expect(compileModelWorkflowDraft({eventType:"QUOTE_ACCEPTED",serviceCode:"DEEP",severity:"CRITICAL"},scope))
     .toMatchObject({ok:true,value:{conditions:[{
       field:"request.serviceCode",operator:"EQ",value:"DEEP"
     }]}});
   expect(compileModelWorkflowDraft({eventType:"ATTENTION_OPENED",serviceCode:"DEEP",severity:"WARNING"},scope))
     .toMatchObject({ok:false,code:"AI_WORKFLOW_DRAFT_INVALID"});
 });
 it("never trusts an AI output to choose recipients, money or action authority",()=>{
   for(const candidate of [
     {eventType:"QUOTE_ACCEPTED",severity:"WARNING",type:"SEND_EMAIL_TEMPLATE"},
     {eventType:"QUOTE_ACCEPTED",severity:"WARNING",actions:[{type:"SEND_WHATSAPP_TEMPLATE"}]},
     {eventType:"INVOICE_PAID",severity:"CRITICAL",refund:true},
     {eventType:"INVOICE_PAID",severity:"INFO",serviceCode:"UNSUPPORTED"},
     {eventType:"ATTENTION_OPENED",severity:"HIGHEST"},
     {eventType:"UNKNOWN",severity:"WARNING"},
     {eventType:"QUOTE_ACCEPTED",severity:"INFO",customerEmail:"private@example.test"},
     [],null,
   ]) expect(compileModelWorkflowDraft(candidate,scope).ok).toBe(false);
 });
 it("requires exact owner/tenant scope before interpreting a proposed workflow",()=>{
   for(const forged of [{...scope,role:"DISPATCHER" as const},
     {...scope,actorWorkspaceId:"other"},
     {...scope,branchId:""},
     {...scope,workspaceId:"https://fake"}]){
     expect(compileModelWorkflowDraft({eventType:"REQUEST_CREATED",severity:"INFO"},forged))
       .toMatchObject({ok:false,code:"AI_WORKFLOW_OWNER_SCOPE_REQUIRED"});
   }
 });
 it("critic: reject nonenumerable financial permissions embedded in a plausible model draft",()=>{
    const hidden=Object.defineProperty({
      eventType:"QUOTE_ACCEPTED",severity:"WARNING",
    },"sendProviderMessage",{value:true,enumerable:false});
    expect(compileModelWorkflowDraft(hidden,scope))
      .toMatchObject({ok:false,code:"AI_WORKFLOW_DRAFT_INVALID"});
  });
 it("denies inherited prototypes and accessor traps, does not execute custom values",()=>{
   const inherited=Object.assign(Object.create({toolCalls:[{name:"send"}]}),{
     eventType:"REQUEST_CREATED",severity:"INFO",
   });
   expect(compileModelWorkflowDraft(inherited,scope).ok).toBe(false);
   const accessor=Object.defineProperty({eventType:"REQUEST_CREATED"},"severity",{
     enumerable:true,get(){throw new Error("unsafe accessor invoked");},
   });
   expect(()=>compileModelWorkflowDraft(accessor,scope)).not.toThrow();
   expect(compileModelWorkflowDraft(accessor,scope).ok).toBe(false);
 });
});
