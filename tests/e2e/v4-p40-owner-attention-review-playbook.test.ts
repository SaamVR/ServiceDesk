import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planOwnerAttentionReviewPlaybook } from "@/features/operations/owner-attention-review-playbook";
import type { OwnerAttentionTriage } from "@/features/operations/owner-attention-triage";

const base: OwnerAttentionTriage = {
  state: "AVAILABLE", open: 3, overdue: 1, critical: 2,
  missingActionEvidence: 1, ambiguous: 1, closed: 1,
  review: [{ id: "saved-1", severity: "CRITICAL", state: "EVIDENCE_GAP", guidance: "Inspect" }],
};

describe("P40 owner attention manual review playbook", () => {
  it("prioritizes ambiguous source, latest retry proof, critical and overdue without executing actions", () => {
    const plan = planOwnerAttentionReviewPlaybook(base);
    expect(plan.state).toBe("REVIEW_REQUIRED");
    expect(plan.steps.map(step => step.id)).toEqual([
      "inspect-quarantined", "verify-action-evidence", "review-critical", "review-overdue",
    ]);
    expect(plan.steps.map(step => step.count)).toEqual([1, 1, 2, 1]);
    expect(plan.steps.every(step => step.destination === "automations")).toBe(true);
  });
  it("fails closed for unavailable evidence instead of claiming a healthy queue", () => {
    expect(planOwnerAttentionReviewPlaybook({ ...base, state: "UNVERIFIED" })).toMatchObject({
      state: "VERIFY_EVIDENCE", steps: [{ id: "verify-snapshot", count: null }],
    });
  });
  it("refuses impossible counts, duplicate/untrusted review rows and missing arrays", () => {
    const changes: Partial<OwnerAttentionTriage>[] = [
      { open: -1 }, { overdue: 4 }, { critical: 4 }, { missingActionEvidence: 4 },
      { ambiguous: NaN }, { closed: 0.5 },
      { review: [...base.review, ...base.review] },
      { review: [{ ...base.review[0], state: "UNKNOWN" as "OPEN" }] },
      { review: undefined },
    ];
    for (const patch of changes) expect(planOwnerAttentionReviewPlaybook({
      ...base, ...patch,
    } as OwnerAttentionTriage).state).toBe("VERIFY_EVIDENCE");
  });
  it("does not say an empty linked set means operational or provider acceptance", () => {
    const plan = planOwnerAttentionReviewPlaybook({ ...base,
      open: 0, overdue: 0, critical: 0, missingActionEvidence: 0,
      ambiguous: 0, review: [],
    });
    expect(plan).toMatchObject({ state: "NO_LINKED_ATTENTION", steps: [] });
    expect(plan.disclosure).toContain("not proof");
    expect(plan.disclosure).toContain("No retries");
  });
  it("offers manual review for ordinary unresolved items without invented automation", () => {
    const plan = planOwnerAttentionReviewPlaybook({ ...base,
      open: 1, overdue: 0, critical: 0, missingActionEvidence: 0,
      ambiguous: 0, review: [{ ...base.review[0], state: "OPEN", severity: "INFO" }],
    });
    expect(plan.steps).toMatchObject([{ id: "review-unresolved", count: 1 }]);
  });
  it("renders a read-only, accessible owner playbook without mutation controls", () => {
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/OwnerAutomationActivationChecklist.tsx"), "utf8");
    expect(ui).toContain("planOwnerAttentionReviewPlaybook(attention)");
    expect(ui).toContain("owner-attention-playbook-title");
    expect(ui).toContain("Manual attention review playbook");
    expect(ui).toContain("playbook.disclosure");
    expect(ui).not.toContain("retryWorker(");
  });
});
