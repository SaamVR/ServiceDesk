import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lock=JSON.parse(readFileSync(
  "docs/delivery/sonic-p03-p30-source-provenance-20261029.json","utf8"
)) as {
  schema:string;state:string;canonicalBase:string;fileCount:number;
  sourceHeads:Record<string,string>;forbiddenEffects:string[];
  files:Array<{path:string;sourcePr:number;gitBlobSha:string;status:string}>;
};

describe("P30 independently reviewed source-only pricing/onboarding/automation integration",()=>{
  it("pins four disjoint owner branches and all 14 expected source blobs",()=>{
    expect(lock.schema).toBe("servicedesk.p30.exact-source-lock.v1");
    expect(lock.state).toBe("P03_DRAFT_SOURCE_ONLY");
    expect(lock.canonicalBase).toBe("cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411");
    expect(lock.fileCount).toBe(14);
    expect(lock.files).toHaveLength(14);
    expect(new Set(lock.files.map(x=>x.path)).size).toBe(14);
    for (const [pr,count] of [["876",6],["877",2],["879",2],["880",4]] as const) {
      expect(lock.sourceHeads[pr]).toMatch(/^[a-f0-9]{40}$/);
      expect(lock.files.filter(item=>String(item.sourcePr)===pr)).toHaveLength(count);
    }
  });
  it("checks real git blob SHA1 bytes rather than trusting claims or filenames",()=>{
    for(const file of lock.files){
      expect(file.path.startsWith("src/")||file.path.startsWith("tests/")||
        file.path.startsWith("docs/delivery/")).toBe(true);
      expect(file.path).not.toContain("..");
      expect(file.path).not.toMatch(/(?:migration|deploy|secret|credential)/i);
      const bytes=readFileSync(join(process.cwd(),file.path));
      const actual=createHash("sha1")
        .update(Buffer.from("blob "+bytes.length+"\0"))
        .update(bytes).digest("hex");
      expect(actual,file.path+" exact source mismatch").toBe(file.gitBlobSha);
    }
  });
  it("retains meaningful saved-data guardrails without injecting provider or mutation paths",()=>{
    const onboarding=readFileSync("src/features/onboarding/onboarding-commercial-readiness.ts","utf8");
    const activation=readFileSync("src/features/operations/owner-automation-activation.ts","utf8");
    const banner=readFileSync("src/features/operations/CatalogReadinessBanner.tsx","utf8");
    expect(onboarding).toContain("repairPriceBookBranches: invalidSaved.length");
    expect(onboarding).toContain("priced.some(id");
    expect(activation).toContain("countQuoteableCleaningServices(data.serviceCatalog)");
    expect(activation).toContain("pricingInventoryVerified");
    expect(banner).toContain("invalidSaved.length > 0");
    expect(banner).toContain("unconfigured.length > 0");
    expect(onboarding).not.toContain(".rpc(");
    expect(activation).not.toContain("fetch(");
    for(const effect of ["DATABASE_DDL","QA_AUTH_MUTATION","PROVIDER_SEND","PAYMENT","DEPLOYMENT","MERGE"])
      expect(lock.forbiddenEffects).toContain(effect);
  });
});
