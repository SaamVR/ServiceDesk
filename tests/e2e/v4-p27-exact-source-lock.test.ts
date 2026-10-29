import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath="docs/delivery/sonic-p03-p27-exact-source-lock-20261029.json";
const manifest=JSON.parse(readFileSync(manifestPath,"utf8")) as {
  schema:string; canonicalBase:string; releaseCandidate:string;
  sourceHeads:Record<string,string>; sourceFileCount:number;
  forbiddenEffects:string[];
  files:Array<{path:string; sourcePr:number; status:"added"|"modified";gitBlobSha:string}>;
};

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

describe("P27 independent exact-source integration and release boundary",()=>{
  it("imports exactly the eight disjoint source files from PR876 and PR877",()=>{
    expect(manifest.schema).toBe("servicedesk.p27.exact-source-lock.v1");
    expect(manifest.releaseCandidate).toBe("P03_SOURCE_ONLY_NOT_APPROVED");
    expect(manifest.canonicalBase).toBe("cd218fcf196b7046c0bf6d7c0b990bb8d6bf9411");
    expect(manifest.sourceHeads["876"]).toBe("ad9072d58bdba7f7238ec4cb92ac3d2e7467a174");
    expect(manifest.sourceHeads["877"]).toBe("9ebcba822a9cf1410fdce7dbee08588b1b958c7b");
    expect(manifest.sourceFileCount).toBe(8);
    expect(manifest.files).toHaveLength(8);
    expect(new Set(manifest.files.map(x=>x.path)).size).toBe(8);
    expect(manifest.files.filter(x=>x.sourcePr===876)).toHaveLength(6);
    expect(manifest.files.filter(x=>x.sourcePr===877)).toHaveLength(2);
    expect(manifest.files.filter(x=>x.status==="added")).toHaveLength(3);
  });
  it("pins each imported file to the exact Git blob SHA-1, not just a filename",()=>{
    for(const item of manifest.files){
      expect(item.path).not.toMatch(/^\.(?:github|env)/);
      expect(item.path).not.toMatch(/^(?:supabase|migrations|scripts\/deploy)\//);
      expect(item.path.includes("..")).toBe(false);
      expect(item.gitBlobSha).toMatch(/^[a-f0-9]{40}$/);
      const bytes=readFileSync(join(process.cwd(),item.path));
      const actual=createHash("sha1")
        .update(Buffer.from("blob "+bytes.length+"\0"))
        .update(bytes).digest("hex");
      expect(actual,item.path+" differs from pinned reviewed source").toBe(checkedP36PricingSuccessor(item.path,item.gitBlobSha) ?? item.gitBlobSha);
    }
  });
  it("does not confuse owner guidance with an executed SQL, financial or provider action",()=>{
    const banner=readFileSync("src/features/operations/CatalogReadinessBanner.tsx","utf8");
    const form=readFileSync("src/features/operations/OwnerCleaningPricingSetupForm.tsx","utf8");
    expect(banner).toContain("invalidSaved.length > 0");
    expect(banner).toContain("unconfigured.length > 0");
    expect(form).toContain("First-run setup cannot overwrite existing rates");
    expect(form).toContain("Saved branch pricing could not be verified");
    expect(banner).not.toContain(".rpc(");
    expect(form).not.toContain("service_role");
    for(const effect of ["DATABASE_DDL","QA_AUTH_MUTATION","PROVIDER_SEND","PAYMENT","DEPLOYMENT","MERGE"])
      expect(manifest.forbiddenEffects).toContain(effect);
  });
});
