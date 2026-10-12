import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");

describe("V4 canonical PR full-source release gate", () => {
  const prGate = source("v4-controller-pr-full-source-rc.yml");
  const mergedGate = source("v4-reconciled-full-rc.yml");

  it("runs on controller PRs and checks the EXACT branch-head commit", () => {
    expect(prGate).toContain("pull_request:");
    expect(prGate).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
    expect(prGate).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(prGate).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"');
    expect(prGate).toContain("pnpm install --frozen-lockfile");
    expect(prGate).toContain("pnpm check:rc");
    expect(prGate).toContain("cancel-in-progress: true");
    expect(prGate).toContain("sd-v4-pr-full-rc-");
  });

  it("does not require secrets or provider access to validate source", () => {
    expect(prGate).toContain("contents: read");
    expect(prGate).toContain("persist-credentials: false");
    expect(prGate).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(prGate).not.toContain("workflow_dispatch:");
    expect(prGate).not.toContain("deployment");
  });

  it("retains independent full post-merge Chrome and guest-route acceptance", () => {
    expect(mergedGate).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(mergedGate).toContain("Real Chrome public responsive proof");
    expect(mergedGate).toContain("Real Chrome synthetic operations journey");
    expect(mergedGate).toContain("cancel-in-progress: false");
  });
});
