import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifiedReviewedReplyBody } from "../../src/server/core/reviewed-reply-input";

describe("explicit staff-approved provider reply safety", () => {
  test("keeps valid short text and natural human paragraph breaks", () => {
    expect(verifiedReviewedReplyBody("Your service is scheduled for review.")).toBe(true);
    expect(verifiedReviewedReplyBody("Hello,\n\nPlease check the quote.")).toBe(true);
    expect(verifiedReviewedReplyBody("a".repeat(4_000))).toBe(true);
  });
  test("rejects oversized raw payloads, even if trimming makes them short", () => {
    expect(verifiedReviewedReplyBody("x".repeat(4_001))).toBe(false);
    expect(verifiedReviewedReplyBody(" ".repeat(100_000) + "OK")).toBe(false);
    expect(verifiedReviewedReplyBody("\t".repeat(10_000) + "Send")).toBe(false);
    expect(verifiedReviewedReplyBody("   ")).toBe(false);
    expect(verifiedReviewedReplyBody({ text: "staff approved" })).toBe(false);
  });
  test("rejects invisible bidirectional spoofing and machine control characters", () => {
    for (const value of [
      "Price " + String.fromCharCode(0x202e) + "0001",
      "Sent " + String.fromCharCode(0x200b) + "payment",
      "Hidden " + String.fromCharCode(0) + "control",
      "Email " + String.fromCharCode(0x7f) + "header",
      "Customer " + String.fromCharCode(0x2066) + "approved",
    ]) expect(verifiedReviewedReplyBody(value)).toBe(false);
  });
  test("server command validates untrusted input before staff auth or any outbox", () => {
    const code = readFileSync(join(process.cwd(), "src/server/core/reviewed-inbox-reply.ts"),"utf8");
    const action = code.slice(code.indexOf("export async function approveReviewedInboxReply"));
    expect(action).toContain("!verifiedReviewedReplyBody(input.reviewedBody)");
    expect(action.indexOf("!verifiedReviewedReplyBody(input.reviewedBody)"))
      .toBeLessThan(action.indexOf("deps.resolveActor(input.workspaceSlug)"));
    expect(action.indexOf("!verifiedReviewedReplyBody(input.reviewedBody)"))
      .toBeLessThan(action.indexOf(".enqueueConversationReply("));
  });
});
