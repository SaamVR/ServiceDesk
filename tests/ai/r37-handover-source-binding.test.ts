import {describe,expect,it} from "vitest";
import {buildGuardedAssistantPlan, type GuardedAssistantPlanInput} from "../../src/server/ai/guarded-orchestrator";
const request:GuardedAssistantPlanInput={
 conversationId:"conversation-1",workspaceId:"workspace-1",savedHumanMessageId:"message-1",
 model:"gpt-service-desk",promptVersion:"r37-intake-v1",knowledgeResultsUsed:false,
 modelOutput:{output:{serviceCode:"DEEP",riskFlags:[],corrections:[],unsupportedReasons:[]},
   replyDraft:"We can review your request details.",requestedToolCalls:[],citations:[]},
};
describe("SONIC R37 guarded assistant priority and real saved-turn scope",()=>{
 it("keeps ordinary safely validated customer suggestion without provider actions",()=>{
  const r=buildGuardedAssistantPlan(request);
  expect(r).toMatchObject({ok:true,value:{
    handoverRequired:false,replyDraft:"We can review your request details.",
    privateReasoningStored:false,
  }});
 });
 it("escalates safe-looking reply if model also requested unsafe payment or messaging",()=>{
  const r=buildGuardedAssistantPlan({...request,
   modelOutput:{...request.modelOutput,
     requestedToolCalls:[{name:"markPaymentPaid",arguments:{invoiceId:"invoice-1"}}]}});
  expect(r).toMatchObject({ok:true,value:{handoverRequired:true,
    replyDraft:"A team member will review your service request before any quote or booking is confirmed.",
    citations:[],privateReasoningStored:false}});
  if(r.ok)expect(r.value.toolCalls.every(x=>x.name==="requestHumanReview")).toBe(true);
 });
 it("does not show model text if it self-reports cross-customer access or prompt injection",()=>{
  for(const flag of ["PROMPT_INJECTION","CROSS_CUSTOMER_ACCESS","HUMAN_HANDOVER","PROVIDER_FAILURE"] as const){
    const r=buildGuardedAssistantPlan({...request,modelOutput:{
      ...request.modelOutput,
      output:{...request.modelOutput.output,riskFlags:[flag]},
    }});
    expect(r).toMatchObject({ok:true,value:{handoverRequired:true}});
    if(r.ok)expect(r.value.replyDraft).not.toContain("We can review");
  }
 });
 it("rejects forged tenant and message identifiers rather than leaking raw receipt data",()=>{
  for(const payload of [
    {...request,workspaceId:"test@example.org"},
    {...request,savedHumanMessageId:""},
    {...request,conversationId:"Bearer SECRET"},
    {...request,model:"https://unsafe"},
    {...request,modelOutput:null},
    {...request,knowledgeResultsUsed:"yes"},
  ]){
    const r=buildGuardedAssistantPlan(payload as unknown as GuardedAssistantPlanInput);
    expect(r).toMatchObject({ok:false,code:"AI_TURN_SCOPE_UNVERIFIED"});
    expect(JSON.stringify(r)).not.toContain("SECRET");
  }
 });
});
