import {describe,expect,it} from "vitest";
import {planOwnerInboxReview} from "../../src/server/ai/owner-inbox-review";

const wid="workspace-one";
const baseline=()=>({
 workspaceId:wid,actor:{workspaceId:wid,role:"OWNER"},
 now:"2026-10-25T00:00:00.000Z",
 conversations:[] as unknown[],messages:[] as unknown[],
});
const example=()=>({
 id:"conversation-one",workspaceId:wid,channel:"WHATSAPP",
 handoverActive:false,version:1,
 lastMessageAt:"2026-10-24T00:00:00.000Z",
});
function checked(input:unknown){
 return planOwnerInboxReview(input as Parameters<typeof planOwnerInboxReview>[0]);
}
describe("R48 F23 saved Inbox source fails closed without executing untrusted objects",()=>{
 it("returns zero candidates on genuinely empty authorized saved history",()=>{
   expect(checked(baseline())).toMatchObject({ok:true,value:{
     inspectedConversations:0,inspectedMessages:0,aiModelInvoked:false,
     outboundMessageQueued:false,candidates:[],
   }});
 });
 it("rejects proxy/throwing prototype from conversation and input records",()=>{
   const badConversation=new Proxy(example(),{
     getPrototypeOf(){throw Error("attempt to reveal customer data");},
   });
   const badInput=new Proxy(baseline(),{
     getPrototypeOf(){throw Error("untrusted payload proxy");},
   });
   for(const [input,code] of [
      [{...baseline(),conversations:[badConversation]},"INBOX_SOURCE_INVALID"],
      [badInput,"INBOX_OWNER_REQUIRED"],
   ] as const){
     expect(()=>checked(input)).not.toThrow();
     expect(checked(input)).toMatchObject({ok:false,code});
   }
 });
 it("rejects array accessor, symbolic sidecar and poisoned array prototype",()=>{
   const getter=[example()];
   Object.defineProperty(getter,"0",{enumerable:true,get(){
     throw Error("injected private conversation accessor");
   }});
   const symbol=Object.defineProperty([example()],Symbol("private"),{value:"PII"});
   class Spoofed extends Array<unknown>{}
   const subclass=new Spoofed(example());
   for(const rows of [getter,symbol,subclass]){
      const input={...baseline(),conversations:rows};
      expect(()=>checked(input)).not.toThrow();
      expect(checked(input)).toMatchObject({ok:false,code:"INBOX_SOURCE_INVALID"});
   }
 });
 it("rejects a hidden or getter-based root actor without reading it",()=>{
   const root=Object.defineProperty(baseline(),"actor",{
     enumerable:true,get(){throw Error("private actor getter");},
   });
   expect(()=>checked(root)).not.toThrow();
   expect(checked(root)).toMatchObject({ok:false,code:"INBOX_OWNER_REQUIRED"});
   const badActor=Object.defineProperty({...baseline().actor},"role",{
     enumerable:true,get(){throw Error("forged OWNER role getter");},
   });
   const altered={...baseline(),actor:badActor};
   expect(()=>checked(altered)).not.toThrow();
   expect(checked(altered)).toMatchObject({ok:false,code:"INBOX_OWNER_REQUIRED"});
 });
});
