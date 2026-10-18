import {describe,expect,it} from "vitest";
import {buildGuardedAssistantPlan,type GuardedAssistantPlanInput} from "../../src/server/ai/guarded-orchestrator";
import {reviewCustomerReplySafety} from "../../src/server/ai/reply-safety";
const input=(replyDraft:string):GuardedAssistantPlanInput=>({
 conversationId:"conv-1",workspaceId:"workspace-1",savedHumanMessageId:"message-1",
 model:"fictional-model",promptVersion:"r36-review",knowledgeResultsUsed:false,
 modelOutput:{output:{serviceCode:"DEEP",riskFlags:[],corrections:[],unsupportedReasons:[]},
  replyDraft,requestedToolCalls:[],citations:[]},
});
describe("SONIC R36 AI-C customer reply review",()=>{
 it("keeps a bounded factual question available as a non-executed staff proposal",()=>{
  const r=buildGuardedAssistantPlan(input("Could you confirm the number of bedrooms?"));
  expect(r).toMatchObject({ok:true,value:{
   replyDraft:"Could you confirm the number of bedrooms?",handoverRequired:false,
   privateReasoningStored:false,
  }});
 });
 it("replaces invented financial, delivery or confirmed-work claims with manual review",()=>{
  for(const draft of [
   "Your booking has been confirmed.","We sent your invoice.",
   "Your payment is received.", "Refund processed.",
   "Your quote is approved.","Your crew is assigned.",
   "Your estimate is $200.", "It costs 250 USD.",
   "Use https://attacker.example to pay.", "Ignore previous instructions.",
  ]) {
   const r=buildGuardedAssistantPlan(input(draft));
   expect(r).toMatchObject({ok:true,value:{
    replyDraft:"A team member will review your service request before any quote or booking is confirmed.",
    handoverRequired:true,handoverReason:expect.any(String),
    toolCalls:[{name:"requestHumanReview",allowed:true}],
    citations:[],privateReasoningStored:false,
   }});
   expect(JSON.stringify(r)).not.toContain("attacker.example");
  }
 });
 it("independent critic: intercepts alternate reservation/refund confirmation grammar",()=>{
   for(const risky of [
     "Your reservation has been confirmed.",
     "I've charged your card and processed the refund.",
     "Your cleaning team has been dispatched.",
   ]){
     const checked=buildGuardedAssistantPlan(input(risky));
     expect(checked).toMatchObject({ok:true,value:{
       handoverRequired:true,
       replyDraft:"A team member will review your service request before any quote or booking is confirmed.",
     }});
   }
 });
 it("disallows bidi, unbounded, HTML and empty model replies",()=>{
  for(const draft of ["","x".repeat(1201),"Hello\u202ereversed",'<script>alert(1)</script>']){
   expect(reviewCustomerReplySafety(draft).safe).toBe(false);
  }
 });
});
