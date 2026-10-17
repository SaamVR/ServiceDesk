import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  describeQuoteReviewHttpFailure,
  parseAuthorizedQuoteReview,
} from "../../src/features/operations/ai-quote-review-response";
import { AiQuoteReview } from "../../src/features/operations/AiQuoteReview";

const quoteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const anotherQuoteId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const valid = {
  state: "AI_STAFF_REVIEW_ONLY",
  quoteId,
  source: "VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS",
  model: "configured-model",
  review: "Staff should recheck the saved service codes and duration.",
};
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Quote reviewer browser proof boundary", () => {
  it("accepts only the exact saved quote and guarded server source", () => {
    expect(parseAuthorizedQuoteReview(valid, quoteId)).toEqual(valid);
    expect(parseAuthorizedQuoteReview(valid, anotherQuoteId)).toBeNull();
    expect(parseAuthorizedQuoteReview({ ...valid, quoteId: anotherQuoteId }, quoteId)).toBeNull();
    expect(parseAuthorizedQuoteReview({ ...valid, source: "UNVERIFIED_PROMPT" }, quoteId)).toBeNull();
    expect(parseAuthorizedQuoteReview({ ...valid, state: "AI_QUOTE_SENT" }, quoteId)).toBeNull();
  });

  it("rejects fabricated or missing quote IDs, arrays and invalid bodies", () => {
    for (const value of [null, [], "OK", 0, {}, { ...valid, quoteId: undefined }]) {
      expect(parseAuthorizedQuoteReview(value, quoteId)).toBeNull();
    }
    expect(parseAuthorizedQuoteReview(valid, "arbitrary-id")).toBeNull();
  });

  it("requires bounded, visible staff suggestions rather than empty or oversized replies", () => {
    for (const bad of ["", "   ", "x".repeat(901), "review\u0000 injected"]) {
      expect(parseAuthorizedQuoteReview({ ...valid, review: bad }, quoteId)).toBeNull();
    }
    expect(parseAuthorizedQuoteReview({ ...valid, review: "First\nSecond" }, quoteId)?.review)
      .toBe("First\nSecond");
  });

  it("rejects empty, oversized or injected model identities", () => {
    for (const bad of ["", " ", "x".repeat(101), "model\nfrom-provider", 2, null]) {
      expect(parseAuthorizedQuoteReview({ ...valid, model: bad }, quoteId)).toBeNull();
    }
  });

  it("never surfaces unexpected provider response fields", () => {
    expect(parseAuthorizedQuoteReview({
      ...valid, customerPhone: "PRIVATE PHONE", totalMinor: 11990,
      apiKey: "EXPOSED", toolCalls: [{ action: "SEND_MESSAGE" }],
    }, quoteId)).toEqual(valid);
  });

  it("maps known HTTP problems to safe actionable guidance", () => {
    expect(describeQuoteReviewHttpFailure(401)).toContain("access");
    expect(describeQuoteReviewHttpFailure(403)).toContain("access");
    expect(describeQuoteReviewHttpFailure(404)).toContain("no longer eligible");
    expect(describeQuoteReviewHttpFailure(429)).toContain("rate limits");
    expect(describeQuoteReviewHttpFailure(503)).toContain("unavailable");
    expect(describeQuoteReviewHttpFailure(504)).toContain("timed out");
    expect(describeQuoteReviewHttpFailure(500)).toContain("could not be verified");
  });

  it("limits time and prevents stale scope and canceled replies from rendering", () => {
    const source = read("src/features/operations/AiQuoteReview.tsx");
    expect(source).toContain("REVIEW_TIMEOUT_MS = 20_000");
    expect(source).toContain("scopeKey = workspaceSlug +");
    expect(source).toContain("quoteId +");
    expect(source).toContain("status?.scopeKey === scopeKey ? status : undefined");
    expect(source).toContain("previous?.scopeKey === submittedScope");
    expect(source).toContain("activeRequest.current === controller");
    expect(source).toContain("controller.abort()");
    expect(source).toContain("parseAuthorizedQuoteReview(payload, expectedQuoteId)");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("provider-side cancellation is not confirmed");
  });

  it("has a functioning disabled state without a model or raw customer information", () => {
    const html = renderToStaticMarkup(createElement(AiQuoteReview, {
      workspaceSlug: "approved-cleaning", quoteId, configured: false,
    }));
    expect(html).toContain("Setup required");
    expect(html).toContain("Manual quoting remains available");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Unverified model suggestion");
  });

  it("uses responsive, keyboard-visible and review-only UI classes", () => {
    const source = read("src/features/operations/AiQuoteReview.tsx");
    const css = read("src/features/operations/AiQuoteReview.module.css");
    expect(source).toContain('import styles from "./AiQuoteReview.module.css"');
    expect(source).toContain('aria-busy={busy}');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="polite"');
    expect(source).not.toContain("style={{");
    expect(source).not.toContain("OPENAI_API_KEY");
    expect(source).not.toContain("totalMinor");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("min-height: 46px");
  });
});
