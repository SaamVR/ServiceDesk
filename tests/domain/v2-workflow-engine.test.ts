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
  sourceEventId: "request-00001",
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

  it("never collapses two independent customer enquiries with identical snapshot fields", () => {
    const published = { ...version, state: "PUBLISHED" as const };
    const first = evaluateWorkflowRule(published, event, "LIVE");
    const sameEventRetry = evaluateWorkflowRule(published, { ...event }, "LIVE");
    const anotherEnquiry = evaluateWorkflowRule(published, { ...event, sourceEventId: "request-00002" }, "LIVE");
    if (!first.ok || !sameEventRetry.ok || !anotherEnquiry.ok) throw Error("expected successful evaluations");
    expect(first.value.eventFingerprint).toBe(sameEventRetry.value.eventFingerprint);
    expect(first.value.eventFingerprint).not.toBe(anotherEnquiry.value.eventFingerprint);
    const a = workflowExecutionKey({ mode: "LIVE", ruleVersionId: published.id, eventFingerprint: first.value.eventFingerprint, sourceEvent: event });
    const b = workflowExecutionKey({ mode: "LIVE", ruleVersionId: published.id, eventFingerprint: anotherEnquiry.value.eventFingerprint, sourceEvent: { ...event, sourceEventId: "request-00002" } });
    expect(a).not.toBe(b);
  });

  it("dedupes a persisted LIVE source even if the request is later edited, while retaining per-snapshot audit fingerprints", () => {
    const published = { ...version, state: "PUBLISHED" as const };
    const original = evaluateWorkflowRule(published, event, "LIVE");
    const edited = evaluateWorkflowRule(published, {
      ...event,
      snapshot: { ...event.snapshot, "request.serviceCode": "STANDARD", "request.leadSource": "MANUAL" },
    }, "LIVE");
    if (!original.ok || !edited.ok) throw new Error("expected evaluated events");
    expect(original.value.eventFingerprint).not.toBe(edited.value.eventFingerprint);
    const input = { mode: "LIVE" as const, ruleVersionId: published.id, sourceEvent: event };
    expect(workflowExecutionKey({ ...input, eventFingerprint: original.value.eventFingerprint }))
      .toBe(workflowExecutionKey({ ...input, eventFingerprint: edited.value.eventFingerprint }));
    expect(() => workflowExecutionKey({
      mode: "LIVE", ruleVersionId: published.id, eventFingerprint: original.value.eventFingerprint,
    })).toThrow("WORKFLOW_LIVE_SOURCE_IDENTITY_REQUIRED");
  });

  it("refuses source-less live execution rather than silently deduping unrelated records", () => {
    const published = { ...version, state: "PUBLISHED" as const };
    expect(evaluateWorkflowRule(published, { ...event, sourceEventId: undefined }, "LIVE"))
      .toMatchObject({ ok: false, code: "WORKFLOW_SOURCE_EVENT_ID_REQUIRED" });
    expect(validateWorkflowEventEnvelope({ ...event, sourceEventId: "someone@example.org" }))
      .toMatchObject({ ok: false, code: "WORKFLOW_SOURCE_EVENT_ID_INVALID" });
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
    expect(workflowExecutionKey({ mode: "LIVE", ruleVersionId: version.id, eventFingerprint: fingerprint, sourceEvent: event }))
      .toBe(workflowExecutionKey({ mode: "LIVE", ruleVersionId: version.id, eventFingerprint: fingerprint, sourceEvent: event }));
    expect(workflowExecutionKey({ mode: "PREVIEW", ruleVersionId: version.id, eventFingerprint: fingerprint, previewNonce: "a" }))
      .not.toBe(workflowExecutionKey({ mode: "PREVIEW", ruleVersionId: version.id, eventFingerprint: fingerprint, previewNonce: "b" }));
  });
});
