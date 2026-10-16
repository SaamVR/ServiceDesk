import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseReviewedAiDraft,
  parseReviewedReplyReceipt,
  staffAiReviewErrorAfterEdit,
} from "@/features/operations/staff-ai-review-contract";

const draft = {
  state: "DRAFT_FOR_STAFF_REVIEW",
  conversationId: "conv-7",
  savedHumanMessageId: "msg-9",
  replyDraft: "I can arrange an estimate. Which date works best?",
  handoverRequired: false,
  toolProposals: [{name:"sendPayment",allowed:false,reason:"not authorized"}],
};
const receipt = {
  state: "QUEUED_FOR_PROVIDER", workspaceId: "ws-1",
  conversationId: "conv-7", sourceMessageId: "msg-9",
  outboundMessageId: "outbound-4", outboxEventId: "event-3",
  deliveryState: "QUEUED",
};

describe("V3 staff-only reviewed AI reply path", () => {
  it("accepts a scoped draft but strips untrusted tool proposals and private metadata", () => {
    const parsed = parseReviewedAiDraft(draft, "conv-7", "msg-9");
    expect(parsed).toEqual({
      replyDraft: draft.replyDraft,
      conversationId: "conv-7",
      savedHumanMessageId: "msg-9",
      handoverRequired: false,
    });
    expect(parsed).not.toHaveProperty("toolProposals");
    expect(parseReviewedAiDraft({...draft, conversationId:"conv-other"}, "conv-7", "msg-9")).toBeUndefined();
    expect(parseReviewedAiDraft({...draft, state:"AUTO_SENT"}, "conv-7", "msg-9")).toBeUndefined();
    expect(parseReviewedAiDraft({...draft, replyDraft:"x".repeat(4_001)}, "conv-7", "msg-9")).toBeUndefined();
    expect(parseReviewedAiDraft({...draft, handoverRequired:"false"}, "conv-7", "msg-9")).toBeUndefined();
  });

  it("rejects blank or invisible spoofed model drafts before staff review UI", () => {
    const unsafe = [
      "  \t\n ",
      "Cleaning quote " + String.fromCodePoint(0x202e) + "$999",
      "Recipient " + String.fromCodePoint(0x200b) + "hidden",
      "Total " + String.fromCharCode(1) + "$100",
      "Message " + String.fromCodePoint(0xfeff) + "confusion",
    ];
    for (const replyDraft of unsafe) {
      expect(parseReviewedAiDraft({...draft, replyDraft}, "conv-7", "msg-9"))
        .toBeUndefined();
    }
    const readable = "Hello,\nPlease confirm your preferred date.\tThank you.";
    expect(parseReviewedAiDraft({...draft, replyDraft: readable}, "conv-7", "msg-9")?.replyDraft)
      .toBe(readable);
  });

  it("locks stale approval after staff edits until the conversation is reloaded", () => {
    expect(staffAiReviewErrorAfterEdit("stale")).toBe("stale");
    for (const error of ["draft", "approval", "cancelled"] as const) {
      expect(staffAiReviewErrorAfterEdit(error)).toBeUndefined();
    }
    expect(staffAiReviewErrorAfterEdit(undefined)).toBeUndefined();
    const ui = readFileSync(join(process.cwd(), "src/features/operations/StaffAiReviewComposer.tsx"), "utf8");
    expect(ui).toContain("setError(staffAiReviewErrorAfterEdit)");
    expect(ui).toContain('error !== "stale"');
    expect(ui).toContain("Reload this conversation before approving another reply.");
  });

  it("does not mistake a durable queue receipt for delivered customer confirmation", () => {
    expect(parseReviewedReplyReceipt(receipt, "conv-7", "msg-9")).toEqual({
      state: "QUEUED_FOR_PROVIDER", conversationId:"conv-7",
      sourceMessageId:"msg-9", deliveryState:"QUEUED",
    });
    expect(parseReviewedReplyReceipt({...receipt, state:"DELIVERED"}, "conv-7", "msg-9")).toBeUndefined();
    expect(parseReviewedReplyReceipt({...receipt, conversationId:"conv-2"}, "conv-7", "msg-9")).toBeUndefined();
    expect(parseReviewedReplyReceipt({...receipt, deliveryState:"PAYMENT_SUCCESS"}, "conv-7", "msg-9")).toBeUndefined();
  });

  it("refuses impossible newly-queued reply receipts while preserving authorized replay truth", () => {
    for (const deliveryState of [
      "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED",
    ]) {
      expect(parseReviewedReplyReceipt({ ...receipt, deliveryState }, "conv-7", "msg-9"))
        .toBeUndefined();
    }
    // A prior idempotent reply may already have reached the provider and
    // truthfully report the latest persisted status on safe replay.
    for (const deliveryState of ["QUEUED", "DELIVERED", "FAILED"] as const) {
      expect(parseReviewedReplyReceipt({
        ...receipt, state: "EXISTING_REPLY", deliveryState,
      }, "conv-7", "msg-9")?.deliveryState).toBe(deliveryState);
    }
  });

  it("requires human review, exact source and version, and durable idempotency before approval", () => {
    const ui = readFileSync(join(process.cwd(),"src/features/operations/StaffAiReviewComposer.tsx"),"utf8");
    const route = readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
    const css = readFileSync(join(process.cwd(),"src/features/operations/StaffAiReviewComposer.module.css"),"utf8");
    expect(ui).toContain('fetch("/api/internal/ai/draft"');
    expect(ui).toContain('fetch("/api/internal/inbox/reply"');
    expect(ui).toContain('onClick={suggest}');
    expect(ui).toContain('onClick={approve}');
    expect(ui).toContain("confirmedByStaff: true");
    expect(ui).toContain("idempotencyKey.current ??= crypto.randomUUID()");
    expect(ui).toContain("sourceMessageId,");
    expect(ui).toContain("expectedVersion,");
    expect(ui).toContain("draft.handoverRequired");
    expect(ui).toContain("Queue acceptance is not customer delivery confirmation.");
    expect(ui).toContain('method: "POST"');
    expect(ui).toContain('credentials: "same-origin"');
    expect(route).toContain('process.env.SERVICEDESK_AI_ENABLED === "true"');
    expect(route).toContain('"INBOUND" && item.senderKind === "CUSTOMER"');
    expect(route).toContain('["OWNER", "DISPATCHER"].includes(data.actor.role)');
    expect(route).toContain("!selected.handoverActive");
    expect(route).toContain('key={selected.id + ":" + selected.version + ":" + latestInboundMessage.id}');
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(":focus-visible");
  });
});
