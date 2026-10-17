import {describe,expect,it,vi} from "vitest";
import {handleAiWorkflowSuggestionPost} from "../../src/server/api-handlers/ai-workflow-suggestion-http";
const branchId="22222222-2222-4222-8222-222222222222";
const body={workspaceSlug:"fictional-cleaner",branchId,instruction:"When quotes are accepted, create internal review."};
const make=(payload:unknown=body,origin="https://studio.example.test",method="POST")=>
 new Request("https://studio.example.test/api/internal/ai/workflow-suggestion",{
  method,headers:{"content-type":"application/json","origin":origin,
   "sec-fetch-site":"same-origin"},body:method==="POST"?JSON.stringify(payload):undefined,
 });
const draft={state:"DRAFT_REQUIRES_OWNER_REVIEW",source:"UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED",
  workspaceId:"workspace-qa",branchId,eventType:"QUOTE_ACCEPTED",conditions:[],
  actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"AI_REVIEW_ACCEPTED_QUOTE"}],
  maxActionsPerEvent:1,published:false,requiresOwnerPublish:true,previewOnly:true,
  sendsCustomerMessages:false,mutatesFinancialState:false} as const;
const result={state:"AI_RULE_DRAFT_OWNER_REVIEW_REQUIRED",
 source:"AUTHORIZED_OWNER_AND_SAVED_BRANCH",model:"fictional-no-network",draft,executed:false} as const;
describe("R34 authorized AI workflow HTTP adapter",()=>{
 it("posts exact bounded payload and returns strictly private no-store owner review draft",async()=>{
  const run=vi.fn(async()=>({ok:true as const,value:result}));
  const res=await handleAiWorkflowSuggestionPost(make(),run);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("vary")).toBe("Cookie");
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]).toBeDefined();
  expect(await res.json()).toMatchObject({executed:false,draft:{published:false,
    actions:[{type:"CREATE_ATTENTION"}]}});
 });
 it("refuses forged origin, alternative method, unknown body keys before model invocation",async()=>{
  const run=vi.fn(async()=>({ok:true as const,value:result}));
  const cross=await handleAiWorkflowSuggestionPost(make(body,"https://foreign.example.test"),run);
  const extra=await handleAiWorkflowSuggestionPost(make({...body,sendNow:true}),run);
  const get=await handleAiWorkflowSuggestionPost(make(body,"https://studio.example.test","GET"),run);
  expect([cross.status,extra.status,get.status]).toEqual([403,400,405]);
  expect(run).not.toHaveBeenCalled();
 });
 it("does not turn denied owner or unverified branch into successful suggestion",async()=>{
   for(const code of ["AI_RULE_OWNER_REQUIRED","AI_RULE_BRANCH_UNVERIFIED",
     "AI_RULE_MODEL_OUTPUT_UNSAFE"]){
    const res=await handleAiWorkflowSuggestionPost(make(),async()=>({
      ok:false as const,code,message:"private diagnostic",
    }));
    expect(res.status).toBe(code==="AI_RULE_OWNER_REQUIRED"?403:
      code==="AI_RULE_BRANCH_UNVERIFIED"?404:503);
    expect(await res.json()).toEqual({code});
   }
 });
});
