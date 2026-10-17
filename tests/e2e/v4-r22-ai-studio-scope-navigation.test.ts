import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifiedStudioRecordChoices } from "../../src/features/operations/ai-studio-records";
import { buildStaffModuleHref, staffModuleConfig } from "../../src/features/operations/staff-modules";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("R22 real authenticated AI Studio — source and UI boundaries", () => {
  it("adds a dedicated staff workspace route and a real, discoverable navigation entry", () => {
    expect(Object.keys(staffModuleConfig)).toHaveLength(13);
    expect(buildStaffModuleHref("cleaning-north", "automations") + "/ai-studio")
      .toBe("/app/cleaning-north/automations/ai-studio");
    expect(buildStaffModuleHref("north & south", "automations") + "/ai-studio")
      .toBe("/app/north%20%26%20south/automations/ai-studio");
    const page = read("src/app/app/[workspace]/automations/ai-studio/page.tsx");
    expect(page).toContain("loadOperationalStaffSnapshot(workspace)");
    expect(page).toContain("<AiStudioWorkspace");
    expect(page).toContain("result.ok");
    const shell = read("src/components/product/StaffAppShell.tsx");
    expect(shell).toContain('<span>AI Studio</span>');
    expect(shell).toContain('buildStaffModuleHref(workspace, "automations") + "/ai-studio"');
    const ops = read("src/features/operations/AiOperationsStatus.tsx");
    expect(ops).toContain('buildStaffModuleHref(workspaceSlug, "automations") + "/ai-studio"');
    const boundary = read("src/app/app/[workspace]/layout.tsx");
    expect(boundary).toContain("hasAuthenticatedSession()");
  });

  it("passes only verified UUID and safe enum-style status labels from saved records", () => {
    const sensitive = {
      id: idA, status: "NEW", customerName: "private user",
      phone: "+1-secret", address: "private road",
      notes: "invisible to browser", totalMinor: 1900000,
      apiKey: "should-never-leak",
    };
    expect(verifiedStudioRecordChoices("Request", [
      sensitive, { id: idB, status: "PENDING_APPROVAL" },
      { id: "not-an-id", status: "NEW" },
      { id: idA, status: "DUPLICATE" },
    ])).toEqual([
      { id: idA, label: "Request 1 · NEW" },
      { id: idB, label: "Request 2 · PENDING APPROVAL" },
    ]);
    const exported = JSON.stringify(verifiedStudioRecordChoices("Request", [sensitive]));
    for (const forbidden of ["private user", "private road", "+1-secret",
      "invisible to browser", "1900000", "should-never-leak"]) {
      expect(exported).not.toContain(forbidden);
    }
  });

  it("bounds scope and rejects arbitrary untrusted status, hostile IDs and duplicate selectors", () => {
    const ids = Array.from({ length: 55 }, (_, n) =>
      "aaaaaaaa-aaaa-4aaa-8aaa-" + n.toString(16).padStart(12, "0"));
    const got = verifiedStudioRecordChoices("Quote", [
      { id: "javascript:alert(1)", status: "SENT" },
      { id: idA, status: "SENT<script>..." },
      ...ids.map((id) => ({ id, status: "SENT" })),
    ]);
    expect(got).toHaveLength(40);
    expect(got[0]).toEqual({ id: idA, label: "Quote 1 · Status unavailable" });
    expect(got.every(item => !item.label.includes("<script>"))).toBe(true);
  });

  it("reuses real guarded AI endpoints and checks model config exclusively on the server", () => {
    const view = read("src/features/operations/AiStudioWorkspace.tsx");
    const client = read("src/features/operations/AiStudioWorkbench.tsx");
    expect(view).toContain("readConfiguredAiRuntimeConfig()");
    expect(view).toContain('verifiedStudioRecordChoices("Request", data.requests)');
    expect(view).toContain('verifiedStudioRecordChoices("Quote", data.quotes)');
    expect(view).toContain('data.actor.role === "OWNER"');
    expect(view).toContain("<AiOwnerModelProbe");
    expect(view).toContain("<AiOwnerOperationsBrief");
    expect(client).toContain("<AiRequestBrief");
    expect(client).toContain("<AiQuoteReview");
    expect(client).toContain("selectedRequest = requests.find");
    expect(client).toContain("selectedQuote = quotes.find");
    expect(client).not.toContain("process.env");
    expect(client).not.toContain("OPENAI_API_KEY");
    expect(client).not.toContain("fetch(");
    expect(view).not.toContain("process.env.OPENAI_API_KEY");
    expect(read("src/server/ai/runtime-config.ts")).toContain("SERVICEDESK_AI_ENABLED");
    expect(read("src/server/ai/runtime-config.ts")).toContain("env.OPENAI_API_KEY");
  });

  it("keeps provider requests opt-in, read-only and accessible on desktop or mobile", () => {
    const client = read("src/features/operations/AiStudioWorkbench.tsx");
    const css = read("src/features/operations/AiStudioWorkspace.module.css");
    expect(client).toContain('role="tablist"');
    expect(client).toContain('aria-selected={mode === "request"}');
    expect(client).toContain('aria-labelledby={mode === "request"');
    expect(client).toContain('role="status"');
    expect(client).not.toContain("autoSubmit");
    expect(css).toContain("@media(max-width: 490px)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
