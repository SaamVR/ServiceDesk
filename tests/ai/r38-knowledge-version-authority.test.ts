import {describe,expect,it} from "vitest";
import {ApprovedKnowledgeIndex,type KnowledgeChunk} from "../../src/server/ai/knowledge";
import type {ActorContext} from "../../src/contracts";

const actor={workspaceId:"workspace-1",role:"OWNER",userId:"owner-1"} as ActorContext;
const chunk=(id:string,version:number,text:string,extra:Partial<KnowledgeChunk>={}):KnowledgeChunk=>({
 documentId:"doc-1",chunkId:id,workspaceId:actor.workspaceId,version,
 title:"Approved cleaning policy",approved:true,text,...extra,
});
describe("SONIC R38 AI RAG approved and version-exact knowledge",()=>{
 it("returns only tenant-owned, explicitly approved chunks and current source version",()=>{
  const index=new ApprovedKnowledgeIndex([
   chunk("area-1",1,"Deep cleaning in Camden."),
   chunk("area-1",2,"Deep cleaning available for owner review."),
   chunk("area-2",1,"Deep clean is NOT confirmed.",{approved:false}),
   chunk("foreign-1",1,"Deep cleaning foreign business.",{workspaceId:"workspace-2"}),
   chunk("falseapproval",1,"Deep cleaning confidential.",{approved:"false" as unknown as boolean}),
  ]);
  const r=index.searchApprovedKnowledge(actor,"deep cleaning");
  expect(r).toMatchObject({ok:true,value:[{citation:{chunkId:"area-1",version:2}}]});
  expect(JSON.stringify(r)).not.toContain("foreign");
  expect(JSON.stringify(r)).not.toContain("confidential");
 });
 it("omits conflicting same-version evidence rather than claiming a source citation",()=>{
  const i=new ApprovedKnowledgeIndex([
   chunk("area-1",2,"Clean service instruction A"),
   chunk("area-1",2,"Clean service instruction B"),
  ]);
  expect(i.searchApprovedKnowledge(actor,"clean")).toEqual({ok:true,value:[]});
 });
 it("fails closed on malformed query limit and actor workspace",()=>{
  const i=new ApprovedKnowledgeIndex([chunk("area-1",1,"Deep cleaning.")]);
  for(const q of [null,5,"x".repeat(8193)]){
   expect(i.searchApprovedKnowledge(actor,q as string))
    .toMatchObject({ok:false,code:"AI_KNOWLEDGE_SEARCH_INVALID"});
  }
  for(const n of [-1,0,1.5,9,Infinity,NaN]){
   expect(i.searchApprovedKnowledge(actor,"deep cleaning",n))
    .toMatchObject({ok:false,code:"AI_KNOWLEDGE_SEARCH_INVALID"});
  }
  expect(i.searchApprovedKnowledge({...actor,workspaceId:"../other"},"deep cleaning"))
   .toMatchObject({ok:false,code:"AI_KNOWLEDGE_SEARCH_INVALID"});
 });
 it("does not cite invalid versions, hidden properties, poisoned text or bidi content",()=>{
  const hidden=Object.defineProperty(chunk("hidden-1",1,"Deep clean private"),
   "privateSource",{value:"secret",enumerable:false});
  const i=new ApprovedKnowledgeIndex([
   hidden,chunk("version-zero",0,"Deep cleaning zero"),
   chunk("invalid-bidi",1,"Deep\u202E cleaning"),
   chunk("safe-1",3,"Deep clean authorized."),
  ]);
  const r=i.searchApprovedKnowledge(actor,"deep clean");
  expect(r).toMatchObject({ok:true,value:[{citation:{chunkId:"safe-1"}}]});
  expect(JSON.stringify(r)).not.toContain("secret");
 });
 it("is deterministic across input order and cannot return more than requested",()=>{
  const items=[chunk("a-1",1,"Deep clean first"),chunk("a-2",1,"Deep clean second")];
  const result=(v:KnowledgeChunk[])=>new ApprovedKnowledgeIndex(v)
    .searchApprovedKnowledge(actor,"deep clean",1);
  expect(result(items)).toEqual(result(items.slice().reverse()));
  expect(result(items)).toMatchObject({ok:true,value:[{score:2}]});
 });
});
