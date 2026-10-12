import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiOperationsStatus } from "../../src/features/operations/AiOperationsStatus";

vi.mock("@/server/ai/runtime-config", () => ({
  readConfiguredAiRuntimeConfig: () => ({ ok: false }),
}));

const render = (compact = false) => renderToStaticMarkup(createElement(AiOperationsStatus, {
  workspaceSlug: "qa-cleaning", publishedRuleCount: 1, compact,
}));

afterEach(() => vi.unstubAllEnvs());

describe("V4 operator truth on automatic customer quote-accepted rules", () => {
  it("never implies customer acceptance triggers server automation by default", () => {
    vi.stubEnv("SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED", "");
    const html = render();
    expect(html).toContain("Automatic quote-accepted trigger status");
    expect(html).toContain("Deployment switch disabled");
    expect(html).toContain("Accepting a quote does not automatically run");
    expect(html).toContain("External email and WhatsApp actions always require separate approval");
  });

  it("treats server opt-in as configuration, never execution proof or provider delivery", () => {
    vi.stubEnv("SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED", "true");
    const html = render();
    expect(html).toContain("Deployment switch enabled");
    expect(html).toContain("owner-published rules");
    expect(html).toContain("saved execution receipts are still required");
    expect(html).toContain("External email and WhatsApp actions always require separate approval");
    expect(html).not.toContain("Successfully delivered");
  });

  it("does not add verbose operator status to compact owner Today layout", () => {
    vi.stubEnv("SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED", "true");
    const html = render(true);
    expect(html).not.toContain("Automatic quote-accepted trigger status");
    expect(html).not.toContain("Deployment switch enabled");
  });

  it("keeps the flag server-side and shows execution evidence only from saved records", () => {
    const source = readFileSync(join(process.cwd(), "src/features/operations/AiOperationsStatus.tsx"), "utf8");
    expect(source).toContain('process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true"');
    expect(source).toContain("summarizeWorkflowEvidence");
    expect(source).toContain("simulated previews excluded");
    expect(source).not.toContain("NEXT_PUBLIC_SERVICEDESK_AUTO_INTERNAL");
  });
});
