import {describe,expect,it,vi} from "vitest";
import type {ActorContext} from "../../src/contracts";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";
import {createPostgresConversationFacadeMethods} from "../../src/server/core/conversation-postgres";
const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",
 userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const attention={id:"33333333-3333-4333-8333-333333333333",
 workspaceId:ctx.workspaceId,type:"REVIEW",severity:"CRITICAL",status:"OPEN",
 resourceType:"REQUEST",resourceId:"44444444-4444-4444-8444-444444444444",
 ownerUserId:ctx.userId,dueAt:"2026-10-17T11:00:00Z",summary:"Review persisted request"};
const quality={id:"55555555-5555-4555-8555-555555555555",
 workspaceId:ctx.workspaceId,visitId:"66666666-6666-4666-8666-666666666666",
 state:"IN_REVIEW",feedbackScore:4,summary:"Inspect saved photo evidence",
 ownerUserId:ctx.userId,dueAt:"2026-10-17T12:00:00Z",
 resolutionNote:"Human follow-up required",reviewRequestState:"ELIGIBLE",
 version:2,createdAt:"2026-10-16T12:00:00Z",
 updatedAt:"2026-10-17T09:00:00Z"};
async function snap(payload:Record<string,unknown>){
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,...payload},error:null});
 return createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient)
 .readWorkspaceSnapshot(ctx,{});
}
describe("R14 saved attention and quality-case evidence integrity",()=>{
 it("retains real urgent attention, acknowledged state and unresolved quality review",async()=>{
  expect(await snap({attentionItems:[attention],
   qualityCases:[quality]})).toMatchObject({ok:true,value:{
    attentionItems:[{severity:"CRITICAL",status:"OPEN",dueAt:attention.dueAt}],
    qualityCases:[{state:"IN_REVIEW",feedbackScore:4,version:2,
      reviewRequestState:"ELIGIBLE"}] }});
  expect(await snap({attentionItems:[{...attention,status:"ACKNOWLEDGED",
    ownerUserId:null,dueAt:null}],qualityCases:[{...quality,state:"RESOLVED",
    feedbackScore:null,ownerUserId:null,dueAt:null,resolutionNote:null,
    version:1,reviewRequestState:"NOT_ELIGIBLE"}]}))
    .toMatchObject({ok:true});
 });
 it("does not silently render invented attention severity, status or due dates",async()=>{
  for(const patch of [
    {id:undefined},{id:""},{workspaceId:3},{type:null},
    {severity:undefined},{severity:"critical"},{severity:"DONE"},
    {status:undefined},{status:"PAID"},{status:0},
    {resourceType:undefined},{resourceId:null},{summary:undefined},
    {ownerUserId:0},{dueAt:"tomorrow"},{dueAt:"2026-10-17T11:00:00"},
  ]) expect(await snap({attentionItems:[{...attention,...patch}]}),
    JSON.stringify(patch)).toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
 });
 it("does not fabricate completed quality cases or coerce score/version evidence",async()=>{
  for(const patch of [
    {id:undefined},{visitId:undefined},{state:undefined},{state:"CLOSED"},
    {summary:undefined},{reviewRequestState:undefined},
    {reviewRequestState:"SENT"},{feedbackScore:"5"},{feedbackScore:0},
    {feedbackScore:5.5},{feedbackScore:6},{feedbackScore:Number.NaN},
    {version:undefined},{version:null},{version:"0"},{version:0},{version:-1},
    {updatedAt:"garbage"},{createdAt:"2026-10-16T12:00:00"},
    {dueAt:"tomorrow"},{ownerUserId:42},
  ]) expect(await snap({qualityCases:[{...quality,...patch}]}),
    JSON.stringify(patch)).toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
 });
 it("rejects foreign workspace rows regardless of otherwise valid saved evidence",async()=>{
  expect(await snap({attentionItems:[{...attention,workspaceId:"foreign"}]}))
    .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
  expect(await snap({qualityCases:[{...quality,workspaceId:"foreign"}]}))
    .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
 });
});
