import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const provenance=JSON.parse(readFileSync(
  "docs/delivery/sonic-p03-p32-source-provenance-20261029.json","utf8"
)) as {
  schema:string;state:string;fileCount:number;canonicalBase:string;
  sourceHeads:Record<string,string>;forbiddenEffects:string[];
  files:Array<{path:string;gitBlobSha:string;sourcePr:number;status:string}>;
};

// Historical P30/P32 source locks remain immutable. A later source-only
// composite may supersede one exact blob only when the P34 successor lock
// names the reviewed source PR, pinned head, and the same file path.
const p34Successor=JSON.parse(readFileSync(
  "docs/delivery/sonic-p03-p34-source-provenance-20261029.json","utf8"
)) as {
  integrationParent:string;
  sourceHeads:Record<string,string>;
  files:Array<{path:string;sourcePr:number;gitBlobSha:string}>;
};
const expectedPriorActivationBlob="5c24ee15b057d2157d527e7d7ae87973887753ad";
function currentOrReviewedSuccessor(path:string, historicalSha:string):string {
  const pricing=checkedP36PricingSuccessor(path,historicalSha);
  if(pricing)return pricing;
  const successor=p34Successor.files.find(file=>file.path===path);
  if (!successor) return historicalSha;
  expect(path).toBe("src/features/operations/owner-automation-activation.ts");
  expect(historicalSha).toBe(expectedPriorActivationBlob);
  expect(p34Successor.integrationParent).toBe("224f88ce76525bc0235acecb9e45a9ec34c9aaaa");
  expect(successor.sourcePr).toBe(891);
  expect(p34Successor.sourceHeads["891"]).toBe("cc0ba17bb70f635f8ffbd32055d3bdd82bfd29bb");
  return successor.gitBlobSha;
}

// Preserve the historical P27/P30/P32 lock. P36 may supersede only this
// exact reviewed pricing form blob with the approved P35 source object.
const p36PricingSuccessor=JSON.parse(readFileSync(
  "docs/delivery/sonic-p03-p36-source-provenance-20261029.json","utf8"
)) as { integrationParent:string; sourceHeads:Record<string,string>;
  files:Array<{path:string;sourcePr:number;gitBlobSha:string}> };
const priorPricingBlob="06132ba797602c2c6fd57f851781403961cdbb3f";
function checkedP36PricingSuccessor(path:string,oldSha:string):string|null {
  if(path!=="src/features/operations/OwnerCleaningPricingSetupForm.tsx")return null;
  expect(oldSha).toBe(priorPricingBlob);
  expect(p36PricingSuccessor.integrationParent).toBe("27261bc46666c2bed1c78599679485d7366fa83b");
  expect(p36PricingSuccessor.sourceHeads["895"]).toBe("5b9e2f4e8fab9901d901e825cb17b84cf4b67330");
  const found=p36PricingSuccessor.files.find(item=>item.path===path);
  expect(found?.sourcePr).toBe(895);
  expect(found?.gitBlobSha).toMatch(/^[a-f0-9]{40}$/);
  return found!.gitBlobSha;
}

describe("P32 exact owner onboarding and automation feature provenance",()=>{
 it("pins 17 disjoint files across five frozen source owners, not a production release",()=>{
   expect(provenance.schema).toBe("servicedesk.p32.exact-source-lock.v1");
   expect(provenance.state).toBe("P03_DRAFT_SOURCE_ONLY");
   expect(provenance.canonicalBase).toBe("cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411");
   expect(provenance.files).toHaveLength(17);
   expect(provenance.fileCount).toBe(17);
   expect(new Set(provenance.files.map(f=>f.path)).size).toBe(17);
   for(const [owner,count] of [["876",6],["877",2],["879",2],["880",4],["882",3]] as const){
     expect(provenance.sourceHeads[owner]).toMatch(/^[a-f\d]{40}$/);
     expect(provenance.files.filter(f=>String(f.sourcePr)===owner)).toHaveLength(count);
   }
 });
 it("verifies actual Git SHA1 blob bytes instead of trusting recorded filenames",()=>{
   for(const f of provenance.files){
     expect(f.path).not.toMatch(/^\.(?:env|github)/);
     expect(f.path).not.toMatch(/(?:supabase\/migrations|scripts\/deploy)/);
     expect(f.path).not.toContain("..");
     const body=readFileSync(join(process.cwd(),f.path));
     const actual=createHash("sha1")
       .update(Buffer.from("blob "+body.length+"\0"))
       .update(body).digest("hex");
     expect(actual,f.path).toBe(currentOrReviewedSuccessor(f.path,f.gitBlobSha));
   }
 });
 it("preserves owner-only saved evidence and refuses unsupported cleaning services",()=>{
   const route=readFileSync("src/features/onboarding/OnboardingProductRoute.tsx","utf8");
   const helper=readFileSync("src/features/onboarding/onboarding-cleaning-catalog-copy.ts","utf8");
   const commercial=readFileSync("src/features/onboarding/onboarding-commercial-readiness.ts","utf8");
   const activation=readFileSync("src/features/operations/owner-automation-activation.ts","utf8");
   expect(route).toContain("commercial.quoteableCleaningServices > 0");
   expect(route).toContain("supportedCleaningTypes > 0");
   expect(route).toContain("describeSavedCleaningCatalog(");
   expect(helper).toContain("countDistinctSupportedCleaningTypes(");
   expect(commercial).toContain("repairPriceBookBranches: invalidSaved.length");
   expect(activation).toContain("pricingInventoryVerified");
   expect(activation).toContain("countQuoteableCleaningServices(data.serviceCatalog)");
   expect(helper).not.toContain("fetch(");
   expect(route).toContain("loadOnboardingProduct(workspaceSlug)");
   for(const x of ["DATABASE_DDL","QA_AUTH_MUTATION","PROVIDER_SEND","PAYMENT","DEPLOYMENT","MERGE"])
     expect(provenance.forbiddenEffects).toContain(x);
 });
});
