import { describe, expect, it } from "vitest";
import { handleReviewedInboxReplyHttpPost } from "../../src/server/api-handlers/reviewed-inbox-reply-http";
import type { ReviewedInboxReplyReceipt } from "../../src/server/core/reviewed-inbox-reply";

const payload = {
  workspaceSlug: "service-desk", conversationId: "conv1", sourceMessageId: "incoming1",
  reviewedBody: "I have reviewed and approved this reply.",
  expectedVersion: 7, idempotencyKey: "reply-review-00001", confirmedByStaff: true,
};
const receipt: ReviewedInboxReplyReceipt = {
  state: "QUEUED_FOR_PROVIDER", workspaceId: "ws1", conversationId: "conv1",
  sourceMessageId: "incoming1", outboundMessageId: "outgoing1", outboxEventId: "outbox1",
  deliveryState: "QUEUED",
};
function request(text = JSON.stringify(payload), headers: Record<string, string> = {}) {
  return new Request("https://desk.example.test/api/internal/inbox/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://desk.example.test", ...headers },
    body: text,
  });
}
describe("explicit reviewed reply HTTP command", () => {
  it("sends exact staff-approved input to the already-authorized enqueue command", async () => {
    let calls = 0;
    const response = await handleReviewedInboxReplyHttpPost(request(), async input => {
      calls++;
      expect(input).toEqual(payload);
      return { ok: true, value: receipt };
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(receipt);
    expect(calls).toBe(1);
  });

  it("never invokes privileged action for unapproved, forged or malformed input", async () => {
    let calls = 0;
    const inputs = [
      { ...payload, confirmedByStaff: false },
      { ...payload, role: "OWNER" },
      { ...payload, expectedVersion: 0 },
      { ...payload, sourceMessageId: "invalid/path" },
      { ...payload, reviewedBody: "  " },
      { ...payload, idempotencyKey: "short" },
    ];
    for (const v of inputs) {
      const response = await handleReviewedInboxReplyHttpPost(
        request(JSON.stringify(v)), async () => { calls++; return { ok: true, value: receipt }; });
      expect(response.status).toBe(400);
    }
    for (const invalid of ["[]", "null", "not json", "X".repeat(9000)]) {
      const response = await handleReviewedInboxReplyHttpPost(request(invalid), async () => {
        calls++;
        return { ok: true, value: receipt };
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect(calls).toBe(0);
  });

  it("blocks cross-site approval before any authenticated operation", async () => {
    let calls = 0;
    const bad: Array<Record<string, string>> = [
      { Origin: "https://attacker.example.test" },
      { Origin: "" },
      { "sec-fetch-site": "cross-site" },
    ];
    for (const headers of bad) {
      const result = await handleReviewedInboxReplyHttpPost(request(JSON.stringify(payload), headers), async () => {
        calls++;
        return { ok: true, value: receipt };
      });
      expect(result.status).toBe(403);
    }
    expect(calls).toBe(0);
  });

  it("returns stable code only for consent denial, version conflict or auth errors", async () => {
    for (const [code, status] of [
      ["REVIEWED_REPLY_STAFF_REQUIRED", 401],
      ["REVIEWED_REPLY_BRANCH_DENIED", 403],
      ["REVIEWED_REPLY_VERSION_CONFLICT", 409],
      ["REVIEWED_REPLY_SOURCE_STALE", 409],
      ["REVIEWED_REPLY_RECEIPT_MISMATCH", 409],
      ["REVIEWED_REPLY_CONSENT_REQUIRED", 422],
    ] as const) {
      const response = await handleReviewedInboxReplyHttpPost(request(), async () => ({
        ok: false, code, message: "private workspace source",
      }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code });
    }
  });
  it("rejects forged success receipts without exposing foreign source or unsupported provider state", async () => {
    const altered: Array<unknown> = [
      null, [],
      { ...receipt, workspaceId: "" },
      { ...receipt, conversationId: "different" },
      { ...receipt, sourceMessageId: "anothercustomer" },
      { ...receipt, outboundMessageId: "invalid/id" },
      { ...receipt, outboxEventId: "" },
      { ...receipt, state: "DELIVERED" },
      { ...receipt, state: "QUEUED_FOR_PROVIDER", deliveryState: "DELIVERED" },
      { ...receipt, deliveryState: "PAYMENT_APPLIED" },
    ];
    for (const value of altered) {
      const response = await handleReviewedInboxReplyHttpPost(request(),
        async () => ({ ok: true, value: value as ReviewedInboxReplyReceipt }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ code: "REVIEWED_REPLY_RECEIPT_UNVERIFIED" });
    }
  });

  it("projects only the public receipt fields and preserves legitimate replay states", async () => {
    const forgedExtra = { ...receipt, debugSecret: "PRIVATE_TOKEN", recipient: "customer@example.test" };
    const result = await handleReviewedInboxReplyHttpPost(request(),
      async () => ({ ok: true, value: forgedExtra }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(receipt);
    const replay = { ...receipt, state: "EXISTING_REPLY" as const, deliveryState: "DELIVERED" as const };
    const existing = await handleReviewedInboxReplyHttpPost(request(),
      async () => ({ ok: true, value: replay }));
    expect(existing.status).toBe(200);
    expect(await existing.json()).toEqual(replay);
  });

  it("does not reflect thrown SQL or provider data", async () => {
    const response = await handleReviewedInboxReplyHttpPost(request(), async () => {
      throw new Error("private SQL details");
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "REVIEWED_REPLY_UNAVAILABLE" });
  });
});
