import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path));
const lock = JSON.parse(read("docs/delivery/sonic-p03-p36-source-provenance-20261029.json").toString()) as {
  schema:string; release:string; integrationParent:string; canonical:string;
  sourceHeads:Record<string,string>; forbiddenEffects:string[];
  files:Array<{path:string;sourcePr:number;gitBlobSha:string}>;
};
const hash = (content:Buffer) => createHash("sha1")
  .update(Buffer.from("blob " + content.length + "\0"))
  .update(content).digest("hex");

// Historical IR14 and P36 locks remain immutable. The IR15 route joins
// both previously reviewed owner journeys and must match one exact object.
const integration = JSON.parse(readFileSync(
 "docs/delivery/sonic-ir15-p36-f14-union-source-lock-20261030.json","utf8"
)) as {
 baseP36:string; ir14ReviewedPr:number; ir14Head:string; status:string;
 reconciledRoute:{path:string;ir14OriginalSha:string;p36OriginalSha:string;reviewedIntegratedSha:string};
};
function reviewedUnionSuccessor(path:string,previousBlob:string):string {
 const route=integration.reconciledRoute;
 if(path!==route.path)return previousBlob;
 expect(integration.status).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
 expect(integration.baseP36).toBe("cb28d52912c4d2b2ad4e8b663b339db3241a3c84");
 expect(integration.ir14ReviewedPr).toBe(865);
 expect(integration.ir14Head).toBe("5bd1d365c6afd149f3619ffe5317231fd8a7de6f");
 expect(previousBlob).toBe("ff928ec32e264d53e651c4fe38775f7f7737f5fe");
 expect(route.reviewedIntegratedSha).toBe("189cd79e072789fe121c24a076a0874b41dcca7e");
 return route.reviewedIntegratedSha;
}

describe("P36 independent exact-source and production-boundary critic",()=>{
  it("pins eight imported source objects to their exact P35 PR Git hashes",()=>{
    expect(lock.schema).toBe("servicedesk.p36.exact-reviewed-source.v1");
    expect(lock.release).toContain("SOURCE_ONLY");
    expect(lock.integrationParent).toBe("27261bc46666c2bed1c78599679485d7366fa83b");
    expect(lock.canonical).toBe("cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411");
    expect(lock.sourceHeads).toMatchObject({
      "895":"5b9e2f4e8fab9901d901e825cb17b84cf4b67330",
      "898":"023dc0a15fbf3becd9849b5ff1891ca51e260dda",
    });
    expect(lock.files).toHaveLength(8);
    expect(new Set(lock.files.map(f=>f.path)).size).toBe(8);
    expect(lock.files.filter(f=>f.sourcePr===895)).toHaveLength(4);
    expect(lock.files.filter(f=>f.sourcePr===898)).toHaveLength(4);
    for (const f of lock.files) {
      expect(f.path).toMatch(/^(src\/features\/operations\/|tests\/e2e\/)/);
      expect(f.path).not.toContain("..");
      expect(hash(read(f.path))).toBe(reviewedUnionSuccessor(f.path, f.gitBlobSha));
    }
  });
  it("confirms pricing form is conditional on selected USD branch and owned version",()=>{
    const form = read("src/features/operations/OwnerCleaningPricingSetupForm.tsx").toString();
    const helper = read("src/features/operations/owner-pricing-revision-access.ts").toString();
    expect(form).toContain("assessOwnerPricingRevisionAccess(scope, repairTarget)");
    expect(form).toContain("ownerRevisionAcknowledged");
    expect(form).toContain("expectedBookVersion");
    const route = read("src/features/operations/OperationalProductRoute.tsx").toString();
    expect(route).toMatch(/scope=\{data\.branchScope\}\s+repairTarget=\{book\}/);
    expect(helper).toContain('scope.mode === "BRANCH"');
    expect(helper).toContain('matches[0].currency !== "USD"');
    expect(helper).not.toMatch(/fetch\s*\(|\.rpc\s*\(|createClient\s*\(/);
    expect(form).not.toContain("fetch(");
  });
  it("keeps saved-evidence playbook suggestions internal-only and owner scoped",()=>{
    const suggest = read("src/features/operations/owner-automation-draft-recommendations.ts").toString();
    const ui = read("src/features/operations/OwnerAutomationActivationChecklist.tsx").toString();
    expect(suggest).toContain("OWNER_REVIEW_DRAFT_ONLY");
    expect(ui).toContain('data.actor?.role === "OWNER" && draftStarters.length > 0');
    expect(ui).toContain("Inspect draft starter");
    for(const path of [suggest,ui]) {
      expect(path).not.toMatch(/\.rpc\s*\(|process\.env/);
    }
    for (const effect of ["PRODUCTION_DB_MUTATION","AUTH_USER_CREATION",
      "PROVIDER_SEND","PAYMENT","DEPLOYMENT","CANONICAL_MERGE"]) {
      expect(lock.forbiddenEffects).toContain(effect);
    }
  });
});
