import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source=JSON.parse(readFileSync(
  "docs/delivery/sonic-p03-p35-source-integrity-20261029.json","utf8"
)) as {
 schema:string;state:string;fileCount:number;exactImportedFileCount:number;
 composedFileCount:number;canonicalBase:string;sourceHeads:Record<string,string>;
 forbiddenEffects:string[];
 composedSourceOverlays:Array<{path:string;primarySourcePr:number;primarySourceBlob:string;
   secondarySourcePr:number;secondarySourceBlob:string;composedGitBlobSha:string}>;
 files:Array<{path:string;sourcePr:number;gitBlobSha:string}>;
};

describe("P35 seven-lane source-only owner activation / pricing integration",()=>{
  it("tracks 21 byte-exact source objects and the separately reviewed composed owner route",()=>{
    expect(source.schema).toBe("servicedesk.p35.source-integrity.v1");
    expect(source.state).toBe("P03_SOURCE_ONLY_NOT_ACCEPTED");
    expect(source.canonicalBase).toBe("cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411");
    expect(source.fileCount).toBe(22);
    expect(source.files).toHaveLength(22);
    expect(source.exactImportedFileCount).toBe(21);
    expect(source.composedFileCount).toBe(1);
    expect(source.composedSourceOverlays).toHaveLength(1);
    expect(new Set(source.files.map(f=>f.path)).size).toBe(22);
    const count: Record<string,number>={"876":6,"877":2,"879":2,"880":4,"882":3,"885":3,"886":2};
    for(const [owner,n] of Object.entries(count)){
      expect(source.sourceHeads[owner]).toMatch(/^[a-f\d]{40}$/);
      expect(source.files.filter(f=>String(f.sourcePr)===owner)).toHaveLength(n);
    }
  });
  it("recomputes each effective current Git blob rather than trusting a filename",()=>{
    for(const entry of source.files){
      expect(entry.path).not.toContain("..");
      expect(entry.path.startsWith("src/")||entry.path.startsWith("tests/")||
        entry.path.startsWith("docs/delivery/")).toBe(true);
      expect(entry.path).not.toMatch(/migration|credential|secret|deploy/i);
      const bytes=readFileSync(join(process.cwd(),entry.path));
      const sha=createHash("sha1")
        .update(Buffer.from("blob "+bytes.length+"\0"))
        .update(bytes).digest("hex");
      expect(sha,entry.path).toBe(entry.gitBlobSha);
    }
  });
  it("discloses exact composed P31+P34 source preimages instead of claiming byte equality",()=>{
    const overlay=source.composedSourceOverlays[0];
    expect(overlay.path).toBe("src/features/onboarding/OnboardingProductRoute.tsx");
    expect(overlay.primarySourcePr).toBe(882);
    expect(overlay.secondarySourcePr).toBe(886);
    for(const h of [overlay.primarySourceBlob,overlay.secondarySourceBlob,overlay.composedGitBlobSha])
      expect(h).toMatch(/^[a-f\d]{40}$/);
    expect(overlay.primarySourceBlob).not.toBe(overlay.composedGitBlobSha);
    expect(overlay.secondarySourceBlob).not.toBe(overlay.composedGitBlobSha);
    expect(overlay.composedGitBlobSha).toBe(source.files.find(f=>f.path===overlay.path)?.gitBlobSha);
    const route=readFileSync(overlay.path,"utf8");
    expect(route).toContain("supportedCleaningTypes > 0");
    expect(route).toContain("describeSavedCleaningCatalog(");
    expect(route).toContain("OwnerCommercialActionPanel");
    expect(route).toContain("evidence={commercial}");
    expect(route).toContain("loadOnboardingProduct(workspaceSlug)");
  });
  it("limits owner-next-action and pricing to navigation and saved evidence, not active provider effects",()=>{
    const owner=readFileSync("src/features/operations/OwnerAutomationActivationChecklist.tsx","utf8");
    const pricing=readFileSync("src/features/onboarding/OwnerCommercialActionPanel.tsx","utf8");
    expect(owner).toContain("planOwnerAutomationNextAction(summary, canOpenPricingForm)");
    expect(pricing).toContain("canEnterFirstRunRates");
    expect(pricing).toContain("Owner pricing next actions");
    expect(owner).not.toContain(".rpc(");
    expect(pricing).not.toContain(".rpc(");
    expect(pricing).not.toContain("fetch(");
    for(const effect of ["DATABASE_DDL","QA_AUTH_MUTATION","PROVIDER_SEND","PAYMENT","DEPLOYMENT","MERGE"])
      expect(source.forbiddenEffects).toContain(effect);
  });
});
