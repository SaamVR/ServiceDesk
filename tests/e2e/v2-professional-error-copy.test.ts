import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional production error copy", () => {
  it("keeps infrastructure and credential setup details out of staff-facing runtime errors", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("Workspace data is temporarily unavailable");
    expect(runtime).toContain("workspace connection in Settings");
    expect(runtime).not.toContain("Configure the server-side Supabase URL");
    expect(runtime).not.toContain("service-role key before operating live records");
    expect(runtime).not.toContain("Operational records could not be loaded from PostgreSQL");
  });
});
