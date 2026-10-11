import { handleStaffAiHttpPost } from "@/server/api-handlers/ai-staff-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Authenticated same-origin STAFF draft only; never queues a provider send. */
export async function POST(request: Request): Promise<Response> {
  return handleStaffAiHttpPost(request);
}
