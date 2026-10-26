import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Blob = {path:string;sourcePr:868|869;status:"added"|"modified";gitBlobSha:string};
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
   migrationInstalled:false,liveDeploymentAuthorized:false,fileCount:15,
   sourceHeads:{
    868:"9df47e173e181cae6345a81f5baf19c2d79a6e1c",
    869:"3030152a7a7d161230a513e2f73a3c4cc0f67b7b",
   },
  });
 });
 it("has exactly fifteen disjoint source paths, with three intentional modifications",()=>{
  expect(lock.files).toHaveLength(15);
  expect(new Set(lock.files.map(x=>x.path)).size).toBe(14);
  expect(lock.files.filter(x=>x.status==="added")).toHaveLength(12);
  expect(lock.files.filter(x=>x.status==="modified").map(x=>x.path).sort()).toEqual([
   "scripts/release/tests/v4-p02-two-owner-authorization-proof.test.mjs",
   "scripts/release/tests/v4-p02-two-owner-readonly-acceptance.test.mjs",
   "scripts/release/v4-p02-two-owner-readonly-acceptance.mjs",
  ]);
  expect(lock.files.filter(x=>x.sourcePr===868)).toHaveLength(7);
  expect(lock.files.filter(x=>x.sourcePr===869)).toHaveLength(8);
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
