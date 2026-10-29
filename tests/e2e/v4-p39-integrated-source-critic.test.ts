import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lock=JSON.parse(readFileSync(
 "docs/delivery/sonic-p04-p39-source-integrity-20261029.json","utf8"
)) as {schema:string;state:string;fileCount:number;exactImportedFileCount:number;composedFileCount:number;
 sourceHeads:Record<string,string>;forbiddenEffects:string[];
 composedSourceOverlays:Array<{path:string;composedGitBlobSha:string}>;
 files:Array<{path:string;sourcePr:number;gitBlobSha:string}>};

describe("P39 independent owner setup + quote preflight + timezone expiry source critic",()=>{
 it("retains nine isolated source owners, 28 exact files and one explicitly composed onboarding route",()=>{
   expect(lock.schema).toBe("servicedesk.p39.source-integrity.v1");
   expect(lock.state).toBe("P04_SOURCE_ONLY_NOT_ACCEPTED");
   expect(lock.fileCount).toBe(29);
   expect(lock.files).toHaveLength(29);
   expect(lock.exactImportedFileCount).toBe(28);
   expect(lock.composedFileCount).toBe(1);
   expect(lock.composedSourceOverlays).toHaveLength(1);
   expect(new Set(lock.files.map(f=>f.path)).size).toBe(29);
   for(const [pr,count] of [["876",6],["877",2],["879",2],["880",4],
     ["882",3],["885",3],["886",2],["888",4],["890",3]] as const){
     expect(lock.sourceHeads[pr]).toMatch(/^[a-f0-9]{40}$/);
     expect(lock.files.filter(f=>String(f.sourcePr)===pr)).toHaveLength(count);
   }
 });
 it("matches every effective source object using the real Git blob SHA-1",()=>{
   for(const f of lock.files){
     expect(f.path).not.toContain("..");
     expect(f.path).not.toMatch(/migrations|credentials|secrets|deploy/i);
     const bytes=readFileSync(join(process.cwd(),f.path));
     const actual=createHash("sha1")
       .update(Buffer.from("blob "+bytes.length+"\0"))
       .update(bytes).digest("hex");
     expect(actual,f.path).toBe(f.gitBlobSha);
   }
 });
 it("keeps the source preflight, customer decision and staff queue clocks aligned",()=>{
   const quote=readFileSync("src/features/operations/request-quote-price-readiness.ts","utf8");
   const pipeline=readFileSync("src/features/operations/quote-pipeline.ts","utf8");
   const clock=readFileSync("src/features/operations/quote-validity-clock.ts","utf8");
   expect(quote).toContain("proof.existingBookBranchIds");
   expect(quote).toContain('authorized.currency !== "USD"');
   expect(quote).not.toContain("proof.activeBranchIds.length === 1");
   expect(pipeline).toContain('import { trustedQuoteInstant } from "./quote-validity-clock"');
   expect(pipeline).toContain("now === null || expires === null || expires <= now");
   expect(clock).toContain("explicit timezone");
   expect(pipeline).not.toContain(".rpc(");
   expect(quote).not.toContain("service_role");
 });
 it("preserves human-reviewed owner setup and never conflates it with live provider delivery",()=>{
   const onboarding=readFileSync("src/features/onboarding/OnboardingProductRoute.tsx","utf8");
   const automation=readFileSync("src/features/operations/OwnerAutomationActivationChecklist.tsx","utf8");
   expect(onboarding).toContain("OwnerCommercialActionPanel");
   expect(onboarding).toContain("supportedCleaningTypes > 0");
   expect(automation).toContain("planOwnerAutomationNextAction(summary, canOpenPricingForm)");
   for(const effect of ["DATABASE_DDL","QA_AUTH_MUTATION","PROVIDER_SEND","PAYMENT","DEPLOYMENT","MERGE"])
     expect(lock.forbiddenEffects).toContain(effect);
 });
});
