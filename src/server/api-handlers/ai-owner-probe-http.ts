import type { Result } from "../../contracts";
import { readBoundedWebhookBody } from "./inbound-http-policy";
import {
  testAuthorizedAiModelConnection,
  type AiConnectionProof,
} from "../ai/owner-provider-connection-test";

type ProbePort = (workspaceSlug: string) => Promise<Result<AiConnectionProof>>;

function response(status: number, data: unknown): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Protected staff-session POST, never usable as a public provider healthcheck. */
export async function handleAiOwnerProbePost(
  request: Request,
  run: ProbePort = testAuthorizedAiModelConnection,
): Promise<Response> {
  if (request.method !== "POST") return response(405, { code: "METHOD_NOT_ALLOWED" });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return response(415, { code: "CONTENT_TYPE_REQUIRED" });
  }
  let ownOrigin: string;
  try { ownOrigin = new URL(request.url).origin; }
  catch { return response(400, { code: "REQUEST_URL_INVALID" }); }
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== ownOrigin ||
      (fetchSite && !["same-origin", "none"].includes(fetchSite))) {
    return response(403, { code: "SAME_ORIGIN_REQUIRED" });
  }

  let body: Awaited<ReturnType<typeof readBoundedWebhookBody>>;
  try { body = await readBoundedWebhookBody(request, 1024); }
  catch { return response(400, { code: "REQUEST_BODY_INVALID" }); }
  if (!body.ok) return response(413, { code: "REQUEST_TOO_LARGE" });
  let parsed: unknown;
  try { parsed = JSON.parse(body.rawBody); }
  catch { return response(400, { code: "REQUEST_JSON_INVALID" }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return response(400, { code: "REQUEST_SCHEMA_INVALID" });
  }
  const data = parsed as Record<string, unknown>;
  if (Object.keys(data).some(key => key !== "workspaceSlug") ||
      typeof data.workspaceSlug !== "string" ||
      data.workspaceSlug.length < 3 || data.workspaceSlug.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.workspaceSlug)) {
    return response(400, { code: "REQUEST_SCHEMA_INVALID" });
  }
  let result: Result<AiConnectionProof>;
  try { result = await run(data.workspaceSlug); }
  catch { return response(503, { code: "AI_DIAGNOSTIC_UNAVAILABLE" }); }
  if (!result.ok) {
    const status = ["AI_DIAGNOSTIC_AUTH_REQUIRED", "AI_DIAGNOSTIC_AUTH_UNAVAILABLE"].includes(result.code) ? 401
      : result.code === "AI_DIAGNOSTIC_OWNER_REQUIRED" ? 403 : 503;
    return response(status, { code: result.code });
  }
  return response(200, result.value);
}
