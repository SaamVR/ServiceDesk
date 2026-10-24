import {describe,expect,it} from "vitest";
import {loadOwnerWorkdayPriorities,type OwnerWorkdayDependencies}
 from "../../src/server/ai/owner-workday-priorities";

const workspaceId="workspace-1",slug="cleaning-qa",userId="owner-a";
const clock="2026-10-25T02:00:00.000Z";
function harness(change:(reads:number)=>unknown[], opts?:{reorder?:boolean}){
 let ownerReads=0,snapshotReads=0;
 const resolveActor=async()=>{
  ownerReads++;return {ok:true,value:{
   workspace:{id:workspaceId,slug},actor:{workspaceId,userId,role:"OWNER"},
  }};
 };
 const loadSnapshot=async()=>{
  snapshotReads++;
  return {ok:true,value:{
   workspace:{id:workspaceId,slug},actor:{workspaceId,userId,role:"OWNER"},
   loadedAt:clock,requests:change(snapshotReads),
   quotes:[],visits:[],invoices:[],attentionItems:[],
  }};
 };
 const deps=({resolveActor,loadSnapshot,now:()=>Date.parse(clock)}
  as unknown as OwnerWorkdayDependencies);
 return {deps,counts:()=>({ownerReads,snapshotReads}),opts};
}
const read=(t:ReturnType<typeof harness>)=>loadOwnerWorkdayPriorities(slug,t.deps);
describe("R50 F23 owner workday review exact saved row identity",()=>{
 it("retains model-free verified priorities for identical saved source",async()=>{
  const t=harness(()=>[{id:"request-one",status:"NEW"}]);
  expect(await read(t)).toMatchObject({ok:true,value:{
   state:"VERIFIED_OWNER_WORKDAY_REVIEW",
   facts:{openRequests:1},
   priorities:[{key:"OPEN_REQUEST",count:1}],
   manualReviewRequired:true,modelInvoked:false,
   providerMessageSent:false,paymentChanged:false,
  }});
  expect(t.counts()).toEqual({ownerReads:2,snapshotReads:2});
 });
 it("rejects same-count different request identity without inventing stable owner evidence",async()=>{
  const t=harness(n=>[{id:n===1?"request-one":"request-two",status:"NEW"}]);
  expect(await read(t)).toMatchObject({ok:false,code:"WORKDAY_SOURCE_CHANGED"});
 });
 it("rejects owner-relevant version drift hidden by an unchanged count",async()=>{
  const t=harness(n=>[{id:"request-one",status:"NEW",version:n}]);
  expect(await read(t)).toMatchObject({ok:false,code:"WORKDAY_SOURCE_CHANGED"});
 });
 it("does not falsely reject harmless ordering changes in the same saved set",async()=>{
  const t=harness(n=>n===1?[
    {id:"request-one",status:"NEW"},{id:"request-two",status:"NEW"},
  ]:[
    {id:"request-two",status:"NEW"},{id:"request-one",status:"NEW"},
  ]);
  expect(await read(t)).toMatchObject({ok:true,value:{
   state:"VERIFIED_OWNER_WORKDAY_REVIEW",facts:{openRequests:2},
   modelInvoked:false,
  }});
 });
 it("refuses hidden getter/proxy record sources instead of making a verified claim",async()=>{
  const guarded={id:"request-one",status:"NEW"};
  const accessor=Object.defineProperty({...guarded},"id",{
   enumerable:true,get(){throw Error("private customer source getter");},
  });
  const t=harness(()=>[accessor]);
  await expect(read(t)).resolves.toMatchObject({ok:false});
 });
});
