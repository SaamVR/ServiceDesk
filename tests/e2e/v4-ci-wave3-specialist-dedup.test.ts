import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");
const specialist = [
  "v4-controlled-request-workflow-rc.yml",
  "v4-ai-request-copilot-rc.yml",
  "v4-ai-owner-diagnostic-rc.yml",
  "v4-owner-first-run-pricing-rc.yml",
  "v4-catalog-readiness-rc.yml",
];

describe("V4 wave 3 preserve specialty tests with one canonical PR full RC", () => {
  it("continues running all 5 focused specialist validations on controller PRs", () => {
    for (const path of specialist) {
      const file = read(path);
      expect(file).toContain("pull_request:");
      expect(file).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
      expect(file).toContain("pnpm exec vitest run");
      expect(file).toContain("pnpm install --frozen-lockfile");
      expect(file).toContain("if: github.event_name == 'push'");
      expect(file).toContain("run: pnpm check:rc");
      expect(file.match(/pnpm check:rc/g)?.length).toBe(1);
      expect(file).toContain("Full source validation on specialist push");
    }
  });
  it("keeps exact PR-head full tests, types, lint and build in the shared gate", () => {
    const canonical = read("v4-controller-pr-full-source-rc.yml");
    expect(canonical).toContain("pull_request:");
    expect(canonical).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(canonical).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"');
    expect(canonical).toContain("pnpm check:rc");
    expect(canonical).toContain("persist-credentials: false");
  });
  it("preserves full independent post-merge source, Chrome and safe guest browser acceptance", () => {
    const release = read("v4-reconciled-full-rc.yml");
    expect(release).toContain("pnpm check:rc");
    expect(release).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(release).toContain("Real Chrome public responsive proof");
    expect(release).toContain("Real Chrome synthetic operations journey");
    expect(release).toContain("cancel-in-progress: true");
  });
});
