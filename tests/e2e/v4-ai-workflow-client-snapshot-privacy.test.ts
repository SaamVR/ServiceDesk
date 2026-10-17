import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OperationalStaffSnapshot } from "../../src/features/operations/operational-product-runtime";
import { selectWorkflowInspectorClientSnapshot } from "../../src/features/operations/workflow-inspector-client-snapshot";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("AI workflow inspector server-client privacy boundary", () => {
  it("serializes only five approved workflow properties even with private operational data present", () => {
    const privateInput = {
      loadedAt: "2026-10-18T00:00:00Z",
      workflowAvailable: true,
      workflowExecutions: [],
      workflowActionExecutions: [],
      workflowRuleVersions: [],
      customers: [{ id: "private-person", displayName: "SENSITIVE CUSTOMER" }],
      customerContacts: [{ value: "private@example.invalid" }],
      messages: [{ body: "SECRET CUSTOMER MESSAGE" }],
      invoices: [{ totalMinor: 1000000 }],
      actor: { token: "PRIVILEGED" },
      fakeModelSecret: "CREDENTIAL-NEVER-LEAVES-SERVER",
    } as unknown as OperationalStaffSnapshot;
    const output = selectWorkflowInspectorClientSnapshot(privateInput);
    expect(Object.keys(output).sort()).toEqual([
      "loadedAt", "workflowActionExecutions", "workflowAvailable",
      "workflowExecutions", "workflowRuleVersions",
    ].sort());
    expect(JSON.stringify(output)).not.toMatch(
      /SENSITIVE CUSTOMER|private@example.invalid|SECRET CUSTOMER MESSAGE|1000000|CREDENTIAL-NEVER-LEAVES-SERVER|PRIVILEGED/,
    );
  });

  it("does not pass the full staff snapshot as a prop to the client inspector", () => {
    const source = read("src/features/operations/AiStudioWorkspace.tsx");
    expect(source).toContain("selectWorkflowInspectorClientSnapshot(data)");
    expect(source).toContain("snapshot={workflowInspectorSnapshot}");
    expect(source).not.toContain("<WorkflowExecutionInspector snapshot={data}");
  });

  it("does not expand the browser data contract into customer or payment fields", () => {
    const source = read("src/features/operations/workflow-inspector-client-snapshot.ts");
    const returned = source.slice(source.indexOf("  return {"), source.indexOf("\n  };", source.indexOf("  return {")) + 5);
    expect(returned).not.toContain("customer");
    expect(returned).not.toContain("messages:");
    expect(returned).not.toContain("invoices:");
    expect(returned).not.toContain("token:");
    expect(returned).not.toContain("serviceRole");
  });
});
