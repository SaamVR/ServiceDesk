import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AiOwnerOperationsBrief } from "../../src/features/operations/AiOwnerOperationsBrief";
import { parseVerifiedOwnerBrief } from "../../src/features/operations/owner-operations-brief-proof";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const good = {
  ok: true,
  source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
  model: "approved-model",
  brief: "Review the saved requests queue before planning any follow-up.",
};

describe("Owner AI saved-workload briefing presentation", () => {
  it("allows only bounded explicitly sourced read-only results", () => {
    expect(parseVerifiedOwnerBrief(good)).toEqual({
      source: good.source, model: good.model, brief: good.brief,
    });
    expect(parseVerifiedOwnerBrief({ ...good, source: "MODEL_GUESS" })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, ok: false })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, model: "wrong\nmodel" })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, model: " ".repeat(10) })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, model: "x".repeat(101) })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, brief: " " })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, brief: "x".repeat(901) })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, brief: "Unsafe\u0000advice" })).toBeNull();
    expect(parseVerifiedOwnerBrief({ ...good, brief: "Review requests.\nCheck quotes." })?.brief)
      .toBe("Review requests.\nCheck quotes.");
  });

  it("rejects arbitrary network JSON and strips any secret response extras", () => {
    for (const value of [null, [], {}, "OK", 7, { ...good, source: null }]) {
      expect(parseVerifiedOwnerBrief(value)).toBeNull();
    }
    expect(parseVerifiedOwnerBrief({
      ...good, apiKey: "SECRET_API_KEY", customerPhone: "private",
      quotedRevenue: 123456, paymentsApplied: true,
    })).toEqual({
      source: good.source, model: good.model, brief: good.brief,
    });
  });

  it("cannot expose private data or imply configured AI is connected in the disabled state", () => {
    const html = renderToStaticMarkup(createElement(AiOwnerOperationsBrief, {
      workspaceSlug: "qa-cleaning", configured: false,
    }));
    expect(html).toContain("Setup required");
    expect(html).toContain("Operational records");
    expect(html).toContain("Generate owner AI priorities");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Model suggestions");
    expect(html).not.toContain("SECRET_API_KEY");
  });

  it("exposes source queue navigation rather than acting from AI suggestions", () => {
    const html = renderToStaticMarkup(createElement(AiOwnerOperationsBrief, {
      workspaceSlug: "qa-cleaning", configured: false,
    }));
    for (const path of ["requests", "quotes", "invoices", "jobs", "quality"]) {
      expect(html).toContain("/app/qa-cleaning/" + path);
    }
    expect(html).toContain('aria-label="Verify saved operational priority queues"');
    expect(html).toContain("No AI output in this panel");
  });

  it("prevents duplicate server actions after operator timeout or stopping waiting", () => {
    const ui = read("src/features/operations/AiOwnerOperationsBrief.tsx");
    expect(ui).toContain("OWNER_BRIEF_WAIT_LIMIT_MS = 20_000");
    expect(ui).toContain("scopeKey = workspaceSlug +");
    expect(ui).toContain("key={workspaceSlug +");
    expect(ui).toContain("activeRequest.current || requestOutstanding");
    expect(ui).toContain('phase: "stopped"');
    expect(ui).toContain("sequence.current += 1");
    expect(ui).toContain("previous.phase === \"stopped\"");
    expect(ui).toContain("The server model call may still finish or incur usage");
    expect(ui).toContain("Another request is blocked until it finishes");
    expect(ui).toContain("setTimeout(");
    expect(ui).toContain("clearTimeout(timeout)");
    expect(ui).toContain("activeRequest.current = null");
    expect(ui).toContain("const response: unknown = await requestOwnerOperationsBrief(workspaceSlug)");
    expect(ui).toContain("parseVerifiedOwnerBrief(response)");
  });

  it("never treats a cancelled display as a provider-cancelled operation", () => {
    const ui = read("src/features/operations/AiOwnerOperationsBrief.tsx");
    expect(ui).not.toContain("provider request was cancelled");
    expect(ui).not.toContain("AbortController"); // Server actions expose no abort signal here.
    expect(ui).not.toContain("sendOperationalQuote");
    expect(ui).not.toContain("launchCustomerInvoiceSandboxCheckout");
    expect(ui).not.toContain("OPENAI_API_KEY");
    expect(ui).not.toContain("style={{");
  });

  it("maintains accessible contrast for small queue guidance text", () => {
    const css = read("src/features/operations/AiOwnerOperationsBrief.module.css");
    const lum = (hex: string) => {
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      const lin = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return lin[0] * .2126 + lin[1] * .7152 + lin[2] * .0722;
    };
    const contrast = (a: string, b: string) => {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    };
    expect(contrast("#587567", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("color: #587567");
  });

  it("uses responsive, keyboard-visible controls and advisory-only state", () => {
    const ui = read("src/features/operations/AiOwnerOperationsBrief.tsx");
    const css = read("src/features/operations/AiOwnerOperationsBrief.module.css");
    expect(ui).toContain('aria-label="Owner AI operational briefing"');
    expect(ui).toContain('aria-busy={waiting}');
    expect(ui).toContain('role="alert"');
    expect(ui).toContain('aria-live="polite"');
    expect(css).toContain(":focus-visible");
    expect(css).toContain("min-height: 46px");
    expect(css).toContain("@media (max-width: 500px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
