import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 multi-branch operational runtime", () => {
  it("treats the branch cookie as a request that must match the authoritative access snapshot", () => {
    expect(runtime).toContain("servicedesk_read_branch_access_snapshot");
    expect(runtime).toContain("requestedBranchId = cookieStore.get(branchCookieName(workspaceSlug))?.value");
    expect(runtime).toContain("active.find((item) => item.id === requestedBranchId)");
    expect(runtime).toContain("ownerGlobalAccess");
    expect(runtime).toContain("Your staff account is not assigned to an active branch.");
  });

  it("allows all-branch mode only for workspace owners", () => {
    expect(runtime).toContain("Only workspace owners can use the all-branches view.");
    expect(runtime).toContain("cookieStore.delete(cookieName)");
    expect(runtime).toContain("branchScope.ownerGlobalAccess && !branchScope.selectedBranchId");
  });

  it("filters branch-bearing operations before they are exposed to the UI", () => {
    expect(runtime).toContain("const scopedPropertyRows = propertyRows.filter");
    expect(runtime).toContain("const scopedRequestRows = requestRows.filter");
    expect(runtime).toContain("const scopedCrewRows = crewRows.filter");
    expect(runtime).toContain("const scopedCapacityRows = capacityRows.filter");
    expect(runtime).toContain("const scopedVisitRows = visitRows.filter");
    expect(runtime).toContain("const scopedRecurrenceRows = recurrenceRows.filter");
    expect(runtime).toContain("visibleRequestIds");
    expect(runtime).toContain("visibleQuoteIds");
    expect(runtime).toContain("visibleVisitIds");
    expect(runtime).toContain("visibleConversationIds");
  });

  it("hides unlinked inbox and unknown attention resources in branch context", () => {
    expect(runtime).toContain("return requestId");
    expect(runtime).toContain("branchScope.ownerGlobalAccess && !branchScope.selectedBranchId");
    expect(runtime).toContain("const scopedAttentionRows = attentionRows.filter");
    expect(runtime).toContain("return false;");
  });

  it("guards service-role server mutations against IDs outside the active branch", () => {
    for (const helper of [
      "ensureOperationalConversationBranch",
      "ensureOperationalQuoteBranch",
      "ensureOperationalInvoiceBranch",
      "ensureOperationalQualityBranch",
      "ensureOperationalSlotBranch",
      "ensureOperationalBranchResource",
      "ensureOperationalVoiceIntakeBranch",
      "ensureOperationalPhotoSuggestionBranch",
      "ensureOperationalCustomerBranch",
    ]) {
      expect(runtime).toContain(helper);
    }
    expect(runtime).toContain("outside the active branch context");
  });

  it("uses branch-specific reporting for selected branch contexts", () => {
    expect(runtime).toContain("servicedesk_read_branch_reporting_snapshot");
    expect(runtime).toContain("branchId: branchScope.selectedBranchId");
    expect(runtime).toContain("openAttentionCount: scopedAttentionRows.length");
    expect(runtime).toContain("reporting,");
  });

  it("loads owner branch comparison separately and preserves mixed-currency disclosure", () => {
    expect(runtime).toContain("servicedesk_read_branch_comparison_snapshot");
    expect(runtime).toContain("mixedCurrency: snapshot.mixedCurrency === true");
    expect(runtime).toContain("currencyDisclosure");
    expect(runtime).toContain("aggregateCollectedMinor");
  });
});
