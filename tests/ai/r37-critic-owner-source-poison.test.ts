import {describe,expect,it} from "vitest";
import {loadOwnerWorkdayPriorities,type OwnerWorkdayDependencies} from "../../src/server/ai/owner-workday-priorities";
const workspaceId="workspace-1",slug="cleaning-qa",userId="owner-1",now="2026-10-18T05:00:00.000Z";
describe("R37 independent critic: owner workday never crashes on poisoned persisted record",()=>{
 it("refuses a saved request status getter that throws in the initial read",async()=>{
   const poisoned=Object.defineProperty({},"status",{
     enumerable:true,get(){throw Error("private source accessor");},
   });
   const deps={
     resolveActor:async()=>({ok:true,value:{
       workspace:{id:workspaceId,slug},
       actor:{workspaceId,userId,role:"OWNER"},
     }}),
     loadSnapshot:async()=>({ok:true,value:{
       workspace:{id:workspaceId,slug},
       actor:{workspaceId,userId,role:"OWNER"},
       loadedAt:now,requests:[poisoned],quotes:[],visits:[],
       invoices:[],attentionItems:[],
     }}),
     now:()=>Date.parse(now),
   } as unknown as OwnerWorkdayDependencies;
   await expect(loadOwnerWorkdayPriorities(slug,deps)).resolves
     .toMatchObject({ok:false,code:"WORKDAY_SNAPSHOT_UNAVAILABLE"});
 });
 it("refuses a poisoned second persisted read without returning stale recommendations",async()=>{
   let reads=0;
   const poison=Object.defineProperty({},"status",{
     enumerable:true,get(){throw Error("poison second source");},
   });
   const deps={
     resolveActor:async()=>({ok:true,value:{
       workspace:{id:workspaceId,slug},
       actor:{workspaceId,userId,role:"OWNER"},
     }}),
     loadSnapshot:async()=>{
       reads++;
       return {ok:true,value:{
         workspace:{id:workspaceId,slug},
         actor:{workspaceId,userId,role:"OWNER"},
         loadedAt:now,requests:[reads===1?{status:"NEW"}:poison],
         quotes:[],visits:[],invoices:[],attentionItems:[],
       }};
     },
     now:()=>Date.parse(now),
   } as unknown as OwnerWorkdayDependencies;
   await expect(loadOwnerWorkdayPriorities(slug,deps)).resolves
     .toMatchObject({ok:false,code:"WORKDAY_SOURCE_CHANGED"});
   expect(reads).toBe(2);
 });
});
