import {describe, expect, it} from "vitest";
import {dispatchCommittedOutboxJob} from "../../src/server/integrations/outbox/dispatch-router";
import type {OutboxJob} from "../../src/server/integrations/types";
const job:OutboxJob={
 id:"outbox-21",workspaceId:"ws-21",channel:"WHATSAPP",purpose:"QUOTE",
 recipient:{recipientRef:"contact-21",consentRequired:true,hasOptIn:true,optedOut:false},
 createdAt:"2026-10-17T12:00:00.000Z",idempotencyKey:"delivery-r21-1",payload:{},
};
const args={committedAt:"2026-10-17T12:00:01.000Z",attempt:1};
describe("R21 committed outbox direct-entry defense",()=>{
 it("rejects corrupt claimed identities and unsupported intent before a provider call",async()=>{
   let sends=0;
   const dispatchers={WHATSAPP:{async dispatch(){sends++;throw Error("Bearer private");}}};
   const patches: Record<string,unknown>[]=[
     {id:" outbox-21"},{id:"outbox-21 "},{id:"outbox\n21"},
     {id:"x".repeat(257)},{id:{"toString":"outbox-21"}},
     {workspaceId:"ws-21\u202E"},{workspaceId:[]},{workspaceId:" x"},
     {idempotencyKey:" delivery-r21-1"},{idempotencyKey:"x".repeat(257)},
     {idempotencyKey:{toString:"delivery-r21-1"}},
     {channel:"__proto__"},{channel:"WHATSAPP\n"},
     {purpose:"UNKNOWN"},{purpose:"QUOTE "},
     {handoverGuard:{conversationId:"bad\nconversation",expectedConversationVersion:1,handoverActive:false}},
     {handoverGuard:{conversationId:"c".repeat(257),expectedConversationVersion:1,handoverActive:false}},
   ];
   for(const patch of patches){
     const output=await dispatchCommittedOutboxJob({
       ...args,job:{...job,...patch} as OutboxJob,dispatchers,
     });
     expect(output).toMatchObject({ok:false,code:"OUTBOX_COMMIT_CLAIM_INVALID"});
     expect(JSON.stringify(output)).not.toContain("private");
   }
   expect(sends).toBe(0);
 });
 it("rejects malformed adapter tables without mistaking prototype members for dispatchers",async()=>{
   for(const dispatchers of [null,[],false,"WHATSAPP"]){
     const result=await dispatchCommittedOutboxJob({
       ...args,job,dispatchers:dispatchers as never,
     });
     expect(result).toMatchObject({ok:false,code:"OUTBOX_COMMIT_CLAIM_INVALID"});
   }
 });
 it("preserves unsupported configured provider semantics for a valid claim",async()=>{
   const response=await dispatchCommittedOutboxJob({
     ...args,job:{...job,channel:"WEBHOOK"},dispatchers:{},
   });
   expect(response).toMatchObject({
     ok:true,value:{outcome:"TERMINAL_FAILURE",code:"UNSUPPORTED_DISPATCH_CHANNEL"},
   });
 });
});