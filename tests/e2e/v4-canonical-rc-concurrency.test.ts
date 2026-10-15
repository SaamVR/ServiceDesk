import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(process.cwd(),
  ".github/workflows/v4-reconciled-full-rc.yml"), "utf8");

describe("V4 full browser release runner avoids obsolete integration builds", () => {
  it("prefers the newest exact-head source on a branch but isolates canonical and review", () => {
    expect(workflow).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
    expect(workflow).toContain("deploy/servicedesk-v3-public-review-20261011");
    expect(workflow).toContain("group: servicedesk-v4-reconciled-rc-${{ github.ref }}");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("Real Chrome public responsive proof");
    expect(workflow).toContain("Real Chrome synthetic operations journey");
  });
});
