import {describe,expect,it} from "vitest";
import {previewF05VersionedWhatIf} from "../../src/server/ai/f05-versioned-whatif";
import {prepareF05VersionedInstructionDraft,type F05InstructionDeps,
 type F05InstructionRequest,type F05Source} from "../../src/server/ai/f05-versioned-instruction-draft";
const workspace="11111111-1111-4111-8111-111111111111",
 branch="22222222-2222-4222-8222-222222222222",
 slug="demo-workspace";
const draftRequest:F05InstructionRequest={
 workspaceSlug:slug,branchId:branch,
 instruction:"When a request is created, create WARNING internal attention for DEEP.",
};
function fixture(opts:{mutateAfter?:boolean;denied?:boolean;sourceChanged?:boolean}={}){
 let sourceReadCount=0,authReadCount=0;
 const deps={
  resolveActor:async()=>{authReadCount++;return opts.denied?
    {ok:false,kind:"authorization",message:"denied"}:
    {ok:true,value:{workspace:{id:workspace,slug},actor:{
      workspaceId:workspace,userId:"owner-1",role:"OWNER"},service:{}}};},
  readSource:async()=>{sourceReadCount++;
   const result:F05Source={activeBranch:true,rule:null,versions:[]};
   if(opts.mutateAfter && sourceReadCount===4)return null;
   return result;
  },
 } as unknown as F05InstructionDeps;
 return {deps,counts:()=>({sourceReadCount,authReadCount})};
}
async function accepted(deps:F05InstructionDeps){
 const r=await prepareF05VersionedInstructionDraft(draftRequest,deps);
 if(!r.ok)throw Error("expected fixture to prepare reviewed F05 source");
 return r.value.evidence;
}
describe("F05 guarded production-engine what-if adapter",()=>{
 it("rechecks owner source and models a matching hypothetical DEEP request without side effects",async()=>{
  const f=fixture(),evidence=await accepted(f.deps);
  const r=await previewF05VersionedWhatIf({
   ...draftRequest,expectedEvidence:evidence,sampleServiceCode:"DEEP",
  },f.deps);
  expect(r).toMatchObject({ok:true,value:{
    state:"VERSIONED_SAVED_DRAFT_HYPOTHETICAL_ONLY",
    source:"REAUTHORIZED_SAVED_VERSION_AND_PRODUCTION_PREVIEW_ENGINE",
    workspaceId:workspace,branchId:branch,ruleId:null,
    sampleServiceCode:"DEEP",eventType:"REQUEST_CREATED",
    matched:true,wouldCreateAttention:true,
    checkedConditions:[{field:"request.serviceCode",matched:true}],
    noSavedEventSupplied:true,revalidateBeforeSave:true,published:false,
    executed:false,customerMessagesSent:false,financialStateChanged:false,
    modelInvoked:false,
  }});
  expect(f.counts()).toEqual({authReadCount:4,sourceReadCount:4});
 });
 it("reports no match for mismatched or absent fictional service facts",async()=>{
  const f=fixture(),e=await accepted(f.deps);
  for(const sampleServiceCode of ["NONE","STANDARD","MOVE_OUT"] as const){
   const r=await previewF05VersionedWhatIf({
    ...draftRequest,expectedEvidence:e,sampleServiceCode,
   },f.deps);
   expect(r).toMatchObject({ok:true,value:{
    matched:false,wouldCreateAttention:false,executed:false,published:false,
   }});
  }
 });
 it("rejects stale stored version evidence instead of believing a saved client digest",async()=>{
  const f=fixture(),e=await accepted(f.deps);
  for(const patch of [
   {...e,sourceDigest:"a".repeat(64)},
   {...e,ruleRevision:17},
   {...e,nextReviewVersion:2},
   {...e,branchId:"other-branch"},
  ]){
   const r=await previewF05VersionedWhatIf({...draftRequest,
    expectedEvidence:patch,sampleServiceCode:"DEEP"},f.deps);
   expect(r).toMatchObject({ok:false,code:"F05_WHATIF_SOURCE_STALE"});
  }
 });
 it("rejects forged envelope, hidden publish side effect, and unsupported hypothetical event values",async()=>{
  const f=fixture(),e=await accepted(f.deps);
  const hidden=Object.defineProperty({...e},"sendCustomerMessage",{
   enumerable:false,value:true,
  });
  for(const supplied of [
   {...draftRequest,expectedEvidence:hidden,sampleServiceCode:"DEEP"},
   {...draftRequest,expectedEvidence:e,sampleServiceCode:"ANYTHING"},
   {...draftRequest,expectedEvidence:e,sampleServiceCode:"DEEP",published:true},
  ]){
   expect(await previewF05VersionedWhatIf(supplied as never,f.deps))
    .toMatchObject({ok:false,code:"F05_WHATIF_INPUT_INVALID"});
  }
 });
 it("fails closed on owner revocation or changed source during preview, honors cancellation",async()=>{
  const denied=fixture({denied:true});
  const ok=fixture(),e=await accepted(ok.deps);
  expect(await previewF05VersionedWhatIf({...draftRequest,
    expectedEvidence:e,sampleServiceCode:"DEEP"},denied.deps))
   .toMatchObject({ok:false,code:"F05_WHATIF_SOURCE_UNAVAILABLE"});
  const changed=fixture({mutateAfter:true});
  await accepted(changed.deps);
  expect(await previewF05VersionedWhatIf({...draftRequest,
    expectedEvidence:e,sampleServiceCode:"DEEP"},changed.deps))
   .toMatchObject({ok:false,code:"F05_WHATIF_SOURCE_UNAVAILABLE"});
  const controller=new AbortController();controller.abort();
  const f=fixture();
  expect(await previewF05VersionedWhatIf({...draftRequest,
    expectedEvidence:e,sampleServiceCode:"DEEP"},{...f.deps,signal:controller.signal}))
   .toMatchObject({ok:false,code:"F05_WHATIF_CANCELLED"});
  expect(f.counts()).toEqual({sourceReadCount:0,authReadCount:0});
 });
});
