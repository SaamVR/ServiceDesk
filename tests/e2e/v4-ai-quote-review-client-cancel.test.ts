import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("quote AI review client cancellation without false transport claims", () => {
  const src=readFileSync(join(process.cwd(),"src/features/operations/AiQuoteReview.tsx"),"utf8");
  test("invalidates stale model replies when switching quotes or unmounting",()=>{
    expect(src).toContain('key={workspaceSlug + ":" + quoteId}');
    expect(src).toContain("const requestSequence = useRef(0)");
    expect(src).toContain("activeRequest.current?.abort()");
    expect(src).toContain("if (requestSequence.current !== id || controller.signal.aborted) return;");
  });
  test("human can cancel display without claiming paid provider request stopped",()=>{
    expect(src).toContain("function cancelReview()");
    expect(src).toContain("requestSequence.current += 1;");
    expect(src).toContain("Cancel pending review display");
    expect(src).toContain("A paid provider request may still be processing");
    expect(src).not.toContain("provider request was cancelled");
  });
  test("never enables delivery, quote approval or unreviewed business changes",()=>{
    expect(src).toContain('fetch("/api/internal/ai/quote-review", {');
    expect(src).not.toContain("sendOperationalQuote");
    expect(src).not.toContain("launchCustomerInvoiceSandboxCheckout");
    expect(src).toContain("credentials: \"same-origin\"");
  });
});
