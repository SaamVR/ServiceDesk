/**
 * The browser consumes only the human-review portion of the coordinator's
 * authenticated AI draft HTTP response. Tool proposals are never executed
 * or treated as staff authorization.
 */
export interface ReviewedAiDraft {
  replyDraft: string;
  conversationId: string;
  savedHumanMessageId: string;
  handoverRequired: boolean;
}
/**
 * An HTTP 409 indicates the approved conversation/source is stale.
 * Editing local text must never re-enable submission against the same
 * obsolete expectedVersion; reloading/remounting a new scoped message does.
 */
export type StaffAiReviewError = "draft" | "approval" | "stale" | "cancelled";

export function staffAiReviewErrorAfterEdit(
  current: StaffAiReviewError | undefined,
): StaffAiReviewError | undefined {
  return current === "stale" ? "stale" : undefined;
}

export interface ApprovedReplyReceipt {
  state: "QUEUED_FOR_PROVIDER" | "EXISTING_REPLY";
  conversationId: string;
  sourceMessageId: string;
  deliveryState: "QUEUED" | "RUNNING" | "PROVIDER_ACCEPTED" |
    "DELIVERED" | "READ" | "FAILED" | "SUPPRESSED";
}
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const outboundStates = new Set([
  "QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED",
  "READ", "FAILED", "SUPPRESSED",
]);
export function parseReviewedAiDraft(
  raw: unknown,
  conversationId: string,
  messageId: string,
): ReviewedAiDraft | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      !id(conversationId) || !id(messageId)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.state !== "DRAFT_FOR_STAFF_REVIEW" ||
      r.conversationId !== conversationId ||
      r.savedHumanMessageId !== messageId ||
      typeof r.replyDraft !== "string" ||
      r.replyDraft.length > 4_000 || !r.replyDraft.trim() ||
      // Never present a draft with invisible bidi/formatting controls that
      // could visually spoof prices or recipient instructions to a reviewer.
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(r.replyDraft) ||
      /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(r.replyDraft) ||
      typeof r.handoverRequired !== "boolean") return undefined;
  return {
    replyDraft: r.replyDraft,
    conversationId,
    savedHumanMessageId: messageId,
    handoverRequired: r.handoverRequired,
  };
}
export function parseReviewedReplyReceipt(
  raw: unknown,
  conversationId: string,
  sourceMessageId: string,
): ApprovedReplyReceipt | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (!id(conversationId) || !id(sourceMessageId) ||
      !["QUEUED_FOR_PROVIDER", "EXISTING_REPLY"].includes(String(r.state)) ||
      r.conversationId !== conversationId ||
      r.sourceMessageId !== sourceMessageId ||
      typeof r.deliveryState !== "string" ||
      !outboundStates.has(r.deliveryState) ||
      // The server labels only an actually QUEUED result as newly queued.
      // Never render a contradictory success envelope as provider delivery.
      (r.state === "QUEUED_FOR_PROVIDER" && r.deliveryState !== "QUEUED")) return undefined;
  return {
    state: r.state as ApprovedReplyReceipt["state"],
    conversationId,
    sourceMessageId,
    deliveryState: r.deliveryState as ApprovedReplyReceipt["deliveryState"],
  };
}
