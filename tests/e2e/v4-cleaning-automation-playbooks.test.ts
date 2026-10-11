import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { automationPlaybooks, getAutomationPlaybook } from "@/features/operations/automation-playbooks";

describe("Cleaning-first automation starter playbooks", () => {
  it("offers three human-selected, fixed-event internal-attention drafts only", () => {
    expect(automationPlaybooks.map(item => item.eventType)).toEqual([
      "REQUEST_CREATED", "QUOTE_ACCEPTED", "VISIT_COMPLETED",
    ]);
    expect(new Set(automationPlaybooks.map(item => item.code)).size).toBe(3);
    for (const item of automationPlaybooks) {
      expect(item.code).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
      expect(item.actionDetail).toMatch(/^[A-Z_]{3,120}$/);
      expect(item.name.length).toBeLessThanOrEqual(120);
      expect(item.description).not.toMatch(/auto.send|guaranteed|charged|confirmed booking/i);
      expect(getAutomationPlaybook(item.id)).toBe(item);
    }
    expect(getAutomationPlaybook("../anything")).toBeUndefined();
    expect(getAutomationPlaybook("SEND_WHATSAPP_TEMPLATE")).toBeUndefined();
  });

  it("prefills explicit owner draft only; no automatic publish, provider send or runtime mutation", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const route = read("src/features/operations/OperationalProductRoute.tsx");
    const page = read("src/app/app/[workspace]/automations/page.tsx");
    expect(route).toContain('getAutomationPlaybook(automationTemplate)');
    expect(route).toContain('href={"?template=" + encodeURIComponent(item.id)}');
    expect(route).toContain('defaultValue={playbook?.code}');
    expect(route).toContain('defaultValue={playbook?.name}');
    expect(route).toContain('defaultValue={playbook?.eventType ?? "INVOICE_PAID"}');
    expect(route).toContain('defaultValue={index === 1 ? playbook?.actionDetail : undefined}');
    expect(route).toContain('name={`action${index}Type`} defaultValue={index === 1 ? "CREATE_ATTENTION" : "NONE"}');
    expect(route).toContain("synthetic preview required before publish");
    expect(route).toContain("publishOperationalWorkflowVersion(");
    expect(page).toContain("automationTemplate={query.template}");
  });
});
