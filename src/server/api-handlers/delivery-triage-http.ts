import type { Result } from "../../contracts";
import { loadOperationalDeliveryTriage, type DeliveryTriageSnapshot } from "../integrations/whatsapp/delivery-triage";

type Loader = (workspaceSlug: string) => Promise<Result<DeliveryTriageSnapshot>>;
function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status, headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie",
    },
  });
}

/** Authenticated staff read-only HTTP facade. It cannot retry, edit or
 * trigger sends. The loader resolves the cookie session, workspace, branch,
 * and authorized tenant records before any identifiers reach the response.
 */
export async function handleDeliveryTriageHttpGet(
  request: Request,
  load: Loader = loadOperationalDeliveryTriage,
): Promise<Response> {
  if (request.method !== "GET") return json(405, { code: "METHOD_NOT_ALLOWED" });
  let url: URL;
  try { url = new URL(request.url); }
  catch { return json(400, { code: "INVALID_URL" }); }
  const source = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if ((source && !["same-origin", "none"].includes(source)) ||
      (origin && origin !== url.origin)) {
    return json(403, { code: "CROSS_ORIGIN_DISALLOWED" });
  }
  const params = [...url.searchParams.keys()];
  const workspaceSlug = url.searchParams.get("workspaceSlug");
  if (params.length !== 1 || params[0] !== "workspaceSlug" ||
      typeof workspaceSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug) ||
      workspaceSlug.length > 40) {
    return json(400, { code: "WORKSPACE_SLUG_INVALID" });
  }
  let result: Result<DeliveryTriageSnapshot>;
  try { result = await load(workspaceSlug); }
  catch { return json(503, { code: "DELIVERY_TRIAGE_UNAVAILABLE" }); }
  if (!result.ok) {
    const status = result.code === "DELIVERY_TRIAGE_UNAUTHORIZED" ||
        result.code === "DELIVERY_TRIAGE_AUTH_UNAVAILABLE" ? 401 :
      result.code === "DELIVERY_TRIAGE_BRANCH_UNAVAILABLE" ? 403 : 503;
    return json(status, { code: result.code });
  }
  return json(200, result.value);
}
