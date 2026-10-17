import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");
const getConcurrencyGroup = (source: string) =>
  source.split("\n").find(line => line.trimStart().startsWith("group:"))?.trim();

describe("V4 non-colliding release checks", () => {
  const sqlGuard = read("v4-pricing-preflight-rc.yml");
  const ownerBook = read("v4-pricing-branch-readiness-rc.yml");
  const currency = read("v4-quote-branch-currency-rc.yml");
  const controller = read("v4-reconciled-full-rc.yml");

  it("prevents unrelated pricing checks from cancelling each other on the same PR", () => {
    const groups = [sqlGuard, ownerBook, currency, controller].map(getConcurrencyGroup);
    expect(groups.every(Boolean)).toBe(true);
    expect(new Set(groups).size).toBe(groups.length);
    expect(groups[0]).toContain("sd-v4-sql-pricing-guard-");
    expect(groups[1]).toContain("sd-v4-owner-branch-readiness-");
  });

  it("retains focused pricing tests and the full source release checks", () => {
    expect(sqlGuard).toContain("tests/e2e/v4-owner-first-run-pricing.test.ts");
    expect(ownerBook).toContain("tests/e2e/v4-owner-branch-price-readiness.test.ts");
    expect(sqlGuard).toContain("pnpm check:rc");
    expect(ownerBook).toContain("pnpm check:rc");
    expect(controller).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(controller).toContain("Real Chrome synthetic operations journey");
  });

  it("preserves per-workflow cancellation without colliding pricing and controller checks", () => {
    for (const source of [sqlGuard, ownerBook]) {
      expect(source).toContain("cancel-in-progress: true");
      expect(source).toContain("github.event.pull_request.number || github.ref");
      expect(source).toContain("pull_request:");
    }
    expect(controller).toContain("cancel-in-progress: true");
    expect(getConcurrencyGroup(controller)).toContain("servicedesk-v4-reconciled-rc-");
  });
});
