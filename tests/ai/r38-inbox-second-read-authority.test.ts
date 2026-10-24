import {describe,expect,it} from "vitest";
import {loadAuthorizedOwnerInboxReview,type AuthorizedOwnerInboxDependencies}
 from "../../src/server/ai/owner-inbox-review";
const loadedAt="2026-10-18T08:00:00.000Z",workspaceId="workspace-one";
function build(changed:boolean=false) {
 return {
  workspace:{id:workspaceId,slug:"qa-inbox"},actor:{workspaceId,userId:"owner-one",role:"OWNER"},
  loadedAt,conversations:[{id:"convo-1",workspaceId,channel:"WHATSAPP",handoverActive:false,
   version:1,lastMessageAt:"2026-10-18T07:00:00.000Z"}],
  messages:[
   {id:"customer-1",workspaceId,conversationId:"convo-1",direction:"INBOUND",
    senderKind:"CUSTOMER",createdAt:"2026-10-18T06:00:00.000Z"},
   {id:changed?"outbound-new":"outbound-old",workspaceId,conversationId:"convo-1",
    direction:"OUTBOUND",senderKind:"STAFF",deliveryState:changed?"PROVIDER_ACCEPTED":"QUEUED",
    createdAt:"2026-10-18T07:00:00.000Z"},
  ],
 };
}
function deps(change:false| "identity" | "delivery"=false) {
 let reads=0;
 const dependencies={
  now:()=>Date.parse(loadedAt),
  loadSnapshot:async()=>{
   reads++;
   let d=build(reads===2 && change==="identity");
   if(reads===2&&change==="delivery")
     d={...d,messages:d.messages.map(m=>m.direction==="OUTBOUND"
       ?{...m,deliveryState:"PROVIDER_ACCEPTED"}:m)};
   return {ok:true,value:d};
  },
 } as unknown as AuthorizedOwnerInboxDependencies;
 return {dependencies,reads:()=>reads};
}
describe("SONIC R38 inbox double-snapshot exact source proof",()=>{
 it("accepts two identical saved source reads, without model or customer sends",async()=>{
  const f=deps();
  const result=await loadAuthorizedOwnerInboxReview("qa-inbox",f.dependencies);
  expect(result).toMatchObject({ok:true,value:{doubleChecked:true,authorizedOwner:true,
   candidates:[{reason:"DELIVERY_UNVERIFIED"}],
   outboundMessageQueued:false,aiModelInvoked:false}});
  expect(f.reads()).toBe(2);
 });
 it("rejects changed but still unverified provider state, even if categories and counts are equal",async()=>{
  const f=deps("delivery");
  expect(await loadAuthorizedOwnerInboxReview("qa-inbox",f.dependencies))
   .toMatchObject({ok:false,code:"INBOX_SOURCE_CHANGED"});
 });
 it("rejects a different saved message identity with identical type and timestamp",async()=>{
  const f=deps("identity");
  expect(await loadAuthorizedOwnerInboxReview("qa-inbox",f.dependencies))
   .toMatchObject({ok:false,code:"INBOX_SOURCE_CHANGED"});
 });
});
