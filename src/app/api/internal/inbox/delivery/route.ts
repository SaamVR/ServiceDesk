import { handleDeliveryTriageHttpGet } from "@/server/api-handlers/delivery-triage-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only branch-scoped delivery status; no recipient or body enumeration. */
export async function GET(request: Request): Promise<Response> {
  return handleDeliveryTriageHttpGet(request);
}
