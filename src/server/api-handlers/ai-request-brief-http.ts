import type { Result } from "../../contracts";
import { readBoundedWebhookBody } from "./inbound-http-policy";
import {
  generateAuthorizedRequestBrief,
  type RequestBrief, type RequestBriefInput,
} from "../ai/request-brief";

type Run = (input: RequestBriefInput) => Promise<Result<RequestBrief>>;

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie",
    },
  });
}

/** Browser-initiated and session-authenticated; never a public AI webhook. */
export async function handleRequestBriefPost(
  request: Request,
  run?: Run,
): Promise<Response> {
  if (request.method !== "POST") return json(405, { code: "METHOD_NOT_ALLOWED" });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return json(415, { code: "CONTENT_TYPE_REQUIRED" });
  }
  const origin = request.headers.get("origin");
  let ownOrigin: string;
  try { ownOrigin = new URL(request.url).origin; }
  catch { return json(400, { code: "REQUEST_URL_INVALID" }); }
  const fetchSite = request.headers.get("sec-fetch-site");
  // On Render, Next may see an internal proxy URL while the browser sends
  // its real public Origin. Never trust X-Forwarded-Host supplied in the
  // request; use the exact external origin provisioned in server config.
  const configured = process.env.SERVICEDESK_AI_ALLOWED_ORIGIN;
  let trustedPublicOrigin: string | undefined;
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "https:" && parsed.pathname === "/" &&
          !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
          !parsed.port) trustedPublicOrigin = parsed.origin;
    } catch { /* Invalid configuration must fail closed. */ }
  }
  if (!origin || (origin !== ownOrigin && origin !== trustedPublicOrigin) ||
      (fetchSite && !["same-origin", "none"].includes(fetchSite))) {
    return json(403, { code: "SAME_ORIGIN_REQUIRED" });
  }
  let body: Awaited<ReturnType<typeof readBoundedWebhookBody>>;
  try { body = await readBoundedWebhookBody(request, 2048); }
  catch { return json(400, { code: "REQUEST_BODY_INVALID" }); }
  if (!body.ok) return json(413, { code: "REQUEST_TOO_LARGE" });
  let parsed: unknown;
  try { parsed = JSON.parse(body.rawBody); }
  catch { return json(400, { code: "REQUEST_JSON_INVALID" }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(400, { code: "REQUEST_SCHEMA_INVALID" });
  }
  const p = parsed as Record<string, unknown>;
  if (Object.keys(p).some(k => !["workspaceSlug", "requestId"].includes(k)) ||
      typeof p.workspaceSlug !== "string" || p.workspaceSlug.length < 3 ||
      p.workspaceSlug.length > 40 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.workspaceSlug) ||
      typeof p.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId)) {
    return json(400, { code: "REQUEST_SCHEMA_INVALID" });
  }
  let result: Result<RequestBrief>;
  try {
    // Only the real server runner receives the abort signal; injected test
    // ports preserve the exact validated payload and never inherit authority.
    const invoke: Run = run ?? (input =>
      generateAuthorizedRequestBrief(input, { signal: request.signal }));
    result = await invoke({ workspaceSlug: p.workspaceSlug, requestId: p.requestId });
  }
  catch { return json(503, { code: "AI_BRIEF_UNAVAILABLE" }); }
  if (!result.ok) {
    const status = result.code === "AI_BRIEF_AUTH_REQUIRED" || result.code === "AI_BRIEF_AUTH_UNAVAILABLE" ? 401
      : result.code === "AI_BRIEF_FORBIDDEN" ? 403
      : result.code === "AI_BRIEF_NOT_FOUND" ? 404 : 503;
    return json(status, { code: result.code });
  }
  return json(200, result.value);
}
