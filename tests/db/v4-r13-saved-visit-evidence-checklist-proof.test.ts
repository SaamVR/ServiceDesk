import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";

const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",
  userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const evidence={
  id:"33333333-3333-4333-8333-333333333333",workspaceId:ctx.workspaceId,
  visitId:"44444444-4444-4444-8444-444444444444",
  kind:"PHOTO",mediaReference:"staff-photo",text:"Arrival photo",
  capturedAt:"2026-10-17T10:15:00Z",submittedByUserId:ctx.userId,
  createdAt:"2026-10-17T10:16:00Z",
};
const checklist={
  id:"55555555-5555-4555-8555-555555555555",workspaceId:ctx.workspaceId,
  visitId:evidence.visitId,itemKey:"arrival",completed:true,
  note:"Done",updatedByUserId:ctx.userId,
  updatedAt:"2026-10-17T10:17:00Z",version:2,
};
async function snapshot(payload:Record<string,unknown>){
  const rpc=vi.fn().mockResolvedValue({data:{ok:true,...payload},error:null});
  return createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient)
    .readWorkspaceSnapshot(ctx,{});
}
describe("R13 persisted visit evidence and checklist are never coerced into phantom work",()=>{
  it("preserves actual true/false completion and saved capture evidence",async()=>{
    const result=await snapshot({visitEvidence:[evidence],
      visitChecklistItems:[checklist,{...checklist,id:"other",completed:false,version:0}]});
    expect(result).toMatchObject({ok:true,value:{
      visitEvidence:[{id:evidence.id,visitId:evidence.visitId,
        capturedAt:evidence.capturedAt,submittedByUserId:ctx.userId}],
      visitChecklistItems:[{completed:true,version:2},{completed:false,version:0}],
    }});
  });
  it("refuses malformed source completion and version instead of fabricating done/undone",async()=>{
    for(const patch of [
      {completed:undefined},{completed:null},{completed:"false"},
      {completed:"true"},{completed:1},{completed:0},
      {version:undefined},{version:null},{version:"0"},
      {version:-1},{version:0.5},{version:Number.MAX_SAFE_INTEGER+1},
      {itemKey:null},{visitId:undefined},{updatedByUserId:42},
      {updatedAt:"garbage"},{updatedAt:"2026-10-17T10:17:00"},
    ]) expect(await snapshot({visitChecklistItems:[{...checklist,...patch}]}),
      JSON.stringify(patch)).toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
  });
  it("refuses missing saved evidence identity, actor or invalid timestamp",async()=>{
    for(const patch of [
      {id:undefined},{id:42},{workspaceId:undefined},{visitId:null},
      {kind:undefined},{submittedByUserId:undefined},
      {submittedByUserId:0},{capturedAt:undefined},
      {capturedAt:"not-a-date"},{createdAt:"2026-10-17T10:16:00"},
      {createdAt:null},
    ]) expect(await snapshot({visitEvidence:[{...evidence,...patch}]}),
      JSON.stringify(patch)).toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
  });
  it("retains existing tenant-scoped refusal independent of valid evidence contents",async()=>{
    expect(await snapshot({visitEvidence:[{...evidence,workspaceId:"foreign"}]}))
      .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
    expect(await snapshot({visitChecklistItems:[{...checklist,workspaceId:"foreign"}]}))
      .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
  });
});
