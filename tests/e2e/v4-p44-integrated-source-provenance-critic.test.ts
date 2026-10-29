import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeOwnerAttentionTriage } from "@/features/operations/owner-attention-triage";
import { planOwnerAttentionReviewPlaybook } from "@/features/operations/owner-attention-review-playbook";

const read = (path: string) => readFileSync(join(process.cwd(), path));
const p44 = JSON.parse(read("docs/delivery/sonic-p03-p44-source-provenance-20261029.json").toString());
const p43 = JSON.parse(read("docs/delivery/sonic-p03-p43-attention-lineage-20261029.json").toString());
const p42 = JSON.parse(read("docs/delivery/sonic-p03-p42-source-provenance-20261029.json").toString());
const p34 = JSON.parse(read("docs/delivery/sonic-p03-p34-source-provenance-20261029.json").toString());
const at = "2026-10-29T11:00:00Z";
const run = { id: "run-x", branchId: "branch-a", ruleId: "rule-a",
  ruleVersionId: "v-a", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
  matched: true, recursionDepth: 0, state: "COMPLETED", createdAt: at } as const;
const action = { id: "action-x", executionId: run.id, branchId: run.branchId,
  actionIndex: 0, attemptNumber: 1, actionType: "CREATE_ATTENTION",
  state: "SUCCEEDED", createdAt: at } as const;
const attention = { id: "attention-x", type: "WORKFLOW_RULE",
  resourceType: "workflow_execution", resourceId: run.id, status: "OPEN",
  severity: "CRITICAL", summary: "Review", dueAt: "2026-10-29T10:00:00Z" } as const;
const sample: Parameters<typeof summarizeOwnerAttentionTriage>[0] = {
  loadedAt: at, workflowAvailable: true,
  branchScope: { mode: "BRANCH", selectedBranchId: run.branchId,
    branches: [{ id: run.branchId, code: "A", name: "Authorized",
      timezone: "UTC", currency: "USD", isDefault: true }] },
  workflowExecutions: [run], workflowActionExecutions: [action],
  attentionItems: [attention],
};

describe("P44 independent exact-blob integration + security critic", () => {
  it("pins four imported P43 blob objects without mutating frozen P34/P42 provenance", () => {
    expect(Object.keys(p44.files)).toHaveLength(4);
    for (const [path, info] of Object.entries(p44.files)) {
      const source = read(path);
      const sha = createHash("sha1").update("blob " + source.length + "\0")
        .update(source).digest("hex");
      expect(sha, path).toBe((info as {gitBlobSha: string}).gitBlobSha);
    }
    expect(p44.parent).toMatchObject({
      head: "e42be516daf82619a6161336e6e45e63120d7549", fullCI: 40891904049,
    });
    expect(p44.importedFrom).toMatchObject({
      head: "2e1f44255501b9faef965a63374d80538bf59fe0",
      focusedCI: 40892053778,
    });
    const path = "src/features/operations/owner-attention-triage.ts";
    expect(p34.files.find((item: {path: string}) => item.path === path).gitBlobSha)
      .toBe(p44.previousTriage.p34);
    expect(p42.files[path].gitBlobSha).toBe(p44.previousTriage.p42);
    expect(p43.parent.sourceBlob).toBe(p44.previousTriage.p42);
    expect(p43.successor.gitBlobSha).toBe(p44.files[path].gitBlobSha);
    expect(p44).toMatchObject({
      ownerApproval: null, independentHumanApproval: null, liveMutationAuthorized: false,
    });
  });
  it("does not allow contradictory LIVE execution identity to fabricate healthy evidence", () => {
    const triage = summarizeOwnerAttentionTriage({...sample,
      workflowExecutions: [run, { ...run, ruleId: "conflicting" }],
    });
    expect(triage).toMatchObject({state: "AVAILABLE", open: 0, ambiguous: 1});
    expect(planOwnerAttentionReviewPlaybook(triage).steps[0].id)
      .toBe("inspect-quarantined");
  });
  it("still produces real read-only priority for valid zoned overdue attention", () => {
    const triage = summarizeOwnerAttentionTriage(sample);
    expect(triage).toMatchObject({state: "AVAILABLE", overdue: 1, critical: 1, ambiguous: 0});
    expect(planOwnerAttentionReviewPlaybook(triage).steps.map(item => item.id))
      .toEqual(["review-critical", "review-overdue"]);
  });
  it("never treats absent, malformed or unzoned snapshot clock as all-clear", () => {
    const triage = summarizeOwnerAttentionTriage({...sample,loadedAt:"2026-10-29T11:00:00"});
    expect(planOwnerAttentionReviewPlaybook(triage).state).toBe("VERIFY_EVIDENCE");
  });
});
