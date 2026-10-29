import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeOwnerAttentionTriage } from "@/features/operations/owner-attention-triage";
import { planOwnerAttentionReviewPlaybook } from "@/features/operations/owner-attention-review-playbook";

const manifest = JSON.parse(readFileSync(join(process.cwd(),
  "docs/delivery/sonic-p03-p42-source-provenance-20261029.json"), "utf8"));
const now = "2026-10-29T11:00:00Z";
const execution = { id: "exec-a", branchId: "authorized", ruleId: "rule-a",
  ruleVersionId: "version-a", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
  matched: true, recursionDepth: 0, state: "COMPLETED", createdAt: now } as const;
const action = { id: "action-a", executionId: "exec-a", branchId: "authorized",
  actionIndex: 0, attemptNumber: 1, actionType: "CREATE_ATTENTION",
  state: "SUCCEEDED", createdAt: now } as const;
const attention = { id: "attention-a", type: "WORKFLOW_RULE",
  resourceType: "workflow_execution", resourceId: "exec-a",
  status: "OPEN", severity: "CRITICAL", summary: "Internal staff review",
  dueAt: "2026-10-29T09:00:00Z" } as const;
const input: Parameters<typeof summarizeOwnerAttentionTriage>[0] = {
  loadedAt: now, workflowAvailable: true,
  branchScope: { mode: "BRANCH", selectedBranchId: "authorized",
    branches: [{ id: "authorized", code: "A", name: "Authorized",
      timezone: "UTC", currency: "USD", isDefault: true }] },
  workflowExecutions: [execution], workflowActionExecutions: [action],
  attentionItems: [attention],
};

describe("P42 independent-by-test integration and provenance critic", () => {
  it("preserves all five reviewed original source objects by exact Git SHA-1", () => {
    expect(Object.keys(manifest.files).length).toBe(5);
    for (const [path, record] of Object.entries(manifest.files)) {
      const source = readFileSync(join(process.cwd(), path));
      const gitBlob = createHash("sha1")
        .update("blob " + source.length + "\0")
        .update(source).digest("hex");
      expect(gitBlob, path).toBe((record as { gitBlobSha: string }).gitBlobSha);
    }
    expect(manifest.constraints).toMatchObject({
      databaseMutation: false, authCreation: false, providerActions: false,
      paymentActions: false, vercelDeployment: false, canonicalMerge: false,
      ownerApproval: null, independentHumanApproval: null,
    });
  });
  it("turns valid zoned overdue critical evidence into a manual review, not a send", () => {
    const triage = summarizeOwnerAttentionTriage(input);
    expect(triage).toMatchObject({ state: "AVAILABLE", open: 1,
      overdue: 1, critical: 1, ambiguous: 0, missingActionEvidence: 0 });
    const plan = planOwnerAttentionReviewPlaybook(triage);
    expect(plan.steps.map(step => step.id)).toEqual(["review-critical", "review-overdue"]);
    expect(plan.steps.every(step => step.destination === "automations")).toBe(true);
  });
  it("quarantines malformed due time and prioritizes inspecting ambiguous records", () => {
    const triage = summarizeOwnerAttentionTriage({
      ...input, attentionItems: [{ ...attention, dueAt: "2026-10-29T09:00:00" }],
    });
    expect(triage).toMatchObject({ state: "AVAILABLE", open: 0, ambiguous: 1 });
    expect(planOwnerAttentionReviewPlaybook(triage).steps[0].id).toBe("inspect-quarantined");
  });
  it("fails closed on invalid snapshot clocks and duplicate current attempts", () => {
    const stale = summarizeOwnerAttentionTriage({ ...input,
      loadedAt: "2026-10-29T11:00:00" });
    expect(planOwnerAttentionReviewPlaybook(stale).state).toBe("VERIFY_EVIDENCE");
    const replay = summarizeOwnerAttentionTriage({ ...input,
      workflowActionExecutions: [action, { ...action, id: "duplicate" }],
    });
    expect(replay.missingActionEvidence).toBe(1);
    expect(planOwnerAttentionReviewPlaybook(replay).steps[0].id)
      .toBe("verify-action-evidence");
  });
  it("keeps other-branch attention excluded from the manual playbook", () => {
    const foreign = summarizeOwnerAttentionTriage({ ...input,
      workflowExecutions: [execution, { ...execution, id: "foreign", branchId: "outside" }],
      attentionItems: [{ ...attention, id: "foreign-attention", resourceId: "foreign" }],
    });
    expect(foreign).toMatchObject({ state: "AVAILABLE", open: 0, ambiguous: 0 });
    expect(planOwnerAttentionReviewPlaybook(foreign).state).toBe("NO_LINKED_ATTENTION");
  });
  it("confines proposed manual playbook UI to safe links and no automated mutation", () => {
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/OwnerAutomationActivationChecklist.tsx"), "utf8");
    const start = ui.indexOf('id="owner-attention-playbook-title"');
    const end = ui.indexOf("</section>", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const playbookUi = ui.slice(start, end);
    expect(playbookUi).toContain("playbook.disclosure");
    expect(playbookUi).toContain("buildStaffModuleHref(workspaceSlug, \"automations\")");
    expect(playbookUi).not.toMatch(/onClick=|<button|<form|sendEmail|retryWorker|applyMigration/);
  });
});
