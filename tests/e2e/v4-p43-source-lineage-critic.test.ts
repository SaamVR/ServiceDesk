import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path));
const manifest = JSON.parse(read("docs/delivery/sonic-p03-p43-attention-lineage-20261029.json").toString());
const predecessor = JSON.parse(read("docs/delivery/sonic-p03-p42-source-provenance-20261029.json").toString());
const historical = JSON.parse(read("docs/delivery/sonic-p03-p34-source-provenance-20261029.json").toString());

describe("P43 independently pinned successor provenance", () => {
  it("keeps original P34 and P42 source hashes while validating P43 exact bytes", () => {
    const path = "src/features/operations/owner-attention-triage.ts";
    const bytes = read(path);
    const gitHash = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
    expect(manifest.successor).toMatchObject({path,gitBlobSha:gitHash});
    expect(manifest.parent.sourceBlob).toBe(predecessor.files[path].gitBlobSha);
    expect(historical.files.find((file: {path: string}) => file.path === path).gitBlobSha)
      .toBe(manifest.originalP34Blob);
    expect(manifest).toMatchObject({ownerApproval:null,independentHumanApproval:null});
    expect(manifest.forbidden).toContain("VERCEL_DEPLOY");
  });
});
