import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectViewModels(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) return collectViewModels(path);
    return entry === "view-models.ts" ? [path] : [];
  });
}

describe("feature view-model fixture boundary", () => {
  it("keeps pure view-models independent from showcase sample data", () => {
    const files = collectViewModels(join(process.cwd(), "src/features"));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("sample-data");
      expect(source, file).not.toContain("sampleRequest");
      expect(source, file).not.toContain("sampleQuote");
      expect(source, file).not.toContain("sampleVisit");
    }
  });
});
