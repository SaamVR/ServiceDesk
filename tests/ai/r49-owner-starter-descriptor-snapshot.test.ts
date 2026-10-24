import {describe,expect,it} from "vitest";
import {
 prepareAuthorizedAutomationStarterBatch,type AutomationDraftBatchDependencies,
} from "../../src/server/ai/owner-starter-batch";

const wid="11111111-1111-4111-8111-111111111111";
const bid="22222222-2222-4222-8222-222222222222";
const slug="qa-cleaning";
function stubs(onRead?:()=>void){
 let calls=0;
 const d={
  resolveActor:async()=>{
   calls++;onRead?.();
   return {ok:true,value:{
    workspace:{id:wid,slug},actor:{role:"OWNER",workspaceId:wid,userId:"owner-qa"},
    service:{},
   }};
  },
  verifyBranch:async()=>true,
 } as unknown as AutomationDraftBatchDependencies;
 return {d,reads:()=>calls};
}
const run=(ids:unknown,d:AutomationDraftBatchDependencies)=>
 prepareAuthorizedAutomationStarterBatch(slug,bid,ids,d);

describe("R49 CRITIC-01 immutable owner automation starter ID projection",()=>{
 it("uses descriptor snapshot instead of invoking a malicious input .map method",async()=>{
  const input=new Proxy(["new-enquiry"],{get(target,key,receiver){
    if(key==="map")throw Error("proxied map attempted to invoke unauthorized AI action");
    return Reflect.get(target,key,receiver);
  }});
  const s=stubs();
  const out=await run(input,s.d);
  expect(out).toMatchObject({ok:true,value:{
   selectedCount:1,drafts:[{starterId:"new-enquiry",persisted:false,published:false}],
   modelInvoked:false,providerMessagesSent:false,paymentChanged:false,
  }});
  expect(s.reads()).toBe(2);
 });
 it("ignores changed numeric input getters, selecting only validated own descriptor value",async()=>{
  const input=new Proxy(["new-enquiry"],{get(target,key,receiver){
   if(key==="0")return "paid-invoice";
   return Reflect.get(target,key,receiver);
  }});
  const out=await run(input,stubs().d);
  expect(out).toMatchObject({ok:true,value:{
    drafts:[{starterId:"new-enquiry",eventType:"REQUEST_CREATED"}],
  }});
 });
 it("an external edit during owner authorization cannot silently switch the proposal",async()=>{
  const input=["new-enquiry"];
  let mutated=false;
  const s=stubs(()=>{
   if(!mutated){mutated=true;input[0]="paid-invoice";}
  });
  const out=await run(input,s.d);
  expect(out).toMatchObject({ok:true,value:{
    selectedCount:1,drafts:[{starterId:"new-enquiry"}],
  }});
  expect(input[0]).toBe("paid-invoice");
 });
 it("rejects hidden mapper override rather than invoking unreviewed input behavior",async()=>{
  const input=["new-enquiry"];
  Object.defineProperty(input,"map",{value:()=>["paid-invoice"],enumerable:false});
  const s=stubs();
  expect(await run(input,s.d)).toMatchObject({ok:false,code:"BATCH_INPUT_INVALID"});
  expect(s.reads()).toBe(0);
 });
});
