import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
type PathItem={path:string;prBlob:string;canonicalBlob:string|null;
  disposition:"EXACT_SOURCE_ALREADY_PRESENT"|"DRIFT_NEEDS_DIFF_REVIEW"};
type PrReview={pr:number;prHead:string;state:string;
  alreadyInCanonical:number;drift:number;decision:string;paths:PathItem[]};
type Audit={schemaVersion:string;canonicalSha:string;reviewOnly:boolean;
  sourceIdenticalTotal:number;divergentTotal:number;automaticMergeAuthorized:boolean;
  canonicalDeploymentVerified:boolean;prDecisions:PrReview[];
  blobsMeanEquivalentFilesNotVerifiedPrMerge:boolean};
const document:Audit=JSON.parse(readFileSync(join(process.cwd(),
  "docs/delivery/sonic-gap/09-studio-pr-blob-reconciliation-20261026.json"),"utf8"));
const gitBlob=(path:string)=>{
 const bytes=readFileSync(join(process.cwd(),path));
 return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
};
describe("SONIC Studio legacy PR blob-identity review (never merge from audit)",()=>{
 it("records immutable canonical and source PR provenance rather than inventing merge status",()=>{
  expect(document).toMatchObject({schemaVersion:"sonic-studio-blob-diff-v1",
    canonicalSha:"ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4",
    reviewOnly:true,automaticMergeAuthorized:false,
    canonicalDeploymentVerified:false,blobsMeanEquivalentFilesNotVerifiedPrMerge:true});
  expect(document.prDecisions.map(x=>x.pr)).toEqual([631,633,645,642]);
  expect(document.prDecisions.map(x=>x.prHead)).toEqual([
    "84db0ddfc2bc55f8edcb36f48091b47096d78db5",
    "37fa6baca2d1456a9db4ba5520b84f2cb78a63e7",
    "2b2a7d77adc75a70a11e5efa6f2ce34878fe3fe7",
    "fb051ec554542b315cb149c2e2770f8fcca921d3"]);
 });
 it("pins actual canonical Git blob hashes for all 32 file paths",()=>{
  const files=document.prDecisions.flatMap(x=>x.paths);
  expect(files).toHaveLength(32);
  for(const f of files){
   expect(f.path).toMatch(/^(src\/features\/operations|tests\/e2e)\//);
   expect(f.canonicalBlob).toMatch(/^[a-f0-9]{40}$/);
   expect(gitBlob(f.path)).toBe(f.canonicalBlob);
   expect(f.prBlob).toMatch(/^[a-f0-9]{40}$/);
   expect(f.disposition).toBe(f.prBlob===f.canonicalBlob?
     "EXACT_SOURCE_ALREADY_PRESENT":"DRIFT_NEEDS_DIFF_REVIEW");
  }
 });
 it("counts 20 source-identical files and 12 divergent files across specific PRs",()=>{
  expect(document.prDecisions.map(x=>[x.alreadyInCanonical,x.drift])).toEqual([
    [8,0],[6,1],[5,2],[1,9]]);
  expect(document.sourceIdenticalTotal).toBe(20);
  expect(document.divergentTotal).toBe(12);
  for(const p of document.prDecisions){
   expect(p.alreadyInCanonical+p.drift).toBe(p.paths.length);
   expect(p.paths.filter(x=>x.disposition==="EXACT_SOURCE_ALREADY_PRESENT"))
      .toHaveLength(p.alreadyInCanonical);
  }
 });
 it("blocks blanket Studio merges and false assumptions about closed PR",()=>{
  expect(document.prDecisions[0]).toMatchObject({
   state:"OPEN_DRAFT_UNMERGED",decision:"NO_SOURCE_MERGE_NEEDED"});
  expect(document.prDecisions[3]).toMatchObject({
   state:"CLOSED_UNMERGED",decision:"DO_NOT_REOPEN_OR_MERGE_CLOSED_HISTORIC_PR"});
  for(const p of document.prDecisions.slice(1,3))
   expect(p.decision).toBe("SELECTIVE_REVIEW_ONLY_NO_BLIND_MERGE");
 });
});
