import type { Result } from "../../contracts";
import { queueApprovedInboxReply, type ReviewedInboxReplyInput,
  type ReviewedInboxReplyReceipt } from "../core/reviewed-inbox-reply";
import { readBoundedWebhookBody } from "./inbound-http-policy";

type Approval = (input: ReviewedInboxReplyInput) => Promise<Result<ReviewedInboxReplyReceipt>>;
const MAX_APPROVED_REPLY_BYTES = 8 * 1024;

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Cookie",
  } });
}
function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/**
 * Human approval boundary. This POST is the sole intended bridge between a
 * proposed AI reply and the already-existing SQL outbox reply command.
 * Never invoke on model completion or inbound provider webhooks.
 */
export async function handleReviewedInboxReplyHttpPost(
  request: Request,
  approve: Approval = queueApprovedInboxReply,
): Promise<Response> {
  if (request.method !== "POST") return reply(405, { code: "METHOD_NOT_ALLOWED" });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return reply(415, { code: "CONTENT_TYPE_REQUIRED" });
  }
  let expectedOrigin: string;
  try { expectedOrigin = new URL(request.url).origin; }
  catch { return reply(400, { code: "REQUEST_URL_INVALID" }); }
  if (request.headers.get("origin") !== expectedOrigin ||
      (request.headers.get("sec-fetch-site") &&
        !["same-origin", "none"].includes(request.headers.get("sec-fetch-site")!))) {
    return reply(403, { code: "SAME_ORIGIN_REQUIRED" });
  }

  let bounded: Awaited<ReturnType<typeof readBoundedWebhookBody>>;
  try { bounded = await readBoundedWebhookBody(request, MAX_APPROVED_REPLY_BYTES); }
  catch { return reply(400, { code: "BODY_READ_FAILED" }); }
  if (!bounded.ok) return reply(413, { code: "BODY_TOO_LARGE" });

  let value: unknown;
  try { value = JSON.parse(bounded.rawBody); }
  catch { return reply(400, { code: "INVALID_JSON" }); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return reply(400, { code: "INVALID_SCHEMA" });
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(k => ![
    "workspaceSlug", "conversationId", "sourceMessageId", "reviewedBody",
    "expectedVersion", "idempotencyKey", "confirmedByStaff",
  ].includes(k)) ||
      typeof input.workspaceSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
      !validId(input.conversationId) || !validId(input.sourceMessageId) ||
      typeof input.reviewedBody !== "string" || !input.reviewedBody.trim() ||
      input.reviewedBody.trim().length > 4_000 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      (input.expectedVersion as number) < 1 ||
      typeof input.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9_-]{12,128}$/.test(input.idempotencyKey) ||
      input.confirmedByStaff !== true) {
    return reply(400, { code: "REVIEWED_REPLY_INPUT_INVALID" });
  }

  let queued: Result<ReviewedInboxReplyReceipt>;
  try { queued = await approve(input as unknown as ReviewedInboxReplyInput); }
  catch { return reply(503, { code: "REVIEWED_REPLY_UNAVAILABLE" }); }
  if (!queued.ok) {
    const status =
      queued.code === "REVIEWED_REPLY_STAFF_REQUIRED" ||
      queued.code === "REVIEWED_REPLY_AUTH_UNAVAILABLE" ? 401 :
      queued.code === "REVIEWED_REPLY_BRANCH_DENIED" ? 403 :
      queued.code === "REVIEWED_REPLY_VERSION_CONFLICT" ||
      queued.code === "REVIEWED_REPLY_SOURCE_STALE" ||
      queued.code === "REVIEWED_REPLY_RECEIPT_MISMATCH" ? 409 :
      queued.code === "REVIEWED_REPLY_CONSENT_REQUIRED" ? 422 : 503;
    return reply(status, { code: queued.code });
  }
  return reply(200, queued.value);
}
