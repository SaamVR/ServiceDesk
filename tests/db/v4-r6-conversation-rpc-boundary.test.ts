import { describe, expect, it, vi } from "vitest";
import type { ActorContext, CommandMeta } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";

const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const cid="33333333-3333-4333-8333-333333333333";
const meta={expectedVersion:1,now:"2026-10-16T08:00:00Z",idempotencyKey:"R6-REPLY-123456"} as CommandMeta;
const handover={id:cid,workspaceId:ctx.workspaceId,channel:"EMAIL",version:2,handoverActive:true,assignedUserId:ctx.userId};
const message={id:"44444444-4444-4444-8444-444444444444",
  workspaceId:ctx.workspaceId,conversationId:cid,direction:"OUTBOUND",senderKind:"STAFF",
  body:"Approved by human staff",deliveryState:"QUEUED",createdAt:"2026-10-16T08:00:00Z"};
function facade(data:unknown,error:unknown=null) {
 const rpc=vi.fn().mockResolvedValue({data,error});
 return createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient);
}
const handoverInput={active:true};
const replyInput={body:message.body,channel:"EMAIL" as const};
describe("R6 conversation commands fail closed on untrusted RPC output",()=>{
 it("returns valid tenant-scoped handover and queued reply",async()=>{
  expect(await facade({ok:true,...handover}).setConversationHandover(ctx,cid,handoverInput,meta))
    .toMatchObject({ok:true,value:{id:cid,workspaceId:ctx.workspaceId}});
  expect(await facade({ok:true,message,outboxEventId:"55555555-5555-4555-8555-555555555555"})
    .enqueueConversationReply(ctx,cid,replyInput,meta))
    .toMatchObject({ok:true,value:{message:{id:message.id},outboxEventId:"55555555-5555-4555-8555-555555555555"}});
 });
 it("does not claim a foreign handover or spoofed customer reply",async()=>{
  for (const patch of [
    {id:"wrong"},{workspaceId:"wrong"},{version:1.5},{version:-1}
  ]) expect(await facade({ok:true,...handover,...patch})
    .setConversationHandover(ctx,cid,handoverInput,meta))
      .toMatchObject({ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH"});
  for (const patch of [
    {workspaceId:"foreign"},{conversationId:"foreign"},
    {direction:"INBOUND"},{senderKind:"AI"},{body:"different text"},{id:undefined}
  ]) expect(await facade({ok:true,message:{...message,...patch},outboxEventId:"event1"})
    .enqueueConversationReply(ctx,cid,replyInput,meta))
      .toMatchObject({ok:false,code:"REPLY_RPC_SCOPE_MISMATCH"});
 });
 it("requires literal persisted handover state instead of a successful RPC envelope",async()=>{
  for(const handoverActive of [undefined,null,"false","true",0,1,false]){
    const result=await facade({ok:true,...handover,handoverActive})
      .setConversationHandover(ctx,cid,{active:true},meta);
    expect(result,JSON.stringify(handoverActive))
      .toMatchObject({ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH"});
  }
  expect(await facade({ok:true,...handover,handoverActive:false,assignedUserId:null})
    .setConversationHandover(ctx,cid,{active:false},meta))
    .toMatchObject({ok:true,value:{handoverActive:false}});
  expect(await facade({ok:true,...handover,handoverActive:true,assignedUserId:null})
    .setConversationHandover(ctx,cid,{active:false},meta))
    .toMatchObject({ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH"});
 });
 it("requires the SQL-default assigned staff and removal on deactivation",async()=>{
  const notDefault=await facade({ok:true,...handover,assignedUserId:"someone-else"})
    .setConversationHandover(ctx,cid,{active:true},meta);
  expect(notDefault).toMatchObject({ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH"});
  const stale=await facade({ok:true,...handover,handoverActive:false,assignedUserId:ctx.userId})
    .setConversationHandover(ctx,cid,{active:false},meta);
  expect(stale).toMatchObject({ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH"});
 });
 it("verifies the exact saved assignee when staff requests an assigned handover",async()=>{
  const expected="55555555-5555-4555-8555-555555555555";
  const requested={active:true,assignedUserId:expected};
  for(const assignedUserId of [undefined,null,"other-user"]){
    const result=await facade({ok:true,...handover,assignedUserId})
      .setConversationHandover(ctx,cid,requested,meta);
    expect(result).toMatchObject({ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH"});
  }
  expect(await facade({ok:true,...handover,assignedUserId:expected})
    .setConversationHandover(ctx,cid,requested,meta))
    .toMatchObject({ok:true,value:{assignedUserId:expected}});
 });
 it("refuses a foreign tenant row from the workspace snapshot instead of displaying it",async()=>{
  const foreign={...handover,workspaceId:"foreign"};
  const result=await facade({ok:true,conversations:[foreign]})
    .readWorkspaceSnapshot(ctx,{} as never);
  expect(result).toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
  expect(await facade({ok:true,conversations:[handover]})
    .readWorkspaceSnapshot(ctx,{} as never)).toMatchObject({ok:true,value:{conversations:[{id:cid}]}});
 });
 it("never converts malformed saved conversation handover or version into trusted staff state",async()=>{
  for(const patch of [
    {handoverActive:"false"},{handoverActive:"true"},
    {handoverActive:null},{handoverActive:0},{handoverActive:undefined},
    {version:"2"},{version:null},{version:undefined},
    {version:-1},{version:1.5},
    {channel:"SMS"},{channel:undefined},
  ]) {
    const snapshot=await facade({ok:true,conversations:[{...handover,...patch}]})
      .readWorkspaceSnapshot(ctx,{} as never);
    expect(snapshot,JSON.stringify(patch))
      .toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
  }
  for(const patch of [
    {handoverActive:"false"},{handoverActive:null},
    {version:"2"},{version:undefined},{channel:"SMS"},
  ]) {
    const inbound=await facade({ok:true,state:"APPLIED",conversation:{...handover,...patch}})
      .applyInboundMessage({
        workspaceId:ctx.workspaceId,channel:"EMAIL",provider:"EMAIL",providerAccountId:"acct",
        providerMessageId:"mail-1",sender:"customer@example.com",body:"hi",
        receivedAt:"2026-10-16T08:00:00Z",
      } as never);
    expect(inbound.ok,JSON.stringify(patch)).toBe(false);
  }
  const valid=await facade({ok:true,conversations:[handover]})
    .readWorkspaceSnapshot(ctx,{} as never);
  expect(valid).toMatchObject({ok:true,value:{conversations:[{handoverActive:true,version:2}]}});
 });
 it("sanitizes error codes and raw SQL exceptions across all conversation commands",async()=>{
  const token="Bearer live-secret customer@example.com";
  for(const error of [
    {code:"Bearer:123",message:token},{code:undefined,message:token}
  ]){
    const result=await facade(null,error).enqueueConversationReply(ctx,cid,replyInput,meta);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(token);
  }
  const rpc=vi.fn().mockRejectedValue(new Error(token));
  const methods=createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient);
  expect(await methods.setConversationHandover(ctx,cid,handoverInput,meta))
    .toMatchObject({ok:false,code:"HANDOVER_RPC_UNAVAILABLE"});
  expect(await methods.enqueueConversationReply(ctx,cid,replyInput,meta))
    .toMatchObject({ok:false,code:"REPLY_RPC_UNAVAILABLE"});
  expect(await methods.readWorkspaceSnapshot(ctx,{} as never))
    .toMatchObject({ok:false,code:"SNAPSHOT_RPC_UNAVAILABLE"});
 });
});