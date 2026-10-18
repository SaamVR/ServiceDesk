import {describe,expect,it,vi} from "vitest";
import {generateAuthorizedRequestBrief,type RequestBriefDependencies} from "../../src/server/ai/request-brief";
const workspaceId="11111111-1111-4111-8111-111111111111";
const requestId="22222222-2222-4222-8222-222222222222";
const branchId="33333333-3333-4333-8333-333333333333";
function stubInvalidRoom(value:unknown){
 const model=vi.fn(async()=>({ok:true,value:{replyDraft:"Review this request.",requestedToolCalls:[],citations:[]}}));
 const from=()=>({
  select(){return this;},eq(){return this;},
  async maybeSingle(){return {error:null,data:{id:requestId,workspace_id:workspaceId,
   branch_id:branchId,service_id:null,bedrooms:value,bathrooms:1,status:"NEW"}};},
 });
 const deps={
  resolveActor:async()=>({ok:true,value:{
   actor:{workspaceId,userId:"owner-1",role:"OWNER"},
   workspace:{id:workspaceId,slug:"qa-cleaning"},
   branchScope:{mode:"ALL",selectedBranchId:null},service:{from},
  }}),
  readConfig:()=>({ok:true,value:{model:"fixture-no-provider"}}),
  callModel:model,
 } as unknown as RequestBriefDependencies;
 return {deps,model};
}
describe("Independent Critic R36: invalid saved dimensions are not missing facts",()=>{
 it("rejects corrupt or coerced numeric room counts before a model call",async()=>{
  for(const value of [Infinity,NaN,-1,1.5,"2",{},1000,undefined]){
   const item=stubInvalidRoom(value);
   expect(await generateAuthorizedRequestBrief({workspaceSlug:"qa-cleaning",requestId},item.deps))
    .toMatchObject({ok:false,code:"AI_BRIEF_SOURCE_UNVERIFIED"});
   expect(item.model).not.toHaveBeenCalled();
  }
 });
});
