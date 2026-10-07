import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);
const bar = readFileSync(
  join(process.cwd(), "src/features/operations/BranchContextBar.tsx"),
  "utf8",
);
const overview = readFileSync(
  join(process.cwd(), "src/app/app/[workspace]/overview/page.tsx"),
  "utf8",
);

describe("V2 multi-branch product UI", () => {
  it("shows a server-validated branch selector on operational modules and overview", () => {
    expect(route).toContain("<BranchContextBar");
    expect(overview).toContain("<BranchContextBar");
    expect(bar).toContain("selectOperationalBranch");
    expect(bar).toContain('branchScope.ownerGlobalAccess ? <option value="">All branches</option>');
    expect(bar).toContain("branchScope.branches");
    expect(bar).toContain("timezone");
    expect(bar).toContain("currency");
  });

  it("provides owner-only branch creation, update and staff assignment controls", () => {
    expect(route).toContain("Branches & access");
    expect(route).toContain("createOperationalBranch");
    expect(route).toContain("updateOperationalBranch");
    expect(route).toContain("setOperationalBranchAssignment");
    expect(route).toContain('data.actor.role === "OWNER"');
    expect(route).toContain("Owners are company-wide");
    expect(route).toContain("The default branch cannot be deactivated.");
  });

  it("does not present owner membership as branch-limited assignment", () => {
    expect(route).toContain('member.role !== "OWNER"');
    expect(route).toContain("Owners are global and are not listed as branch assignments.");
  });

  it("shows owner branch comparison with branch-local timezone and currency", () => {
    expect(route).toContain("Branch comparison");
    expect(route).toContain("branch.timezone");
    expect(route).toContain("branch.currency");
    expect(route).toContain("formatMinorMoney(branch.collectedMinor, branch.currency)");
    expect(route).toContain("formatMinorMoney(branch.outstandingMinor, branch.currency)");
  });

  it("never fabricates cross-currency company totals", () => {
    expect(route).toContain("data.branchComparison.mixedCurrency");
    expect(route).toContain("Mixed currencies");
    expect(route).toContain("data.branchComparison.currencyDisclosure");
    expect(route).not.toContain("exchangeRate");
    expect(route).not.toContain("convertedCollected");
  });

  it("states that branch scope stays inside the workspace tenant", () => {
    expect(route).toContain("Workspace isolation is unchanged.");
    expect(route).toContain("it never authorizes access to another workspace.");
  });
});
