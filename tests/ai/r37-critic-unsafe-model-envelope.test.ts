import {describe,expect,it} from "vitest";
import {buildGuardedAssistantPlan} from "../../src/server/ai/guarded-orchestrator";
const base={
 conversationId:"conversation-1",workspaceId:"workspace-1",savedHumanMessageId:"message-1",
 model:"gpt-service",promptVersion:"v1",knowledgeResultsUsed:false,
 modelOutput:{output:{corrections:[],unsupportedReasons:[],riskFlags:[]},
  replyDraft:"A staff member can review your request.",citations:[],
  requestedToolCalls:[]},
};
describe("R37 independent critic: model provenance and secret-blind human review",()=>{
 it("cannot reflect a model-supplied secret-like blocked tool identifier into saved staff review",()=>{
  const res=buildGuardedAssistantPlan({...base,modelOutput:{
   ...base.modelOutput,requestedToolCalls:[{name:"sk-private-secret-key",arguments:{}}]}});
  expect(res).toMatchObject({ok:true,value:{handoverRequired:true}});
  expect(JSON.stringify(res)).not.toContain("sk-private-secret-key");
 });
 it("never invokes model-controlled accessors masquerading as a trusted completion object",()=>{
   const forged=Object.defineProperty({},"output",{
     enumerable:true,get(){throw Error("secret model-controlled getter");}
   });
   expect(()=>buildGuardedAssistantPlan({...base,modelOutput:forged as never})).not.toThrow();
   const res=buildGuardedAssistantPlan({...base,modelOutput:forged as never});
   expect(res).toMatchObject({ok:false,code:"AI_TURN_SCOPE_UNVERIFIED"});
 });
});
