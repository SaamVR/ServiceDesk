import { handleDeliveryTriageHttpGet } from "@/server/api-handlers/delivery-triage-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handleDeliveryTriageHttpGet(request);
}
