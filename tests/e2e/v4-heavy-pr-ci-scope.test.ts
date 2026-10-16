import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V4 time-efficient release CI preserves code validation",()=>{
  const full=readFileSync(join(process.cwd(),
    ".github/workflows/v4-controller-pr-full-source-rc.yml"),"utf8");
  const critic=readFileSync(join(process.cwd(),
    ".github/workflows/v4-critic-acceptance.yml"),"utf8");

  it("skips only documentation-only changes from expensive full-source PR gate",()=>{
    expect(full).toContain("paths-ignore:");
    expect(full).toContain('"docs/**"');
    expect(full).toContain("pnpm check:rc");
    expect(full).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(full).not.toContain('"src/**"');
    expect(full).not.toContain('"tests/**"');
    expect(full).not.toContain('"supabase/**"');
    expect(full).not.toContain('"scripts/**"');
  });
  it("retains the dedicated Critic integrity gate on all controller PRs",()=>{
    expect(critic).toContain("pull_request:");
    expect(critic).toContain("critic-claim-integrity:");
    expect(critic).not.toContain("paths-ignore:");
  });
});
