import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V4 controlled request workflow operator path", () => {
  it("requires a published request rule and owner before showing execution controls", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(route).toContain('data.actor.role === "OWNER" && (data.workflowRuleVersions ?? [])');
    expect(route).toContain('version.state === "PUBLISHED" && version.eventType === "REQUEST_CREATED"');
    expect(route).toContain('operationalDatabaseMode() === "SERVICE_ROLE"');
    expect(route).toContain('runOwnerSavedRequestAutomation(workspaceSlug, requestId)');
    expect(route).toContain("No event was executed.");
  });

  it("routes results back to the exact saved request and never equates internal attention with delivery", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(route).toContain("Process published request rules");
    expect(route).toContain("External sends remain approval-required");
    expect(route).toContain('request=" + encodeURIComponent(requestId) + "&"');
    const runtime = readFileSync(join(process.cwd(), "src/server/workflows/owner-request-automation.ts"), "utf8");
    expect(runtime).toContain('sourceEventId: requestId');
    expect(runtime).toContain('eq("action_type", "CREATE_ATTENTION")');
    expect(runtime).not.toContain("queueApprovedTemplate(");
    expect(runtime).not.toContain("sendWhatsapp(");
  });
});
