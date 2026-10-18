import {describe,expect,it} from "vitest";
import {planOwnerInboxReview,loadAuthorizedOwnerInboxReview,
 type AuthorizedOwnerInboxDependencies} from "../../src/server/ai/owner-inbox-review";
import type {ConversationDTO,MessageDTO} from "../../src/contracts";
const workspaceId="workspace-one",clock="2026-10-18T08:00:00.000Z";
const conv=(id:string,rest:Partial<ConversationDTO>={}):ConversationDTO=>({
 id,workspaceId,channel:"WHATSAPP",handoverActive:false,version:1,...rest,
});
const msg=(id:string,conversationId:string,direction:MessageDTO["direction"],
 createdAt:string,rest:Partial<MessageDTO>={}):MessageDTO=>({
 id,conversationId,workspaceId,direction,
 senderKind:direction==="INBOUND"?"CUSTOMER":"STAFF",createdAt,...rest,
});
const input=()=>({
 workspaceId,actor:{workspaceId,role:"OWNER"},
 now:clock,conversations:[conv("convo-1")],
 messages:[msg("customer-1","convo-1","INBOUND","2026-10-18T06:00:00.000Z")],
});
describe("SONIC inbox: saved source owner actions rather than AI guessed SLA",()=>{
 it("shows one unanswered inbound message, never sends or invokes a model",()=>{
  expect(planOwnerInboxReview(input())).toMatchObject({ok:true,value:{
   state:"OWNER_SAVED_INBOX_REVIEW",inspectedMessages:1,candidates:[{
    conversationId:"convo-1",reason:"CUSTOMER_AWAITING_REVIEW",humanReviewRequired:true,
    customerMessageSent:false,providerDeliveryConfirmed:false,
   }],outboundMessageQueued:false,aiModelInvoked:false,
  }});
 });
 it("does not mistake an outbound queued/failed/prov-accepted attempt for delivered response",()=>{
  for(const deliveryState of ["QUEUED","FAILED","RUNNING","PROVIDER_ACCEPTED"] as const){
   const result=planOwnerInboxReview({...input(),messages:[
    ...input().messages,msg("reply-1","convo-1","OUTBOUND","2026-10-18T07:00:00.000Z",{deliveryState}),
   ]});
   expect(result).toMatchObject({ok:true,value:{candidates:[{reason:"DELIVERY_UNVERIFIED"}]}});
  }
  for(const deliveryState of ["DELIVERED","READ"] as const){
   const result=planOwnerInboxReview({...input(),messages:[
    ...input().messages,msg("reply-1","convo-1","OUTBOUND","2026-10-18T07:00:00.000Z",{deliveryState}),
   ]});
   expect(result).toMatchObject({ok:true,value:{candidates:[]}});
  }
 });
 it("keeps human handover on review even with delivered reply",()=>{
  const result=planOwnerInboxReview({...input(),conversations:[conv("convo-1",{handoverActive:true})],
   messages:[...input().messages,msg("reply-1","convo-1","OUTBOUND","2026-10-18T07:00:00.000Z",{deliveryState:"DELIVERED"})]});
  expect(result).toMatchObject({ok:true,value:{candidates:[{reason:"HUMAN_HANDOVER",reviewPriority:"HIGH"}]}});
 });
 it("fails closed on capped incomplete history, duplicates and cross workspace rows",()=>{
  const base=input();
  expect(planOwnerInboxReview({...base,messages:Array(1000).fill(base.messages[0])}))
   .toMatchObject({ok:false,code:"INBOX_SOURCE_INCOMPLETE"});
  expect(planOwnerInboxReview({...base,conversations:Array(200).fill(base.conversations[0])}))
   .toMatchObject({ok:false,code:"INBOX_SOURCE_INCOMPLETE"});
  for(const messages of [[...base.messages,base.messages[0]],
   [{...base.messages[0],workspaceId:"other"}],
   [{...base.messages[0],conversationId:"foreign"}],
   [{...base.messages[0],createdAt:"tomorrow"}]]){
   expect(planOwnerInboxReview({...base,messages}))
     .toMatchObject({ok:false,code:"INBOX_SOURCE_INVALID"});
  }
 });
 it("independent critic: rejects impossible civil timestamps rather than normalizing a saved message",()=>{
  const r=planOwnerInboxReview({...input(),messages:[
    msg("customer-1","convo-1","INBOUND","2026-02-30T06:00:00.000Z"),
  ]});
  expect(r).toMatchObject({ok:false,code:"INBOX_SOURCE_INVALID"});
 });
 it("independent critic: same-instant outbound is NOT authoritative proof of a reply",()=>{
  const r=planOwnerInboxReview({...input(),messages:[
    ...input().messages,
    msg("outbound-1","convo-1","OUTBOUND","2026-10-18T06:00:00.000Z",{deliveryState:"DELIVERED"}),
  ]});
  expect(r).toMatchObject({ok:true,value:{candidates:[{reason:"DELIVERY_UNVERIFIED"}]}});
 });
 it("independent critic: sparse/corrupt history never throws or produces a false complete inbox",()=>{
  const sparse=Array(2) as MessageDTO[];
  sparse[1]=input().messages[0];
  expect(()=>planOwnerInboxReview({...input(),messages:sparse})).not.toThrow();
  expect(planOwnerInboxReview({...input(),messages:sparse}))
    .toMatchObject({ok:false,code:"INBOX_SOURCE_INVALID"});
 });
 it("double checks a signed-in owner and refuses mid-read message status changes",async()=>{
  let reads=0;
  const stub={...input(),loadedAt:clock,workspace:{id:workspaceId,slug:"qa-owner"},
   actor:{workspaceId,userId:"owner-one",role:"OWNER"}};
  const deps={
   now:()=>Date.parse(clock),
   loadSnapshot:async()=>{
    reads++;
    return {ok:true,value:{...stub,
      messages:reads===1?stub.messages:[...stub.messages,msg("reply-1","convo-1","OUTBOUND",
       "2026-10-18T07:00:00.000Z",{deliveryState:"DELIVERED"})],
    }};
   },
  } as unknown as AuthorizedOwnerInboxDependencies;
  expect(await loadAuthorizedOwnerInboxReview("qa-owner",deps))
    .toMatchObject({ok:false,code:"INBOX_SOURCE_CHANGED"});
  expect(reads).toBe(2);
 });
});
