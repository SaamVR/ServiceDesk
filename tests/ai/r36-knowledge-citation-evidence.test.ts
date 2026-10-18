import {describe,expect,it} from "vitest";
import {enforceKnowledgeCitations} from "../../src/server/ai/citation-guard";
const one={documentId:"faq-service-1",chunkId:"chunk-1",version:2,title:"Service policy"};
const data={replyDraft:"Review approved service information.",knowledgeResultsUsed:true,citations:[one]};
describe("R36 AI-B trustworthy citation metadata",()=>{
 it("returns only bounded distinct approved-shape evidence and preserves its exact version",()=>{
  expect(enforceKnowledgeCitations(data)).toEqual({ok:true,value:[one]});
 });
 it("requires evidence when model used knowledge and refuses unsupported citations when none was loaded",()=>{
  expect(enforceKnowledgeCitations({...data,citations:[]})).toMatchObject({ok:false,code:"AI_CITATION_REQUIRED"});
  expect(enforceKnowledgeCitations({...data,knowledgeResultsUsed:false}))
    .toMatchObject({ok:false,code:"AI_CITATION_UNEXPECTED"});
  expect(enforceKnowledgeCitations({...data,knowledgeResultsUsed:false,citations:[]}))
    .toMatchObject({ok:true,value:[]});
 });
 it("rejects malformed, duplicated and oversized citation collections",()=>{
  for(const citations of [
   Array(9).fill(one),[one,one],[{...one,version:0}],
   [{...one,version:Infinity}],[{...one,title:"x".repeat(161)}],
   [{...one,documentId:"user@email.example"}],
   [{...one,chunkId:"https://host.example"}],
   [{...one,accessKey:"secret"}],
   [Object.defineProperty({...one},"privateSource",{enumerable:false,value:"secret"})],
   [Object.assign(Object.create({workspaceId:"foreign"}),one)],
  ]){
   const r=enforceKnowledgeCitations({...data,citations});
   expect(r).toMatchObject({ok:false,code:"AI_CITATION_INVALID"});
   expect(JSON.stringify(r)).not.toContain("secret");
  }
 });
 it("rejects unbounded or poisoned drafts even when a citation appears valid",()=>{
  for(const replyDraft of ["","x".repeat(2401),"contact\u202eforeign","invalid\ncontrol"]){
   expect(enforceKnowledgeCitations({...data,replyDraft}))
    .toMatchObject({ok:false,code:"AI_CITATION_INVALID"});
  }
 });
});
