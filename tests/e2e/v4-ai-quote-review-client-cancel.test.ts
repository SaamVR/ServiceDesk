import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("quote AI review client cancellation without false transport claims", () => {
  const src = readFileSync(join(process.cwd(),
    "src/features/operations/AiQuoteReview.tsx"), "utf8");

  test("invalidates stale model replies when switching quotes, configuration or unmounting", () => {
    expect(src).toContain('key={workspaceSlug + ":" + quoteId}');
    expect(src).toContain("scopeKey = workspaceSlug +");
    expect(src).toContain("quoteId +");
    expect(src).toContain("status?.scopeKey === scopeKey ? status : undefined");
    expect(src).toContain("previous?.scopeKey === submittedScope");
    expect(src).toContain("activeRequest.current?.abort()");
    expect(src).toContain("activeRequest.current === controller");
    expect(src).toContain("A suspended fetch/JSON stream may never settle after abort");
    expect(src).toContain("if (activeRequest.current === controller) {");
    expect(src).toContain("activeRequest.current = null;");
    expect(src).toContain("previous?.scopeKey === submittedScope && previous.busy");
    expect(src).toContain("parseAuthorizedQuoteReview(payload, expectedQuoteId)");
  });

  test("cancels local display without claiming paid provider request stopped", () => {
    expect(src).toContain("function cancelReview()");
    expect(src).toContain("activeRequest.current = null;");
    expect(src).toContain("request.abort()");
    expect(src).toContain("Stop waiting");
    expect(src).toContain("A provider call may still finish or incur usage");
    expect(src).toContain("provider-side cancellation is not confirmed");
    expect(src).not.toContain("provider request was cancelled");
  });

  test("never enables delivery, quote approval or unreviewed business changes", () => {
    expect(src).toContain('fetch("/api/internal/ai/quote-review", {');
    expect(src).toContain('credentials: "same-origin"');
    expect(src).toContain('cache: "no-store"');
    expect(src).not.toContain("sendOperationalQuote");
    expect(src).not.toContain("launchCustomerInvoiceSandboxCheckout");
    expect(src).not.toContain("OPENAI_API_KEY");
  });
});
