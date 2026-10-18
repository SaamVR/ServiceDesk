import {describe,expect,it} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {loadApprovedCatalogKnowledge} from "../../src/server/ai/catalog-knowledge";

const original={id:"service-1",workspace_id:"ws-1",code:"DEEP",
 name:"Deep cleaning",active:true,requires_review:true,
 updated_at:"2026-10-18T03:00:00Z"};
function fakeCatalog(rows:unknown) {
 const chain={
   eq(_key:string,_value:unknown){return this;},
   async limit(_count:number){return {data:rows,error:null};},
 };
 return {from:(_name:string)=>({select:(_fields:string)=>chain})} as unknown as Pick<SupabaseClient,"from">;
}
const run=(rows:unknown)=>loadApprovedCatalogKnowledge(fakeCatalog(rows),"ws-1");
describe("SONIC R40 AI-C authoritative tenant knowledge revisions",()=>{
 it("preserves a legitimate approved catalog and its service citation",async()=>{
   const r=await run([original]);
   expect(r).toMatchObject({ok:true});
   if(!r.ok)return;
   const hits=r.value.searchApprovedKnowledge({
     workspaceId:"ws-1",userId:"owner-1",role:"OWNER"},"deep cleaning");
   expect(hits).toMatchObject({ok:true,value:[{
     citation:{documentId:"service-catalog:service-1",chunkId:"active-service:DEEP"}
   }]});
 });
 it("rejects ambiguous service codes even when distinct DB IDs exist",async()=>{
   const r=await run([original,{...original,id:"service-2",
     name:"Another active deep cleaning price"}]);
   expect(r).toMatchObject({ok:false,code:"AI_CATALOG_READ_FAILED"});
 });
 it("fails closed on calendar normalization and bogus timezone offsets",async()=>{
   for(const updated_at of ["2026-02-30T03:00:00Z","2026-10-18T25:00:00Z",
     "2026-10-18T03:00:00+15:00","2026-10-18T03:00:00+14:01",
     "2026-10-18 03:00:00","tomorrow"]){
     expect(await run([{...original,updated_at}]))
       .toMatchObject({ok:false,code:"AI_CATALOG_READ_FAILED"});
   }
 });
 it("rejects hidden/prototype/accessor supplier facts rather than silently trusting subset",async()=>{
   const hidden=Object.defineProperty({...original},"privatePrice",{
     value:"private-price",enumerable:false,
   });
   const poisoned=Object.assign(Object.create({privateContact:"private"}),original);
   const accessor=Object.defineProperty({...original},"name",{
     enumerable:true,get(){throw Error("read private contact");},
   });
   for(const row of [hidden,poisoned,accessor]){
     expect(await run([row])).toMatchObject({ok:false,code:"AI_CATALOG_READ_FAILED"});
   }
 });
 it("does not place invisible bidi controls or HTML snippets into AI retrieval",async()=>{
   for(const name of ["Deep\u202E cleaning","<script>Hi</script>","Deep\ncleaning"]){
     const r=await run([{...original,name}]);
     expect(r).toMatchObject({ok:false,code:"AI_CATALOG_READ_FAILED"});
   }
 });
});
