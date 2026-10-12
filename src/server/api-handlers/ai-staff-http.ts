import type { Result } from "../../contracts";
import type { AssistantTurn } from "../ai/types";
import { runOperationalStaffAiTurn, type StaffAiInvocation } from "../ai/staff-invocation";
import { readBoundedWebhookBody } from "./inbound-http-policy";

export const MAX_STAFF_AI_REQUEST_BYTES = 16 * 1024;
type StaffTurnPort = (input: StaffAiInvocation) => Promise<Result<AssistantTurn>>;

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie",
    },
  });
}
function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

/** Explicit staff workflow only; NEVER place this handler on a public webhook
 * route or automatically execute a model-proposed tool or provider send.
 * The backing command must resolve active Supabase Auth session and membership.
 */
export async function handleStaffAiHttpPost(
  request: Request,
  run: StaffTurnPort = runOperationalStaffAiTurn,
): Promise<Response> {
  if (request.method !== "POST") return response(405, { code: "METHOD_NOT_ALLOWED" });
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    return response(415, { code: "CONTENT_TYPE_REQUIRED" });
  }

  // Render may pass an internal proxy URL to Next while the browser uses
  // our actual public HTTPS origin. Accept ONLY the explicitly configured
  // public origin, never X-Forwarded-Host from an untrusted request. The same
  // strict policy is shared by request-brief and owner model diagnostics.
  const origin = request.headers.get("origin");
  let requestOrigin: string;
  try { requestOrigin = new URL(request.url).origin; }
  catch { return response(400, { code: "REQUEST_URL_INVALID" }); }
  const configuredOrigin = process.env.SERVICEDESK_AI_ALLOWED_ORIGIN;
  let trustedPublicOrigin: string | undefined;
  if (configuredOrigin) {
    try {
      const candidate = new URL(configuredOrigin);
      if (candidate.protocol === "https:" && candidate.pathname === "/" &&
          !candidate.username && !candidate.password &&
          !candidate.search && !candidate.hash && !candidate.port) {
        trustedPublicOrigin = candidate.origin;
      }
    } catch { /* Invalid origin configuration fails closed. */ }
  }
  // A Next production app explicitly bound to loopback may normalize its
  // internal Request.url host as 'localhost' even when the browser connects
  // to 127.0.0.1. Trust only this *exact* local development pair on port 3000.
  // Never trust X-Forwarded-Host, user-supplied Host, arbitrary local ports or
  // an HTTP alias to any configured production HTTPS public origin.
  const localDevOrigins = ["http://127.0.0.1:3000", "http://localhost:3000"];
  const exactLoopbackPair = !!origin && localDevOrigins.includes(origin) &&
    localDevOrigins.includes(requestOrigin);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (origin !== requestOrigin && origin !== trustedPublicOrigin &&
      !exactLoopbackPair) ||
      (fetchSite && !["same-origin", "none"].includes(fetchSite))) {
    return response(403, { code: "SAME_ORIGIN_REQUIRED" });
  }

  let raw: Awaited<ReturnType<typeof readBoundedWebhookBody>>;
  try { raw = await readBoundedWebhookBody(request, MAX_STAFF_AI_REQUEST_BYTES); }
  catch { return response(400, { code: "REQUEST_BODY_INVALID" }); }
  if (!raw.ok) return response(413, { code: "REQUEST_TOO_LARGE" });

  let parsed: unknown;
  try { parsed = JSON.parse(raw.rawBody); }
  catch { return response(400, { code: "REQUEST_JSON_INVALID" }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return response(400, { code: "REQUEST_SCHEMA_INVALID" });
  }
  const body = parsed as Record<string, unknown>;
  if (Object.keys(body).some(k => !["workspaceSlug", "conversationId", "messageId"].includes(k)) ||
      !validId(body.conversationId) || !validId(body.messageId) ||
      typeof body.workspaceSlug !== "string" ||
      body.workspaceSlug.length < 3 || body.workspaceSlug.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.workspaceSlug)) {
    return response(400, { code: "REQUEST_SCHEMA_INVALID" });
  }

  let result: Result<AssistantTurn>;
  try {
    result = await run({
      workspaceSlug: body.workspaceSlug,
      conversationId: body.conversationId,
      messageId: body.messageId,
    });
  } catch {
    return response(503, { code: "AI_STAFF_UNAVAILABLE" });
  }
  if (!result.ok) {
    const code = result.code;
    const status = code === "AI_STAFF_UNAUTHORIZED" || code === "AI_STAFF_AUTH_UNAVAILABLE" ? 401
      : code === "AI_STAFF_WORKSPACE_MISMATCH" || code === "AI_BRANCH_SCOPE_REQUIRED" ? 403
      : code === "AI_CONVERSATION_NOT_FOUND" || code === "AI_MESSAGE_NOT_AUTHORIZED" ? 404
      : code === "AI_RUNTIME_DISABLED" ? 503 : 503;
    // Detailed database and model errors never pass into a browser response.
    return response(status, { code });
  }
  // This is explicitly a *draft for an authenticated human reviewer*.
  // It is never a provider send receipt, booked slot or a paid invoice.
  const turn = result.value;
  return response(200, {
    state: "DRAFT_FOR_STAFF_REVIEW",
    conversationId: turn.conversationId,
    savedHumanMessageId: turn.savedHumanMessageId,
    replyDraft: turn.replyDraft,
    missingQuestions: turn.missingQuestions,
    citations: turn.citations,
    handoverRequired: turn.handoverRequired,
    handoverReason: turn.handoverReason,
    toolProposals: turn.toolCalls.map(tool => ({
      name: tool.name, allowed: tool.allowed, reason: tool.reason,
    })),
  });
}
