import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 controlled workflow builder product", () => {
  it("keeps the existing human recovery queue and adds the rule builder beside it", () => {
    expect(route).toContain("Workflow builder");
    expect(route).toContain("Recovery queue");
    expect(route).toContain("Recovery remains human-owned");
    expect(route).toContain("<WorkflowBuilderPanel data={data} workspaceSlug={workspaceSlug} />");
  });

  it("exposes only the fixed event and action catalogues", () => {
    for (const event of [
      "REQUEST_CREATED",
      "QUOTE_ACCEPTED",
      "VISIT_COMPLETED",
      "INVOICE_PAID",
      "ATTENTION_OPENED",
    ]) expect(route).toContain(event);

    expect(route).toContain("Create attention item");
    expect(route).toContain("Send approved Email template");
    expect(route).toContain("Send approved WhatsApp template");
    expect(route).toContain("No code / SQL / URLs");
    expect(route).not.toContain("Custom SQL");
    expect(route).not.toContain("Run JavaScript");
    expect(route).not.toContain("Webhook URL");
  });

  it("requires a synthetic preview in the publish workflow and labels previews as side-effect free", () => {
    expect(route).toContain("Run synthetic preview");
    expect(route).toContain("Publish tested draft");
    expect(route).toContain("synthetic preview required before publish");
    expect(route).toContain("without any live side effect");
  });

  it("makes owner approval explicit for external sends", () => {
    expect(route).toContain("External sends need owner approval");
    expect(route).toContain("External template actions are never auto-approved.");
    expect(route).toContain("Approve external send");
    expect(route).toContain('action.state === "APPROVAL_REQUIRED" && data.actor.role === "OWNER"');
  });

  it("offers replay only at the failed action level", () => {
    expect(route).toContain("Replay this action only");
    expect(route).toContain('action.state === "FAILED" && data.actor.role === "OWNER"');
    expect(route).not.toContain("Replay booking");
    expect(route).not.toContain("Replay source event");
  });

  it("keeps rule authoring branch-scoped and owner-managed", () => {
    expect(route).toContain("Select a branch to edit rules");
    expect(route).toContain("Workflow rules are owner-managed");
    expect(route).toContain("Dispatchers can inspect decisions");
    expect(route).toContain('data.actor.role === "OWNER" && editorBranches.length > 0');
  });
});
