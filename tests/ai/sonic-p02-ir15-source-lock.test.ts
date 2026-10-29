import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Blob = {path:string;sourcePr:868|869|875;status:"added"|"modified";gitBlobSha:string};
type P02Lock = {
 schemaVersion:number;kind:string;canonicalBase:string;sourceHeads:Record<string,string>;
 sourceOnly:boolean;realOwnerSessionVerified:boolean;migrationAuthorized:boolean;
 migrationInstalled:boolean;liveDeploymentAuthorized:boolean;fileCount:number;files:Blob[];
};
const root=process.cwd();
const lock=JSON.parse(readFileSync(join(root,"docs/delivery/sonic-p02-ir15-exact-source-lock-20261026.json"),"utf8")) as P02Lock;
function actualBlobHash(path:string):string {
 const content=readFileSync(join(root,path));
 return createHash("sha1").update(`blob ${content.byteLength}\0`).update(content).digest("hex");
}
describe("P02 IR15 immutable two-source integration provenance",()=>{
 it("locks original draft heads and forbids promoting source tests to live acceptance",()=>{
  expect(lock).toMatchObject({
   schemaVersion:1,kind:"P02_UNMERGED_SOURCE_REHEARSAL_LOCK",
   canonicalBase:"cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411",
   sourceOnly:true,realOwnerSessionVerified:false,migrationAuthorized:false,
   migrationInstalled:false,liveDeploymentAuthorized:false,fileCount:29,
   sourceHeads:{
    868:"d9c53c05cf5f98bf9e5fec688e2f56cc3e42b360",
    869:"053bf3493d6f38e29000e06d5a3868a24442205a",
    875:"b0aaf768efd01dada9de6adaec4484024e01267a",
   },
  });
 });
 it("has exactly twenty-nine disjoint source paths, with five intentional modifications",()=>{
  expect(lock.files).toHaveLength(29);
  // Three source drafts contain 7 + 17 + 5 files; all imported Git blobs
  // must remain unique and byte-for-byte identical to their reviewed heads.
  expect(new Set(lock.files.map(x=>x.path)).size).toBe(29);
  expect(lock.files.filter(x=>x.status==="added")).toHaveLength(24);
  expect(lock.files.filter(x=>x.status==="modified").map(x=>x.path).sort()).toEqual([
   "scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs",
   "scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs",
   "scripts/release/v4-p02-two-owner-readonly-acceptance.mjs",
   "src/app/auth/create-workspace/actions.ts",
   "src/app/auth/create-workspace/page.tsx",
  ]);
  expect(lock.files.filter(x=>x.sourcePr===868)).toHaveLength(7);
  expect(lock.files.filter(x=>x.sourcePr===869)).toHaveLength(17);
  expect(lock.files.filter(x=>x.sourcePr===875)).toHaveLength(5);
 });
 it("compares every imported file with its exact Git object identity",()=>{
  for(const file of lock.files){
   expect(file.gitBlobSha).toMatch(/^[0-9a-f]{40}$/);
   expect(actualBlobHash(file.path),file.path).toBe(file.gitBlobSha);
  }
 });
 it("forbids migration, deployment config and credentials among imported paths",()=>{
  for(const file of lock.files){
   expect(file.path).not.toMatch(/^(?:supabase\/migrations\/|vercel\.json$|\.env(?:\.|$))/);
   expect(file.path).not.toMatch(/(?:^|\/)(?:secrets|credentials)(?:\/|$)/i);
   expect(file.path).not.toMatch(/\.(?:pem|key)$/);
  }
 });
});
