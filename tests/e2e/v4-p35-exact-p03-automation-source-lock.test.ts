import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

type Source={path:string;sourcePr:number;gitBlobSha:string;status:"added"|"modified"};
type Lock={schema:string;state:string;canonicalBase:string;p32IntegrationHead:string;
 p32Lock:string;sourceHeads:Record<string,string>;sourceFileCount:number;
 changesRelativeToP32:{added:number;modified:number};files:Source[];
 sourceOnly:boolean;liveRegistrationGuardAuthorized:boolean;
 liveDatabaseMutationAuthorized:boolean;liveProviderDeliveryVerified:boolean;
 realTwoOwnerUatVerified:boolean;productionDeploymentAuthorized:boolean;
 canonicalMergeAuthorized:boolean};
const p35=JSON.parse(readFileSync("docs/delivery/sonic-p35-exact-source-lock-20261029.json","utf8")) as Lock;
const p32=JSON.parse(readFileSync("docs/delivery/sonic-p03-p32-source-provenance-20261029.json","utf8")) as {
 canonicalBase:string;fileCount:number;files:Source[];
};
function blobSha(path:string){
 const body=readFileSync(path);
 return createHash("sha1").update("blob "+body.length+"\0").update(body).digest("hex");
}
describe("P35 independent integrated P03 + attention exact-source governance",()=>{
 it("preserves immutable P32 provenance and imports only 11 reviewed feature paths",()=>{
  expect(p35).toMatchObject({schema:"servicedesk.p35.p33-a18-exact-source-lock.v1",
    sourceOnly:true,canonicalBase:"cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411",
    p32IntegrationHead:"224f88ce76525bc0235acecb9e45a9ec34c9aaaa",
    sourceFileCount:11,changesRelativeToP32:{added:7,modified:4}});
  expect(p32.fileCount).toBe(17);
  expect(p32.canonicalBase).toBe(p35.canonicalBase);
  expect(p35.files).toHaveLength(11);
  expect(new Set(p35.files.map(f=>f.path)).size).toBe(11);
  expect(p35.files.filter(f=>f.sourcePr===896)).toHaveLength(5);
  expect(p35.files.filter(f=>f.sourcePr===905)).toHaveLength(6);
  expect(p35.sourceHeads).toEqual({
   "896":"18f34b40f5f3d5a876ea89324dd3db3f84ae3100",
   "905":"cad14f9a1c6237db2cb8092fd2c07694fbec4a59",
  });
  const parentPaths=new Set(p32.files.map(f=>f.path));
  expect(p35.files.some(f=>parentPaths.has(f.path))).toBe(false);
 });
 it("matches every source Git blob byte for byte, including original P32 feature locks",()=>{
  for(const file of [...p35.files,...p32.files]){
   expect(file.gitBlobSha).toMatch(/^[0-9a-f]{40}$/);
   expect(blobSha(file.path),file.path).toBe(file.gitBlobSha);
  }
 });
 it("keeps the owner-route activation and owner-only saved attention functionality",()=>{
  const route=readFileSync("src/features/operations/OperationalProductRoute.tsx","utf8");
  expect(route.split('<OwnerOverdueAttentionReview workspaceSlug={workspaceSlug} />').length-1).toBe(2);
  expect(route).toContain('data.actor.role === "OWNER" ? <OwnerOverdueAttentionReview');
  const control=readFileSync("src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx","utf8");
  expect(control).toContain("buildOwnerActivationNextAction(activation, canOpenFirstRunPricing)");
  expect(control).toContain("Disable automatic internal follow-up");
  const action=readFileSync("src/features/operations/owner-attention-review-action.ts","utf8");
  expect(action).toContain("loadOwnerAttentionSla(workspaceSlug)");
  expect(action).toContain("projectOwnerAttentionReview(source)");
 });
 it("never equates a source-green draft with two-owner P02 or live action",()=>{
  expect(p35).toMatchObject({
   liveRegistrationGuardAuthorized:false,liveDatabaseMutationAuthorized:false,
   liveProviderDeliveryVerified:false,realTwoOwnerUatVerified:false,
   productionDeploymentAuthorized:false,canonicalMergeAuthorized:false,
  });
  const p33=readFileSync("src/features/operations/owner-activation-next-action.ts","utf8");
  const a18=readFileSync("src/features/operations/owner-attention-review-projection.ts","utf8");
  expect(p33).toContain("providerDeliveryVerified: false");
  expect(a18).toContain("providerDeliveryVerified:false");
 });
});
