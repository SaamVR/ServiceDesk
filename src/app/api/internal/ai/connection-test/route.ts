import { handleAiOwnerProbePost } from "@/server/api-handlers/ai-owner-probe-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleAiOwnerProbePost(request);
}
