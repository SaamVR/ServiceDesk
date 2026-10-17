import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OperationalStaffSnapshot } from "../../src/features/operations/operational-product-runtime";
import { selectWorkflowInspectorClientSnapshot } from "../../src/features/operations/workflow-inspector-client-snapshot";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function rawSnapshot() {
  return {
    loadedAt: "2026-10-18T00:00:00Z",
    workflowAvailable: true,
    workflowExecutions: [{
      id: "execution-one", branchId: "branch-a", ruleId: "rule-a",
      ruleVersionId: "version-a", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
      matched: true, state: "ACTIONS_PENDING", createdAt: "2026-10-18T00:00:00Z",
      privateCustomerNote: "SECRET EXECUTION MESSAGE",
    }],
    workflowActionExecutions: [{
      id: "action-one", branchId: "branch-a", executionId: "execution-one",
      actionIndex: 0, attemptNumber: 1, actionType: "SEND_EMAIL_TEMPLATE",
      state: "FAILED", createdAt: "2026-10-18T00:01:00Z",
      errorCode: "provider token=EXPOSED_SECRET", privatePayload: "SECRET ACTION",
    }],
    workflowRuleVersions: [{
      id: "version-a", branchId: "branch-a", ruleId: "rule-a", versionNumber: 2,
      state: "PUBLISHED", eventType: "QUOTE_ACCEPTED",
      conditions: [{ privateContact: "contact@private.invalid" }],
      actions: [{ templateBody: "SECRET TEMPLATE BODY" }],
    }],
    customers: [{ id: "private-person", displayName: "SENSITIVE CUSTOMER" }],
    customerContacts: [{ value: "private@example.invalid" }],
    messages: [{ body: "SECRET CUSTOMER MESSAGE" }],
    invoices: [{ totalMinor: 1000000 }],
    actor: { token: "PRIVILEGED" },
    fakeModelSecret: "CREDENTIAL-NEVER-LEAVES-SERVER",
  } as unknown as OperationalStaffSnapshot;
}

describe("AI workflow inspector server-client privacy boundary", () => {
  it("serializes only approved top-level workflow metadata", () => {
    const output = selectWorkflowInspectorClientSnapshot(rawSnapshot());
    expect(Object.keys(output).sort()).toEqual([
      "loadedAt", "workflowActionExecutions", "workflowAvailable",
      "workflowExecutions", "workflowRuleVersions",
    ].sort());
    expect(JSON.stringify(output)).not.toMatch(
      /SENSITIVE CUSTOMER|private@example.invalid|SECRET CUSTOMER MESSAGE|1000000|CREDENTIAL-NEVER-LEAVES-SERVER|PRIVILEGED/,
    );
  });

  it("strips private nested rule conditions/actions and unapproved execution fields", () => {
    const output = selectWorkflowInspectorClientSnapshot(rawSnapshot());
    expect(output.workflowRuleVersions).toEqual([{
      id: "version-a", branchId: "branch-a", ruleId: "rule-a", versionNumber: 2,
    }]);
    expect(output.workflowExecutions?.[0].id).toBe("execution-one");
    expect(output.workflowActionExecutions?.[0].actionIndex).toBe(0);
    expect(output.workflowActionExecutions?.[0].errorCode).toBeUndefined();
    expect(JSON.stringify(output)).not.toMatch(
      /SECRET EXECUTION MESSAGE|SECRET ACTION|SECRET TEMPLATE BODY|contact@private.invalid|EXPOSED_SECRET/,
    );
  });

  it("allows bounded machine error codes but never arbitrary provider details", () => {
    const raw = rawSnapshot();
    if (!raw.workflowActionExecutions) throw Error("fixture missing actions");
    const output = selectWorkflowInspectorClientSnapshot({
      ...raw,
      workflowActionExecutions: [{
        ...raw.workflowActionExecutions[0], errorCode: "RATE_LIMITED",
      }],
    });
    expect(output.workflowActionExecutions?.[0].errorCode).toBe("RATE_LIMITED");
  });

  it("keeps optional missing workflow arrays missing instead of fabricating events", () => {
    const output = selectWorkflowInspectorClientSnapshot({
      ...rawSnapshot(), workflowAvailable: false,
      workflowRuleVersions: undefined, workflowExecutions: undefined,
      workflowActionExecutions: undefined,
    });
    expect(output.workflowExecutions).toBeUndefined();
    expect(output.workflowActionExecutions).toBeUndefined();
    expect(output.workflowRuleVersions).toBeUndefined();
  });

  it("fails closed on unavailable or missing workflow-read evidence", () => {
    for (const availability of [undefined, false]) {
      const output = selectWorkflowInspectorClientSnapshot({
        ...rawSnapshot(), workflowAvailable: availability,
      });
      expect(output).toEqual({
        loadedAt: "2026-10-18T00:00:00Z", workflowAvailable: false,
      });
      expect(JSON.stringify(output)).not.toContain("SECRET TEMPLATE BODY");
    }
  });

  it("only passes the projected DTO into the client component", () => {
    const source = read("src/features/operations/AiStudioWorkspace.tsx");
    expect(source).toContain("selectWorkflowInspectorClientSnapshot(data)");
    expect(source).toContain("snapshot={workflowInspectorSnapshot}");
    expect(source).not.toContain("<WorkflowExecutionInspector snapshot={data}");
    const inspector = read("src/features/operations/WorkflowExecutionInspector.tsx");
    expect(inspector).toContain("snapshot.workflowAvailable === true ? <div");
    expect(inspector).toContain("snapshot.workflowAvailable !== true");
  });
});
