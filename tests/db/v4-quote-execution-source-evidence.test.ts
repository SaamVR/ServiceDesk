import { describe, expect, it } from "vitest";
import { workflowExecutionKey } from "../../src/server/workflows/engine";
import { matchingQuoteSourceForLiveExecution } from "../../src/server/workflows/quote-execution-source-evidence";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const branchId = "22222222-2222-4222-8222-222222222222";
const otherBranch = "66666666-6666-4666-8666-666666666666";
const versionId = "33333333-3333-4333-8333-333333333333";
const acceptedQuote = "44444444-4444-4444-8444-444444444444";
const unrelatedQuote = "55555555-5555-4555-8555-555555555555";
const quotes = [{ id: acceptedQuote, branchId }, { id: unrelatedQuote, branchId }];
const executionKey = (quoteId: string, tenant = workspaceId, branch = branchId, recursionDepth = 0) =>
  workflowExecutionKey({
    mode: "LIVE", ruleVersionId: versionId, eventFingerprint: "",
    sourceEvent: { workspaceId: tenant, branchId: branch,
      eventType: "QUOTE_ACCEPTED", sourceEventId: quoteId, recursionDepth },
  });
const execution = {
  executionKey: executionKey(acceptedQuote), mode: "LIVE", eventType: "QUOTE_ACCEPTED",
  recursionDepth: 0, ruleVersionId: versionId, branchId,
};
const link = (
  overrides: Partial<typeof execution> = {},
  candidates: typeof quotes = quotes,
  tenant = workspaceId,
) => matchingQuoteSourceForLiveExecution({
  workspaceId: tenant, execution: { ...execution, ...overrides }, quoteSources: candidates,
});

describe("V4 exact accepted quote origin: persisted workflow execution key", () => {
  it("joins an actual LIVE quote source in one authorized workspace and branch", () => {
    expect(link()).toBe(acceptedQuote);
    expect(link({ executionKey: executionKey(unrelatedQuote) })).toBe(unrelatedQuote);
  });
  it("does not infer origin from same-branch unrelated quotes", () => {
    expect(link({}, [{ id: unrelatedQuote, branchId }])).toBeUndefined();
    expect(link({ executionKey: executionKey("77777777-7777-4777-8777-777777777777") })).toBeUndefined();
  });
  it("denies cross-workspace, cross-branch, previews, recursion, wrong type, missing or forged key", () => {
    expect(link({}, quotes, "88888888-8888-4888-8888-888888888888")).toBeUndefined();
    expect(link({ branchId: otherBranch }, [{ id: acceptedQuote, branchId: otherBranch }])).toBeUndefined();
    expect(link({ mode: "PREVIEW" })).toBeUndefined();
    expect(link({ eventType: "REQUEST_CREATED" })).toBeUndefined();
    expect(link({ recursionDepth: 1 })).toBeUndefined();
    expect(link({ executionKey: executionKey(acceptedQuote, workspaceId, branchId, 1) })).toBeUndefined();
    expect(link({ executionKey: undefined })).toBeUndefined();
    expect(link({ executionKey: "live:invalid" })).toBeUndefined();
    expect(link({ ruleVersionId: unrelatedQuote })).toBeUndefined();
  });
  it("fails closed on ambiguous or oversized quote source input", () => {
    expect(link({}, [quotes[0], quotes[0]])).toBeUndefined();
    expect(link({}, Array.from({ length: 1001 }, () => quotes[0]))).toBeUndefined();
  });
  it("loads execution_key read-only from workspace-scoped snapshots and exposes no raw key to client", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/operational-product-runtime.ts"), "utf8");
    expect(source).toContain("rule_version_id,execution_key,mode,event_type");
    expect(source).toContain("sourceQuoteId: matchingQuoteSourceForLiveExecution({");
    expect(source).toContain("workspaceId: workspace.id");
    expect(source).not.toContain("executionKey: String(row.execution_key)");
    const guard = readFileSync(join(process.cwd(),
      "src/features/operations/owner-automation-activation.ts"), "utf8");
    expect(guard).toContain("acceptedQuoteBranches.get(execution.sourceQuoteId)");
    expect(guard).toContain("item.resourceType !== \"workflow_execution\"");
  });
});
