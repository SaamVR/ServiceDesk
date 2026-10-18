import {describe,expect,it} from "vitest";
import {buildGuardedAssistantPlan} from "../../src/server/ai/guarded-orchestrator";
const original={conversationId:"conversation-1",workspaceId:"workspace-1",
  savedHumanMessageId:"message-1",model:"gpt-model",
  promptVersion:"v1",knowledgeResultsUsed:false};
const output=(values:Record<string,unknown>)=>({
  ...original,
  modelOutput:{
    output:{corrections:[],unsupportedReasons:[],riskFlags:[],...values.output as object},
    replyDraft:"Please share the missing service details.",
    requestedToolCalls:[{name:"calculateQuote",arguments:{requestId:"request-1"}}],
    citations:[],
    ...values,
  },
});
describe("SONIC R40 AI mixed-turn quarantine",()=>{
 it("keeps an individually valid staff-only proposal for a safe turn",()=>{
  const result=buildGuardedAssistantPlan(output({}));
  expect(result).toMatchObject({ok:true,value:{handoverRequired:false,
    toolCalls:[{name:"calculateQuote"}]}});
 });
 it("never leaves quote/booking tools available beside blocked payment requests",()=>{
  const result=buildGuardedAssistantPlan(output({requestedToolCalls:[
    {name:"calculateQuote",arguments:{requestId:"request-1"}},
    {name:"markPaymentPaid",arguments:{invoiceId:"invoice-1"}},
    {name:"findAvailableSlots",arguments:{requestId:"request-1"}},
  ]}));
  expect(result).toMatchObject({ok:true,value:{handoverRequired:true,
    toolCalls:[{name:"requestHumanReview"}],
    privateReasoningStored:false}});
  if(result.ok)expect(result.value.toolCalls).toHaveLength(1);
 });
 it("quarantines all model tools when a saved-risk flag requires handover",()=>{
  const result=buildGuardedAssistantPlan(output({output:{riskFlags:["PROMPT_INJECTION"]}}));
  expect(result).toMatchObject({ok:true,value:{handoverRequired:true,
    toolCalls:[{name:"requestHumanReview"}]}});
 });
 it("quarantines model tools even when unsafe customer text alone requires handover",()=>{
  const result=buildGuardedAssistantPlan(output({
    replyDraft:"The customer has paid the invoice and the booking is confirmed.",
  }));
  expect(result).toMatchObject({ok:true,value:{handoverRequired:true,
    toolCalls:[{name:"requestHumanReview"}]}});
 });
 it("critic: refuses model completion metadata pretending a provider sent a message",()=>{
   const result=buildGuardedAssistantPlan(output({providerDeliveryConfirmed:true}));
   expect(result).toMatchObject({ok:false,code:"AI_TURN_SCOPE_UNVERIFIED"});
 });
 it("critic: rejects hidden own actions on a seemingly safe model envelope",()=>{
   const candidate=output({});
   Object.defineProperty(candidate.modelOutput,"paymentApproved",{
     value:true,enumerable:false,
   });
   expect(buildGuardedAssistantPlan(candidate))
     .toMatchObject({ok:false,code:"AI_TURN_SCOPE_UNVERIFIED"});
 });
 it("a clean model request for human handover retains only one review action",()=>{
  const result=buildGuardedAssistantPlan(output({requestedToolCalls:[
    {name:"requestHumanReview",arguments:{reason:"customer-asked"}},
    {name:"searchApprovedKnowledge",arguments:{query:"help"}},
  ]}));
  expect(result).toMatchObject({ok:true,value:{handoverRequired:true,
    toolCalls:[{name:"requestHumanReview"}]}});
  if(result.ok)expect(result.value.toolCalls).toHaveLength(1);
 });
});
