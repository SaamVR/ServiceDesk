import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleQuoteReviewPost } from "../../src/server/api-handlers/ai-quote-review-http";

const url = "https://review.example/api/internal/ai/quote-review";
const quoteId = "22222222-2222-4222-8222-222222222222";
function request(body: unknown, origin = "https://review.example"): Request {
  return new Request(url, { method: "POST",
    headers: { "content-type": "application/json", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });
}
const input = { workspaceSlug: "ctg", quoteId };
describe("abortable authenticated quote AI HTTP boundary", () => {
  test("valid scoped request invokes injected runner and emits no-store staff-only result", async () => {
    let calls = 0;
    const res = await handleQuoteReviewPost(request(input), async validated => {
      calls++;
      expect(validated).toEqual(input);
      return { ok: true as const, value: {
        state: "AI_STAFF_REVIEW_ONLY" as const, quoteId, model: "test-model",
        review: "Review the saved oven add-on and room counts.",
        source: "VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS" as const,
      } };
    });
    expect(calls).toBe(1);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({ state: "AI_STAFF_REVIEW_ONLY", quoteId });
  });
  test("refuses cross-site, malformed and unknown-field payload before calling model", async () => {
    let runs = 0;
    const run = async () => { runs++; return { ok: false as const, code: "AI_QUOTE_UNAVAILABLE", message: "refused" }; };
    for (const req of [
      request(input, "https://evil.example"),
      request({ ...input, customerEmail: "secret@example.com" }),
      request({ ...input, quoteId: "bad" }),
      request({ ...input, workspaceSlug: "bad/slug" }),
      new Request(url, { method: "POST", headers: { origin: "https://review.example",
        "content-type": "text/plain" }, body: JSON.stringify(input) }),
    ]) {
      const res = await handleQuoteReviewPost(req, run);
      expect(res.ok).toBe(false);
    }
    expect(runs).toBe(0);
  });
  test("maps unauthenticated and unauthorized model access to status, no error body secrets", async () => {
    const result = await handleQuoteReviewPost(request(input), async () => ({
      ok: false, code: "AI_QUOTE_BRANCH_DENIED",
      message: "Bearer private-token customer@example.com",
    }));
    expect(result.status).toBe(403);
    expect(await result.json()).toEqual({ code: "AI_QUOTE_BRANCH_DENIED" });
  });
  test("passes the HTTP disconnect signal into the real staff model runner", () => {
    const backend = readFileSync(join(process.cwd(),
      "src/server/api-handlers/ai-quote-review-http.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/AiQuoteReview.tsx"), "utf8");
    expect(backend).toContain("generateAuthorizedQuoteReview(input, { signal: request.signal })");
    expect(ui).toContain("activeRequest.current?.abort()");
    expect(ui).toContain("signal: controller.signal");
    expect(ui).toContain('credentials: "same-origin"');
  });
});
