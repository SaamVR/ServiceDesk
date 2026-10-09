import { describe, expect, it } from "vitest";
import {
  evaluateWorkflowRule,
  validateWorkflowEventEnvelope,
  workflowExecutionKey,
} from "../../src/server/workflows/engine";
import type { WorkflowRuleVersionDTO } from "../../src/contracts";

const version: WorkflowRuleVersionDTO = {
  id: "version-1",
  workspaceId: "workspace-1",
  branchId: "branch-1",
  ruleId: "rule-1",
  versionNumber: 1,
  state: "DRAFT",
  eventType: "REQUEST_CREATED",
  conditions: [
    { field: "request.serviceCode", operator: "EQ", value: "DEEP_CLEAN" },
  ],
  actions: [
    { type: "CREATE_ATTENTION", severity: "WARNING", summaryKey: "REVIEW_DEEP_CLEAN" },
    { type: "SEND_EMAIL_TEMPLATE", templateKey: "request-received", recipient: "CUSTOMER_PRIMARY" },
  ],
  maxActionsPerEvent: 3,
  createdAt: "2026-10-10T00:00:00.000Z",
};

const event = {
  workspaceId: "workspace-1",
  branchId: "branch-1",
  eventType: "REQUEST_CREATED" as const,
  snapshot: {
    "request.serviceCode": "DEEP_CLEAN",
    "request.leadSource": "WEB",
    "request.branchCode": "MAIN",
  },
  recursionDepth: 0,
};

describe("workflow evaluator", () => {
  it("previews a draft rule without side effects and flags external sends for owner approval", () => {
    const result = evaluateWorkflowRule(version, event, "PREVIEW");
    expect(result).toMatchObject({
      ok: true,
      value: {
        matched: true,
        actionPlans: [
          { index: 0, requiresOwnerApproval: false, previewOnly: true },
          { index: 1, requiresOwnerApproval: true, previewOnly: true },
        ],
      },
    });
  });

  it("requires published versions for live evaluation", () => {
    expect(evaluateWorkflowRule(version, event, "LIVE"))
      .toMatchObject({ ok: false, code: "WORKFLOW_PUBLISHED_VERSION_REQUIRED" });
    expect(evaluateWorkflowRule({ ...version, state: "PUBLISHED" }, event, "LIVE"))
      .toMatchObject({ ok: true, value: { matched: true } });
  });

  it("does not plan actions when conditions do not match", () => {
    const result = evaluateWorkflowRule(version, {
      ...event,
      snapshot: { ...event.snapshot, "request.serviceCode": "STANDARD" },
    }, "PREVIEW");
    expect(result).toMatchObject({ ok: true, value: { matched: false, actionPlans: [] } });
  });

  it("rejects fields outside the safe event catalogue and recursion beyond depth two", () => {
    expect(validateWorkflowEventEnvelope({
      ...event,
      snapshot: { "customer.email": "secret@example.test" },
    })).toMatchObject({ ok: false, code: "WORKFLOW_EVENT_FIELD_NOT_ALLOWED" });
    expect(validateWorkflowEventEnvelope({ ...event, recursionDepth: 3 }))
      .toMatchObject({ ok: false, code: "WORKFLOW_RECURSION_LIMIT" });
  });

  it("produces deterministic live execution keys and independently nonceable previews", () => {
    const evaluated = evaluateWorkflowRule(version, event, "PREVIEW");
    if (!evaluated.ok) throw new Error("expected preview");
    const fingerprint = evaluated.value.eventFingerprint;
    expect(workflowExecutionKey({ mode: "LIVE", ruleVersionId: version.id, eventFingerprint: fingerprint }))
      .toBe(workflowExecutionKey({ mode: "LIVE", ruleVersionId: version.id, eventFingerprint: fingerprint }));
    expect(workflowExecutionKey({ mode: "PREVIEW", ruleVersionId: version.id, eventFingerprint: fingerprint, previewNonce: "a" }))
      .not.toBe(workflowExecutionKey({ mode: "PREVIEW", ruleVersionId: version.id, eventFingerprint: fingerprint, previewNonce: "b" }));
  });
});
