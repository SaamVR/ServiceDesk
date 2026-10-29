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
     expect(actual,f.path).toBe(f.gitBlobSha);
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
