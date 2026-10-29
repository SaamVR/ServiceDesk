import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lock=JSON.parse(readFileSync(
  "docs/delivery/sonic-p04-p37-source-integrity-20261029.json","utf8"
)) as {
 schema:string;state:string;fileCount:number;exactImportedFileCount:number;
 composedFileCount:number;sourceHeads:Record<string,string>;forbiddenEffects:string[];
 composedSourceOverlays:Array<{path:string;primarySourceBlob:string;
 secondarySourceBlob:string;composedGitBlobSha:string}>;
 files:Array<{path:string;sourcePr:number;gitBlobSha:string}>;
};

describe("P37 independent source guardian for owner setup → quote preflight",()=>{
 it("pins 26 current source blobs, including one explicitly reviewed P31+P34 composition",()=>{
  expect(lock.schema).toBe("servicedesk.p37.source-integrity.v1");
  expect(lock.state).toBe("P04_SOURCE_ONLY_NOT_ACCEPTED");
  expect(lock.fileCount).toBe(26);
  expect(lock.files).toHaveLength(26);
  expect(lock.exactImportedFileCount).toBe(25);
  expect(lock.composedFileCount).toBe(1);
  expect(new Set(lock.files.map(x=>x.path)).size).toBe(26);
  expect(lock.composedSourceOverlays).toHaveLength(1);
  expect(lock.composedSourceOverlays[0].path).toBe("src/features/onboarding/OnboardingProductRoute.tsx");
  for(const [pr,count] of [["876",6],["877",2],["879",2],["880",4],
      ["882",3],["885",3],["886",2],["888",4]] as const){
    expect(lock.sourceHeads[pr]).toMatch(/^[a-f0-9]{40}$/);
    expect(lock.files.filter(x=>String(x.sourcePr)===pr)).toHaveLength(count);
  }
 });
 it("verifies each imported or composed source file by Git byte hash",()=>{
  for(const x of lock.files){
    expect(x.path).not.toContain("..");
    expect(x.path).not.toMatch(/migrations|credentials|secrets|deploy/i);
    const bytes=readFileSync(join(process.cwd(),x.path));
    const hash=createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0"))
      .update(bytes).digest("hex");
    expect(hash,x.path).toBe(x.gitBlobSha);
  }
 });
 it("requires signed-in authorized owner branch, saved book proof and server quote authorization",()=>{
  const quote=readFileSync("src/features/operations/request-quote-price-readiness.ts","utf8");
  const route=readFileSync("src/features/operations/OperationalProductRoute.tsx","utf8");
  const activation=readFileSync("src/features/operations/OwnerAutomationActivationChecklist.tsx","utf8");
  const onboarding=readFileSync("src/features/onboarding/OnboardingProductRoute.tsx","utf8");
  expect(quote).toContain("proof.existingBookBranchIds");
  expect(quote).toContain('authorized.currency !== "USD"');
  expect(quote).toContain("scope.selectedBranchId === candidate");
  expect(quote).not.toContain("proof.activeBranchIds.length === 1");
  expect(route).toContain("calculateOperationalQuote(workspaceSlug, requestId,");
  expect(activation).toContain("planOwnerAutomationNextAction(summary, canOpenPricingForm)");
  expect(onboarding).toContain("OwnerCommercialActionPanel");
  expect(onboarding).toContain("supportedCleaningTypes > 0");
  expect(quote).not.toContain("service_role");
  expect(quote).not.toContain(".rpc(");
  for(const effect of ["DATABASE_DDL","QA_AUTH_MUTATION","PROVIDER_SEND","PAYMENT","DEPLOYMENT","MERGE"])
    expect(lock.forbiddenEffects).toContain(effect);
 });
});
