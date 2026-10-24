import {describe,expect,it} from "vitest";
import {prepareAuthorizedAutomationStarterBatch,type AutomationDraftBatchDependencies}
 from "../../src/server/ai/owner-starter-batch";

const workspaceId="11111111-1111-4111-8111-111111111111";
const branchId="22222222-2222-4222-8222-222222222222";
const slug="qa-cleaning";
function dbAuthority(rows:Array<{workspace_id:string;id:string;active:boolean}|null>){
 let count=0;
 const tables:string[]=[];
 const queries:Array<Array<[string,unknown]>>=[];
 const service={
  from(table:string){
   tables.push(table);
   const filters:Array<[string,unknown]>=[];
   const chain={
    select(_fields:string){return chain;},
    eq(field:string,value:unknown){filters.push([field,value]);return chain;},
    async maybeSingle(){
     queries.push(filters);
     return {data:rows[Math.min(count++,rows.length-1)]??null,error:null};
    },
   };
   return chain;
  },
 };
 const dependencies={
  resolveActor:async()=>({ok:true,value:{
   workspace:{id:workspaceId,slug},
   actor:{role:"OWNER",workspaceId,userId:"owner-test"},
   service,
  }}),
 } as unknown as AutomationDraftBatchDependencies;
 return {dependencies,tables,queries,readCount:()=>count};
}
const realRow={id:branchId,workspace_id:workspaceId,active:true};
const run=(deps:AutomationDraftBatchDependencies,items:unknown=["new-enquiry"])=>
 prepareAuthorizedAutomationStarterBatch(slug,branchId,items,deps);

describe("R48 F23 owner starter branch authority: actual deployed relation",()=>{
 it("reads the active saved workspace_branches relation twice before any draft truth",async()=>{
   const d=dbAuthority([realRow,realRow]);
   const result=await run(d.dependencies);
   expect(result).toMatchObject({ok:true,value:{
     state:"OWNER_STARTER_DRAFT_BATCH_REQUIRES_REVIEW",
     selectedCount:1,persisted:false,published:false,executed:false,
     providerMessagesSent:false,paymentChanged:false,
   }});
   expect(d.tables).toEqual(["workspace_branches","workspace_branches"]);
   expect(d.queries).toEqual([
     [["workspace_id",workspaceId],["id",branchId],["active",true]],
     [["workspace_id",workspaceId],["id",branchId],["active",true]],
   ]);
 });
 it("rejects inactive or foreign saved branch before returning a review batch",async()=>{
   for(const row of [{...realRow,active:false},{...realRow,workspace_id:"foreign"},null]){
     const d=dbAuthority([row]);
     expect(await run(d.dependencies)).toMatchObject({
       ok:false,code:"BATCH_BRANCH_UNVERIFIED",
     });
     expect(d.readCount()).toBe(1);
   }
 });
 it("rejects owner branch deactivation or reassignment on the second database read",async()=>{
   for(const row of [{...realRow,active:false},{...realRow,id:"different"},null]){
     const d=dbAuthority([realRow,row]);
     expect(await run(d.dependencies)).toMatchObject({
       ok:false,code:"BATCH_ACCESS_CHANGED",
     });
     expect(d.readCount()).toBe(2);
   }
 });
 it("never evaluates getter arrays, proxy traps, symbols, hidden keys or array subclass input",async()=>{
   const accessor=["new-enquiry"];
   Object.defineProperty(accessor,"0",{enumerable:true,get(){
     throw Error("untrusted provider or customer getter was evaluated");
   }});
   const sidecar=Object.defineProperty(["new-enquiry"],"customerContact",{
      enumerable:false,value:"private-customer",
   });
   const symbol=["new-enquiry"];
   Object.defineProperty(symbol,Symbol("private"),{value:"private"});
   const proxy=new Proxy(["new-enquiry"],{
     getPrototypeOf(){throw Error("untrusted proxy trap");},
   });
   class Forged extends Array<string>{}
   const subclass=new Forged("new-enquiry");
   for(const input of [accessor,sidecar,symbol,proxy,subclass]){
     const d=dbAuthority([realRow,realRow]);
     await expect(run(d.dependencies,input)).resolves.toMatchObject({
       ok:false,code:"BATCH_INPUT_INVALID",
     });
     expect(d.readCount()).toBe(0);
   }
 });
});
