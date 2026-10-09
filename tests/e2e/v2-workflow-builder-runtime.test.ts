import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 workflow builder operational runtime", () => {
  it("loads workflow tables as an optional product capability", () => {
    expect(runtime).toContain('.from("workflow_rules")');
    expect(runtime).toContain('.from("workflow_rule_versions")');
    expect(runtime).toContain('.from("workflow_executions")');
    expect(runtime).toContain('.from("workflow_action_executions")');
    expect(runtime).toContain("const workflowAvailable = !workflowRuleRead.error");
  });

  it("applies selected branch scope before mapping rule and decision history", () => {
    expect(runtime).toContain("const workflowRuleRows = rawWorkflowRules.filter(inSelectedBranch)");
    expect(runtime).toContain("const workflowRuleIds = new Set");
    expect(runtime).toContain("const workflowVersionIds = new Set");
    expect(runtime).toContain("const workflowExecutionIds = new Set");
  });

  it("requires owner and branch authority for draft, preview, publish, rollback, approval and replay", () => {
    expect(runtime).toContain('resolved.value.actor.role !== "OWNER"');
    expect(runtime).toContain("canActOnOperationalBranch");
    expect(runtime).toContain('"servicedesk_save_workflow_rule_draft"');
    expect(runtime).toContain('"servicedesk_preview_workflow_rule_version"');
    expect(runtime).toContain('"servicedesk_publish_workflow_rule_version"');
    expect(runtime).toContain('"servicedesk_rollback_workflow_rule"');
    expect(runtime).toContain('"servicedesk_approve_workflow_external_action"');
    expect(runtime).toContain('"servicedesk_replay_failed_workflow_action"');
  });

  it("keeps action replay separate from source booking truth", () => {
    expect(runtime).toContain("data.sourceBookingReplayed !== false");
    expect(runtime).toContain("The source booking/event was not replayed.");
  });

  it("does not add direct request, quote, visit, invoice or payment mutation to workflow actions", () => {
    const start = runtime.indexOf("export async function saveOperationalWorkflowDraft");
    const workflowRuntime = runtime.slice(start);
    expect(workflowRuntime).not.toContain('.from("requests").update');
    expect(workflowRuntime).not.toContain('.from("quotes").update');
    expect(workflowRuntime).not.toContain('.from("visits").update');
    expect(workflowRuntime).not.toContain('.from("invoices").update');
    expect(workflowRuntime).not.toContain("applyOperationalManualPayment");
  });

  it("explains that configured external delivery policy remains authoritative", () => {
    expect(runtime).toContain("Delivery still uses the configured channel/template policy boundary.");
  });
});
