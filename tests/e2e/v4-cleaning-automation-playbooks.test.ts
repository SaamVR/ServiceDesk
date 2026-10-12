import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  automationPlaybooks, automationPlaybookCategories, getAutomationPlaybook,
} from "@/features/operations/automation-playbooks";
import { evaluateWorkflowRule } from "@/server/workflows/engine";
import type { WorkflowRuleVersionDTO, WorkflowEventType } from "@/contracts";

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branch = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("27 real-catalogue cleaning automation starter playbooks", () => {
  it("offers 27 unique human-reviewed safe internal-attention drafts across all five supported events", () => {
    expect(automationPlaybooks).toHaveLength(27);
    expect(new Set(automationPlaybooks.map(item => item.code)).size).toBe(27);
    expect(new Set(automationPlaybooks.map(item => item.id)).size).toBe(27);
    expect(new Set(automationPlaybooks.map(item => item.eventType))).toEqual(new Set([
      "REQUEST_CREATED", "QUOTE_ACCEPTED", "VISIT_COMPLETED", "INVOICE_PAID", "ATTENTION_OPENED",
    ]));
    expect(new Set(automationPlaybooks.map(item => item.category))).toEqual(new Set(automationPlaybookCategories));
    for (const item of automationPlaybooks) {
      expect(item.code).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
      expect(item.actionDetail).toMatch(/^[A-Z_]{3,120}$/);
      expect(item.name.length).toBeLessThanOrEqual(120);
      expect(item.description).not.toMatch(/auto.send|guaranteed|charged|confirmed booking/i);
      expect(["INFO","WARNING","CRITICAL"]).toContain(item.severity);
      expect(getAutomationPlaybook(item.id)).toEqual(item);
      if (item.condition) {
        expect(["EQ", "NEQ", "IN"]).toContain(item.condition.operator);
        expect(typeof item.condition.value).not.toBe("undefined");
      }
    }
    expect(getAutomationPlaybook("../anything")).toBeUndefined();
    expect(getAutomationPlaybook("SEND_WHATSAPP_TEMPLATE")).toBeUndefined();
  });

  it("every starter's condition and action is valid for the authoritative safe workflow evaluator", () => {
    const allowed: Record<WorkflowEventType, string[]> = {
      REQUEST_CREATED: ["request.serviceCode", "request.leadSource", "request.branchCode"],
      QUOTE_ACCEPTED: ["quote.currency", "quote.branchCode", "request.serviceCode"],
      VISIT_COMPLETED: ["visit.branchCode", "request.serviceCode", "visit.hasIncident"],
      INVOICE_PAID: ["invoice.currency", "invoice.branchCode", "request.serviceCode"],
      ATTENTION_OPENED: ["attention.type", "attention.severity", "attention.branchCode"],
    };
    for (const item of automationPlaybooks) {
      if (item.condition) expect(allowed[item.eventType]).toContain(item.condition.field);
      const version: WorkflowRuleVersionDTO = {
        id: "version-1", workspaceId: workspace, branchId: branch,
        ruleId: "rule-1", versionNumber: 1, state: "DRAFT",
        eventType: item.eventType,
        conditions: item.condition ? [item.condition] : [],
        actions: [{ type: "CREATE_ATTENTION", severity: item.severity, summaryKey: item.actionDetail }],
        maxActionsPerEvent: 3,
        createdAt: "2026-10-12T00:00:00.000Z",
      };
      const snapshot = item.condition ? { [item.condition.field]: item.condition.value as string | boolean } : {};
      const evaluated = evaluateWorkflowRule(version, {
        workspaceId: workspace, branchId: branch, eventType: item.eventType,
        snapshot, recursionDepth: 0,
      }, "PREVIEW");
      expect(evaluated).toMatchObject({ ok: true, value: { matched: true } });
    }
  });

  it("prefills explicit owner draft only; no automatic publish, delivery, payment or runtime mutation", () => {
    const read = (path: string) => readFileSync(join(process.cwd(),path),"utf8");
    const route = read("src/features/operations/OperationalProductRoute.tsx");
    const page = read("src/app/app/[workspace]/automations/page.tsx");
    expect(route).toContain("getAutomationPlaybook(automationTemplate)");
    expect(route).toContain('href={"?template=" + encodeURIComponent(item.id)}');
    expect(route).toContain("automationPlaybookCategories.map(category");
    expect(route).toContain("playbook?.condition?.field");
    expect(route).toContain("playbook?.condition?.operator");
    expect(route).toContain("String(playbook.condition.value)");
    expect(route).toContain("playbook?.severity");
    expect(route).toContain('defaultValue={playbook?.code}');
    expect(route).toContain('defaultValue={playbook?.name}');
    expect(route).toContain('defaultValue={playbook?.eventType ?? "INVOICE_PAID"}');
    expect(route).toContain('defaultValue={index === 1 ? playbook?.actionDetail : undefined}');
    expect(route).toContain('name={`action${index}Type`} defaultValue={index === 1 ? "CREATE_ATTENTION" : "NONE"}');
    expect(route).toContain("synthetic preview required before publish");
    expect(route).toContain("publishOperationalWorkflowVersion(");
    expect(route).toContain('workflowBackendWritable = operationalDatabaseMode() === "SERVICE_ROLE"');
    expect(page).toContain("automationTemplate={query.template}");
  });
});
