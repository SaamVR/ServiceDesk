import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Provenance = {
  schema: string;
  releaseBoundary: string;
  integrationParent: string;
  sourceHeads: Record<string, string>;
  files: Array<{ path: string; sourcePr: number; gitBlobSha: string }>;
};
const read = (name: string) => readFileSync(join(process.cwd(), name));
const lock = JSON.parse(read("docs/delivery/sonic-p03-p34-source-provenance-20261029.json").toString()) as Provenance;
const p36Successor = JSON.parse(read("docs/delivery/sonic-p03-p36-source-provenance-20261029.json").toString()) as {
  integrationParent: string; sourceHeads: Record<string,string>;
  files: Array<{path:string; sourcePr:number; gitBlobSha:string}>;
};
const priorReviewBlobs: Record<string,string> = {
  "src/features/operations/OwnerAutomationActivationChecklist.tsx":
    "7fa644c26d915a3abf9968d563a44c2906c72e48",
  "src/features/operations/OwnerAutomationActivationChecklist.module.css":
    "06b5a1746b7fd342b86e1c3d37bae594f05ede74",
};
function reviewedSuccessor(path: string, historicalSha: string): string {
  const successor = p36Successor.files.find(file => file.path === path);
  if (!successor) return historicalSha;
  expect(priorReviewBlobs[path]).toBe(historicalSha);
  expect(successor.sourcePr).toBe(898);
  expect(p36Successor.sourceHeads["898"]).toBe("023dc0a15fbf3becd9849b5ff1891ca51e260dda");
  expect(p36Successor.integrationParent).toBe("27261bc46666c2bed1c78599679485d7366fa83b");
  return successor.gitBlobSha;
}
const gitBlob = (bytes: Buffer) => createHash("sha1")
  .update(Buffer.from(`blob ${bytes.length}\\0`.replace("\\0", "\u0000")))
  .update(bytes).digest("hex");

describe("P34 independent exact-source and safety critic", () => {
  it("locks every of six integrated source bytes to the reviewed P33 Git objects", () => {
    expect(lock.schema).toBe("servicedesk.p34.reviewed-source-objects.v1");
    expect(lock.releaseBoundary).toContain("NO_PRODUCTION_MUTATIONS");
    expect(lock.integrationParent).toBe("224f88ce76525bc0235acecb9e45a9ec34c9aaaa");
    expect(lock.sourceHeads).toMatchObject({
      891: "cc0ba17bb70f635f8ffbd32055d3bdd82bfd29bb",
      892: "c7dd8fc7d8501aae2989a412da16d619b2cf172a",
    });
    expect(lock.files).toHaveLength(6);
    expect(new Set(lock.files.map(item => item.path)).size).toBe(6);
    for (const item of lock.files) {
      expect([891, 892]).toContain(item.sourcePr);
      expect(item.path).toMatch(/^(src\/features\/operations\/|tests\/e2e\/)/);
      expect(gitBlob(read(item.path))).toBe(reviewedSuccessor(item.path,item.gitBlobSha));
    }
  });
  it("keeps owner attention diagnostics inside existing authorized owner UI", () => {
    const ui = read("src/features/operations/OwnerAutomationActivationChecklist.tsx").toString();
    const triage = read("src/features/operations/owner-attention-triage.ts").toString();
    const activation = read("src/features/operations/owner-automation-activation.ts").toString();
    expect(ui).toContain("summarizeOwnerAttentionTriage(data)");
    expect(ui).toContain("data.actor?.role === \"OWNER\"");
    expect(triage).toContain('scope.mode === "BRANCH"');
    expect(triage).toContain('row.mode === "LIVE"');
    expect(activation).toContain("latest.length !== 1");
    for (const source of [triage, activation]) {
      expect(source).not.toMatch(/fetch\s*\(|createClient\s*\(|\.rpc\s*\(|process\.env/);
    }
  });
});
