import {describe,expect,it} from "vitest";
import {suggestAuthorizedOwnerWorkflow,type AiWorkflowSuggestionDependencies} from "../../src/server/ai/authorized-workflow-suggestion";
const workspaceId="11111111-1111-4111-8111-111111111111";
const branchId="22222222-2222-4222-8222-222222222222";
const input={workspaceSlug:"fictional-cleaner",branchId,
 instruction:"When a customer accepts a quote, flag dispatch review."};
function fixture(opts:{revoke?:boolean;branchMissing?:boolean;toolCalls?:boolean;
 invalidResponse?:boolean;abort?:boolean}={}) {
 const controller=new AbortController();
 let authCount=0,branchReads=0,models=0;
 const deps={
  resolveActor:async()=>{
   authCount++;
   return {ok:true,value:{workspace:{id:workspaceId,slug:input.workspaceSlug},
     actor:{workspaceId,userId:"owner-qa",role:opts.revoke&&authCount>1?"DISPATCHER":"OWNER"},
     service:{from:()=>({})},
   }};
  },
  verifyBranch:async()=>{
    branchReads++;return !(opts.branchMissing && branchReads>1);
  },
  readConfig:()=>({ok:true,value:{model:"mock-only"}}),
  callModel:async()=>{
    models++;
    if(opts.abort)controller.abort();
    return {ok:true,value:{
      output:{},
      replyDraft:opts.invalidResponse?"not-json":JSON.stringify({eventType:"QUOTE_ACCEPTED",severity:"WARNING"}),
      requestedToolCalls:opts.toolCalls?[{name:"sendProviderMessage",arguments:{}}]:[],
      citations:[],
    }};
  },
  signal:controller.signal,
 } as unknown as AiWorkflowSuggestionDependencies;
 return {deps,counts:()=>({authCount,branchReads,models})};
}
describe("R34 owner-only AI workflow draft generation",()=>{
 it("returns only an internal human-reviewed draft after two owner and branch reads",async()=>{
  const x=fixture();
  expect(await suggestAuthorizedOwnerWorkflow(input,x.deps)).toMatchObject({
   ok:true,value:{state:"AI_RULE_DRAFT_OWNER_REVIEW_REQUIRED",executed:false,
    draft:{eventType:"QUOTE_ACCEPTED",actions:[{type:"CREATE_ATTENTION"}],
     published:false,previewOnly:true,requiresOwnerPublish:true,
     sendsCustomerMessages:false,mutatesFinancialState:false}},
  });
  expect(x.counts()).toEqual({authCount:2,branchReads:2,models:1});
 });
 it("rejects revoked owner or moved branch after the model without returning draft",async()=>{
  expect(await suggestAuthorizedOwnerWorkflow(input,fixture({revoke:true}).deps))
   .toMatchObject({ok:false,code:"AI_RULE_ACCESS_REVOKED"});
  expect(await suggestAuthorizedOwnerWorkflow(input,fixture({branchMissing:true}).deps))
   .toMatchObject({ok:false,code:"AI_RULE_BRANCH_CHANGED"});
 });
 it("never interprets model tools, malformed output or cancellation as a published automation",async()=>{
  for(const opts of [{toolCalls:true},{invalidResponse:true},{abort:true}]){
    const r=await suggestAuthorizedOwnerWorkflow(input,fixture(opts).deps);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/sendProviderMessage|Bearer|customer contact/i);
  }
 });
 it("critic: rejects forged empty arrays and primitive model output schemas",async()=>{
   for(const forgedOutput of [[], "", 0, true, Object.create(null)]){
      const x=fixture();
      const original=x.deps.callModel;
      x.deps.callModel=(async()=>({ok:true,value:{
       output:forgedOutput,replyDraft:JSON.stringify({eventType:"QUOTE_ACCEPTED",severity:"WARNING"}),
       requestedToolCalls:[],citations:[],
      }})) as typeof original;
      const result=await suggestAuthorizedOwnerWorkflow(input,x.deps);
      expect(result).toMatchObject({ok:false,code:"AI_RULE_MODEL_OUTPUT_UNSAFE"});
   }
 });
 it("refuses customer records, amounts and private tokens in owner intent before any inference",async()=>{
  for(const instruction of ["Email client at private@example.test",
    "Pay $150 for this service","approve refund 1234","hi",
    "Use https://private.example.test"]){
    const x=fixture();
    const r=await suggestAuthorizedOwnerWorkflow({...input,instruction},x.deps);
    expect(r).toMatchObject({ok:false,code:"AI_RULE_INPUT_INVALID"});
    expect(x.counts().models).toBe(0);
  }
 });
});
