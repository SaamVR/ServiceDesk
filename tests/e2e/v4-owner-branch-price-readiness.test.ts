import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { availableFirstRunUsdBranches } from "../../src/features/operations/owner-pricing-readiness";
import type { OperationalBranchScope } from "../../src/features/operations/operational-product-runtime";

const usA = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "A", name: "A", currency: "USD", timezone: "America/New_York", isDefault: true };
const usB = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", code: "B", name: "B", currency: "USD", timezone: "America/New_York", isDefault: false };
const gb = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", code: "UK", name: "UK", currency: "GBP", timezone: "Europe/London", isDefault: false };
const scope: OperationalBranchScope = { mode: "ALL", branches: [usA, usB, gb] };

describe("Owner first-run pricing requires verified branch price books", () => {
  it("offers an unpriced branch even when three cleaning catalog services already exist", () => {
    expect(availableFirstRunUsdBranches(scope,{ state:"VERIFIED",activeBranchIds:[usA.id] })).toEqual([usB]);
  });
  it("never offers an already priced branch nor an unsupported currency", () => {
    expect(availableFirstRunUsdBranches(scope,{ state:"VERIFIED",activeBranchIds:[usA.id,usB.id] })).toEqual([]);
    expect(availableFirstRunUsdBranches(scope,{ state:"VERIFIED",activeBranchIds:[] })).toEqual([usA,usB]);
  });
  it("fails closed when the price-book read is missing or denied", () => {
    expect(availableFirstRunUsdBranches(scope,undefined)).toEqual([]);
    expect(availableFirstRunUsdBranches(scope,{ state:"UNAVAILABLE",activeBranchIds:[] })).toEqual([]);
  });
  it("preserves selected-branch authorization", () => {
    const picked = { ...scope, mode: "BRANCH" as const, selectedBranchId: usB.id };
    expect(availableFirstRunUsdBranches(picked,{ state:"VERIFIED",activeBranchIds:[] })).toEqual([usB]);
  });
  it("uses an actual scoped persisted price-book read rather than catalog count", () => {
    const file = (p:string) => readFileSync(join(process.cwd(),p),"utf8");
    const runtime=file("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain('from("branch_price_books")');
    expect(runtime).toContain('.eq("workspace_id", workspace.id)');
    expect(runtime).toContain('.eq("active", true).limit(201)');
    expect(runtime).toContain('ownerPricingBookProof,');
    const route=file("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain('availableFirstRunUsdBranches(data.branchScope, data.ownerPricingBookProof)');
    expect(route).not.toContain('["STANDARD", "DEEP", "MOVE_OUT"].includes(service.code)).length < 3');
    const form=file("src/features/operations/OwnerCleaningPricingSetupForm.tsx");
    expect(form).toContain("availableFirstRunUsdBranches(scope, proof)");
  });
});
