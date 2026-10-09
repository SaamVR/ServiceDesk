import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(process.cwd(), "src/app/app/[workspace]/layout.tsx"), "utf8");
const selector = readFileSync(join(process.cwd(), "src/features/operations/BranchScopeBar.tsx"), "utf8");
const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
const photoRoute = readFileSync(join(process.cwd(), "src/app/api/request-photos/[assetId]/route.ts"), "utf8");

describe("V2 multi-branch staff product", () => {
  it("mounts a single authenticated branch selector across the whole staff workspace", () => {
    expect(layout).toContain("loadOperationalBranchScope(workspace)");
    expect(layout).toContain("<BranchScopeBar");
    expect(layout).toContain("setOperationalBranchScope");
    expect(selector).toContain('actor.role === "OWNER" ? <option value="ALL">HQ · All branches</option>');
    expect(selector).toContain('scope.branches.map');
  });

  it("does not trust a branch query parameter for authorization", () => {
    expect(layout).not.toContain('searchParams');
    expect(selector).not.toContain('useSearchParams');
    expect(selector).not.toContain('branch=');
  });

  it("provides owner branch creation and explicit dispatcher/crew assignment controls", () => {
    expect(route).toContain("Branches & staff scope");
    expect(route).toContain("Create branch");
    expect(route).toContain("Dispatcher & crew assignments");
    expect(route).toContain("Owners are always company-wide and do not need branch assignments.");
    expect(route).toContain("upsertOperationalBranch");
    expect(route).toContain("setOperationalBranchMembership");
  });

  it("renders HQ comparison in each branch native timezone/currency without hidden FX conversion", () => {
    expect(route).toContain("HQ branch comparison");
    expect(route).toContain("Branch performance");
    expect(route).toContain("row.timezone");
    expect(route).toContain("row.currency");
    expect(route).toContain("formatMinorMoney(row.collectedMinor, row.currency)");
    expect(route).toContain("currency mismatch");
  });

  it("enforces branch scope before request photo bytes are streamed", () => {
    expect(photoRoute).toContain('select("id,request_id,storage_ref');
    expect(photoRoute).toContain('requireOperationalBranchResource(resolved.value, "request", row.request_id)');
    expect(photoRoute.indexOf("requireOperationalBranchResource")).toBeLessThan(photoRoute.indexOf(".storage"));
    expect(photoRoute).not.toContain("JSON.stringify(row)");
    expect(photoRoute).not.toContain('"storageRef"');
    expect(photoRoute).not.toContain('"storage_ref"');
  });
});
