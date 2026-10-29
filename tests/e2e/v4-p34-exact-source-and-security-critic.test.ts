import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
// Preserve the original P34 source journal unchanged. A later reviewed P42
// composite may supersede ONLY these two presentation/triage files, and only
// with the explicitly proven P40/P41 Git blobs and source commit identities.
const p42Path = "docs/delivery/sonic-p03-p42-source-provenance-20261029.json";
const p42 = existsSync(join(process.cwd(), p42Path))
  ? JSON.parse(read(p42Path).toString()) as {
      files: Record<string, { gitBlobSha: string; source: string }>;
      sources: Record<string, { commit: string }>;
      base: { commit: string };
    }
  : null;
const p44Path = "docs/delivery/sonic-p03-p44-source-provenance-20261029.json";
const p44 = existsSync(join(process.cwd(), p44Path))
  ? JSON.parse(read(p44Path).toString()) as {
      files: Record<string, { gitBlobSha: string }>;
      previousTriage: { p34: string; p42: string };
      importedFrom: { head: string };
    }
  : null;
const p43 = p44
  ? JSON.parse(read("docs/delivery/sonic-p03-p43-attention-lineage-20261029.json").toString()) as {
      originalP34Blob: string;
      parent: { sourceBlob: string };
      successor: { path: string; gitBlobSha: string };
    }
  : null;
const successors: Record<string, { old: string; next: string; lane: string; head: string }> = {
  "src/features/operations/owner-attention-triage.ts": {
    old: "752543fcf25178bd6ad2da16a324f50a569a6be0",
    next: "600c9e1d69fe22e7c7308a1901de2b056b3513c6",
    lane: "P41", head: "0cf421a0da26b37550599aa10418a5eeb4e6aaa1",
  },
  "src/features/operations/OwnerAutomationActivationChecklist.tsx": {
    old: "7fa644c26d915a3abf9968d563a44c2906c72e48",
    next: "33bacc933867c4c14ea933a62c52a951e9c820f6",
    lane: "P40", head: "d6b19c09fbfcd827a9aadae6f83c26e5b8d7fe8c",
  },
};
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
      const successor = p42 ? successors[item.path] : undefined;
      if (p44 && item.path === "src/features/operations/owner-attention-triage.ts") {
        // Two immutable predecessor manifests survive. This third revision
        // must match the exact reviewed P43 Git blob, never an arbitrary file.
        expect(item.gitBlobSha).toBe(successors[item.path].old);
        expect(p42?.files[item.path]?.gitBlobSha).toBe(p44.previousTriage.p42);
        expect(p43?.originalP34Blob).toBe(item.gitBlobSha);
        expect(p43?.parent.sourceBlob).toBe(p44.previousTriage.p42);
        expect(p43?.successor).toMatchObject({
          path: item.path, gitBlobSha: "706f21c1b28209cc022281fdf1631dc3eb6bfa54",
        });
        expect(p44.importedFrom.head).toBe("2e1f44255501b9faef965a63374d80538bf59fe0");
        expect(p44.files[item.path]?.gitBlobSha).toBe(p43?.successor.gitBlobSha);
        expect(gitBlob(read(item.path))).toBe(p43?.successor.gitBlobSha);
      } else if (!successor) {
        expect(gitBlob(read(item.path))).toBe(item.gitBlobSha);
      } else {
        // The original P34 hash remains frozen in the historical manifest.
        // Only reviewed, exact-object P42 successors may replace it.
        expect(item.gitBlobSha).toBe(successor.old);
        expect(p42?.base.commit).toBe("27261bc46666c2bed1c78599679485d7366fa83b");
        expect(p42?.files[item.path]).toMatchObject({
          gitBlobSha: successor.next, source: successor.lane,
        });
        expect(p42?.sources[successor.lane]?.commit).toBe(successor.head);
        expect(gitBlob(read(item.path))).toBe(successor.next);
      }
    }
  });
  it("keeps owner attention diagnostics inside existing authorized owner UI", () => {
    const ui = read("src/features/operations/OwnerAutomationActivationChecklist.tsx").toString();
    const triage = read("src/features/operations/owner-attention-triage.ts").toString();
    const activation = read("src/features/operations/owner-automation-activation.ts").toString();
    expect(ui).toContain("summarizeOwnerAttentionTriage(data)");
    expect(ui).toContain("data.actor?.role === \"OWNER\"");
    expect(triage).toContain('scope.mode === "BRANCH"');
    if (p44) {
      expect(triage).toContain('row.mode !== "LIVE"');
      expect(triage).toContain("duplicateLiveExecutionIds");
    } else {
      expect(triage).toContain('row.mode === "LIVE"');
    }
    expect(activation).toContain("latest.length !== 1");
    for (const source of [triage, activation]) {
      expect(source).not.toMatch(/fetch\s*\(|createClient\s*\(|\.rpc\s*\(|process\.env/);
    }
  });
});
