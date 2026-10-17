import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");

describe("V4 CI focused specialty with one complete PR release gate", () => {
  const specialized = [
    "v4-pricing-preflight-rc.yml",
    "v4-pricing-branch-readiness-rc.yml",
    "v4-quote-branch-currency-rc.yml",
    "v4-automation-27-playbooks-rc.yml",
    "v4-automation-rule-capacity-rc.yml",
    "v4-multievent-automation-rc.yml",
    "v4-attention-exception-automation-rc.yml",
  ];

  it("keeps each focused domain test and required job identity active for controller PRs", () => {
    const requiredJobs = [
      "exact-head-rc", "exact-head-rc", "quote-currency-rc", "exact-head-rc",
      "full-rc", "exact-head-rc", "exact-head",
    ];
    for (const [index, name] of specialized.entries()) {
      const yaml = read(name);
      expect(yaml).toContain(`  ${requiredJobs[index]}:`);
      expect(yaml).toContain("pull_request:");
      expect(yaml).toContain("feat/servicedesk-v4-reconciled-qa-shell-20261012");
      expect(yaml).toContain("pnpm exec vitest run");
      expect(yaml).toContain("pnpm install --frozen-lockfile");
      expect(yaml).toContain("if: github.event_name == 'push'");
      expect(yaml).toContain("run: pnpm check:rc");
      expect(yaml).toContain("Full source check on owned feature branch");
      expect(yaml.match(/pnpm check:rc/g)?.length).toBe(1);
      expect(yaml).not.toContain("paths-ignore:");
    }
  });

  it("requires exactly one central PR full build at explicit exact source SHA", () => {
    const full = read("v4-controller-pr-full-source-rc.yml");
    expect(full).toContain("pull_request:");
    expect(full).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(full).toContain("pnpm check:rc");
    expect(full).toContain("persist-credentials: false");
    expect(full).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("leaves post-merge authentication and public/synthetic Chrome release checks intact", () => {
    const full = read("v4-reconciled-full-rc.yml");
    expect(full).toContain("cancel-in-progress: true");
    expect(full).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(full).toContain("Real Chrome public responsive proof");
    expect(full).toContain("Real Chrome synthetic operations journey");
    expect(full).toContain("pnpm check:rc");
  });
});
