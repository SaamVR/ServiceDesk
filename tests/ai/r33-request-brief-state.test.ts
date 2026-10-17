import {describe,expect,it} from "vitest";
import {generateAuthorizedRequestBrief, type RequestBriefDependencies} from "../../src/server/ai/request-brief";

const workspaceId="11111111-1111-4111-8111-111111111111";
const requestId="22222222-2222-4222-8222-222222222222";
const branchId="33333333-3333-4333-8333-333333333333";
const baseRow={id:requestId,workspace_id:workspaceId,branch_id:branchId,
  service_id:null,bedrooms:2,bathrooms:1,status:"NEW"};
function fixtures(opts:{
  changeAfter?:Record<string,unknown>,roleAfter?:string,
  userAfter?:string,branchAfter?:string,abortOnModel?:boolean
}={}) {
 const controller=new AbortController();
 let reads=0,auth=0,models=0;
 const from=(table:string)=>({
   select(_columns:string){return this;},
   eq(_column:string,_value:unknown){return this;},
   async maybeSingle(){
     if(table==="requests"){
       reads++;
       return {data:reads>1?{...baseRow,...opts.changeAfter}:{...baseRow},error:null};
     }
     return {data:null,error:null};
   },
 });
 const service={from};
 const actor=()=>({
  ok:true as const,value:{
   workspace:{id:workspaceId,slug:"qa-cleaning"},
   actor:{workspaceId,userId:auth>1?(opts.userAfter??"user-1"):"user-1",
     role:auth>1?(opts.roleAfter??"OWNER"):"OWNER"},
   branchScope:{mode:"ALL",selectedBranchId:auth>1?opts.branchAfter:null},
   service,
  },
 });
 const deps={
  resolveActor:async()=>{auth++;return actor();},
  readConfig:()=>({ok:true,value:{model:"synthetic-no-network"}}),
  callModel:async()=>{
    models++;
    if(opts.abortOnModel)controller.abort();
    return {ok:true,value:{
      output:{},replyDraft:"Review the saved cleaning request and verify missing details.",
      requestedToolCalls:[],citations:[],
    }};
  },
  signal:controller.signal,
 } as unknown as RequestBriefDependencies;
 return {deps,counts:()=>({reads,auth,models})};
}
describe("SONIC R33 request briefing cannot leak a stale paid-model draft",()=>{
 it("shows a safe draft only when actor and persisted request are unchanged after the model",async()=>{
  const q=fixtures();
  expect(await generateAuthorizedRequestBrief({workspaceSlug:"qa-cleaning",requestId},q.deps))
    .toMatchObject({ok:true,value:{source:"AUTHORIZED_SAVED_REQUEST",requestId}});
  expect(q.counts()).toEqual({reads:2,auth:2,models:1});
 });
 it("rejects changed source fields after model completion",async()=>{
  for(const changeAfter of [
    {status:"CANCELLED"},{bedrooms:4},{bathrooms:3},
    {branch_id:"44444444-4444-4444-8444-444444444444"},
    {service_id:"55555555-5555-4555-8555-555555555555"},
    {workspace_id:"foreign-workspace"},
  ]) {
    const q=fixtures({changeAfter});
    expect(await generateAuthorizedRequestBrief({workspaceSlug:"qa-cleaning",requestId},q.deps))
      .toMatchObject({ok:false,code:"AI_BRIEF_SOURCE_CHANGED"});
    expect(q.counts().models).toBe(1);
  }
 });
 it("rejects revoked owner role or switched user after model call",async()=>{
  for(const change of [{roleAfter:"DISPATCHER"},{userAfter:"other-user"}]){
    const q=fixtures(change);
    expect(await generateAuthorizedRequestBrief({workspaceSlug:"qa-cleaning",requestId},q.deps))
      .toMatchObject({ok:false,code:"AI_BRIEF_ACCESS_REVOKED"});
    expect(q.counts().reads).toBe(1);
  }
 });
 it("honors caller abort without publishing the reply or writing business state",async()=>{
  const q=fixtures({abortOnModel:true});
  expect(await generateAuthorizedRequestBrief({workspaceSlug:"qa-cleaning",requestId},q.deps))
    .toMatchObject({ok:false,code:"AI_BRIEF_CANCELLED"});
  expect(q.counts().reads).toBe(1);
 });
});
