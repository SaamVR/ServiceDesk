import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

type SourceRow={path:string;status:"added"|"modified";blobSha:string;sourcePr:number};
type SourceLock={schemaVersion:number;kind:string;canonicalBase:string;
 sourceHeads:Record<string,string>;sourceOnly:boolean;fileCount:number;
 liveDeploymentAuthorized:boolean;canonicalMutationAuthorized:boolean;
 modelOrProviderCalled:boolean;files:SourceRow[]};
const root=process.cwd();
const sourceLock=JSON.parse(readFileSync(join(root,
 "docs/delivery/sonic-ir14-exact-source-lock-20261026.json"),"utf8")) as SourceLock;
const allowedPrs=[841,852,854,857,859,861];
const changed=new Set([
 "src/app/app/[workspace]/automations/page.tsx",
 "src/features/operations/AiStudioWorkspace.tsx",
 "src/features/operations/OperationalProductRoute.tsx",
 "src/features/operations/WorkflowExecutionInspector.tsx",
 "src/features/operations/WorkflowExecutionInspector.module.css",
 "src/features/operations/workflow-inspector-model.ts",
]);
function gitBlobSha(path:string){
 const bytes=readFileSync(join(root,path));
 return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
}
describe("IR14 frozen feature PR source-lock: no accidental regenerated code",()=>{
 it("locks the six reviewed PR heads, source-only scope and base canonical",()=>{
  expect(sourceLock).toMatchObject({
   schemaVersion:1,kind:"FROZEN_DRAFT_SOURCE_REHEARSAL_ONLY",
   canonicalBase:"d8b77cbb3a62f7187ff79e5ffb0b2b0392d6e2be",
   sourceOnly:true,fileCount:75,liveDeploymentAuthorized:false,
   canonicalMutationAuthorized:false,modelOrProviderCalled:false,
  });
  expect(Object.keys(sourceLock.sourceHeads).sort()).toEqual(allowedPrs.map(String).sort());
  for(const sha of Object.values(sourceLock.sourceHeads))
   expect(sha).toMatch(/^[a-f0-9]{40}$/);
 });
 it("captures exactly 75 disjoint paths and six intentional modifications",()=>{
  expect(sourceLock.files).toHaveLength(75);
  expect(new Set(sourceLock.files.map(f=>f.path)).size).toBe(75);
  expect(sourceLock.files.filter(f=>f.status==="modified").map(f=>f.path).sort())
   .toEqual([...changed].sort());
  expect(sourceLock.files.filter(f=>f.status==="added")).toHaveLength(69);
  const perPr=new Map(allowedPrs.map(p=>[p,0]));
  for(const row of sourceLock.files){
   expect(allowedPrs).toContain(row.sourcePr);
   perPr.set(row.sourcePr,(perPr.get(row.sourcePr)??0)+1);
   expect(row.blobSha).toMatch(/^[a-f0-9]{40}$/);
   expect(["added","modified"]).toContain(row.status);
  }
  expect(Object.fromEntries(perPr)).toEqual({
   841:33,852:8,854:5,857:8,859:10,861:11,
  });
 });
 it("checks Git's exact object hash of EVERY imported source blob",()=>{
  for(const row of sourceLock.files){
   expect(gitBlobSha(row.path),row.path).toBe(row.blobSha);
  }
 });
 it("forbids importing migrations, secrets, deployment controls or CI workflows",()=>{
  for(const row of sourceLock.files){
   expect(row.path).not.toMatch(/(^|\/)(migrations|\.github|supabase|secrets)(\/|$)/i);
   expect(row.path).not.toMatch(/^(?:vercel\.json|\.env(?:\.|$)|package\.json|pnpm-lock\.yaml)$/);
  }
 });
});
