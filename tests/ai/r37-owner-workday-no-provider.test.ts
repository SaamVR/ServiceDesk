import {describe,expect,it} from "vitest";
import {loadOwnerWorkdayPriorities,type OwnerWorkdayDependencies} from "../../src/server/ai/owner-workday-priorities";
const workspaceId="workspace-1",slug="cleaning-qa",userId="owner-1",clock="2026-10-18T05:00:00.000Z";
function fixture(opts:{secondWorkspace?:string;secondUser?:string;secondRequest?:string;secondRole?:string}={}){
 let authCalls=0,savedCalls=0;
 const auth=async()=>{
  authCalls++;
  return {ok:true,value:{workspace:{id:workspaceId,slug},
    actor:{workspaceId:authCalls>1?(opts.secondWorkspace??workspaceId):workspaceId,
      userId:authCalls>1?(opts.secondUser??userId):userId,
      role:authCalls>1?(opts.secondRole??"OWNER"):"OWNER"}}};
 };
 const loader=async()=>{
  savedCalls++;
  return {ok:true,value:{
    workspace:{id:workspaceId,slug},
    actor:{workspaceId,userId,role:"OWNER"},
    loadedAt:clock,
    requests:[{status:savedCalls>1?(opts.secondRequest??"NEW"):"NEW"}],
    quotes:[],invoices:[],visits:[],attentionItems:[],
  }};
 };
 const deps={resolveActor:auth,loadSnapshot:loader,
   now:()=>Date.parse(clock)} as unknown as OwnerWorkdayDependencies;
 return {deps,count:()=>({authCalls,savedCalls})};
}
describe("SONIC R37 model-independent signed-in owner saved-workday priorities",()=>{
 it("offers useful saved review queues without any configured model or external side effects",async()=>{
  const v=fixture();
  const r=await loadOwnerWorkdayPriorities(slug,v.deps);
  expect(r).toMatchObject({ok:true,value:{
    state:"VERIFIED_OWNER_WORKDAY_REVIEW",
    modelInvoked:false,providerMessageSent:false,paymentChanged:false,
    priorities:[{key:"OPEN_REQUEST",count:1,module:"requests"}],
    source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
  }});
  expect(v.count()).toEqual({authCalls:2,savedCalls:2});
 });
 it("refuses owner revocation and actor tenant/user drift on second read",async()=>{
  for(const options of [
    {secondRole:"DISPATCHER"},{secondWorkspace:"workspace-2"},
    {secondUser:"other"},
  ]){
    const v=fixture(options);
    expect(await loadOwnerWorkdayPriorities(slug,v.deps))
      .toMatchObject({ok:false,code:"WORKDAY_OWNER_REQUIRED"});
  }
 });
 it("refuses silently outdated priorities after a saved request changes",async()=>{
  const v=fixture({secondRequest:"CANCELLED"});
  expect(await loadOwnerWorkdayPriorities(slug,v.deps))
    .toMatchObject({ok:false,code:"WORKDAY_SOURCE_CHANGED"});
 });
 it("rejects invalid slug and aborted state without source or network calls",async()=>{
  const v=fixture();
  expect(await loadOwnerWorkdayPriorities("bad slug",v.deps))
    .toMatchObject({ok:false,code:"WORKDAY_INPUT_INVALID"});
  const c=new AbortController();c.abort();
  expect(await loadOwnerWorkdayPriorities(slug,{...v.deps,signal:c.signal}))
    .toMatchObject({ok:false,code:"WORKDAY_CANCELLED"});
  expect(v.count()).toEqual({authCalls:0,savedCalls:0});
 });
});
